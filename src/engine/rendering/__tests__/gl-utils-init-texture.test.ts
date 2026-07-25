/* eslint-disable require-jsdoc */

import { GlUtils } from '@app/engine/rendering/gl-utils';
import { getTextureStatuses, resetTextureLoadRegistry } from '@app/engine/rendering/texture-load-registry';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakeGl = {
  createTexture: () => ({}) as WebGLTexture,
  bindTexture: vi.fn(),
  texImage2D: vi.fn(),
  pixelStorei: vi.fn(),
  texParameteri: vi.fn(),
  texParameterf: vi.fn(),
  generateMipmap: vi.fn(),
  getExtension: () => null,
  TEXTURE_2D: 0x0de1,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
  UNPACK_FLIP_Y_WEBGL: 0x9240,
  UNPACK_ALIGNMENT: 0x0cf5,
  LINEAR_MIPMAP_LINEAR: 0x2703,
  LINEAR: 0x2601,
  REPEAT: 0x2901,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  CLAMP_TO_EDGE: 0x812f,
} as unknown as WebGL2RenderingContext;

function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response('', { status, headers });
}

function makeOkResponse(): Response {
  const blob = new Blob([new Uint8Array(4)], { type: 'image/png' });
  // Bake a non-power-of-2 image so the simpler shader-param path runs
  // (avoids the mipmap/anisotropy branch in initTexture, which isn't what these retry tests care about).

  return new Response(blob, { status: 200, headers: { 'Content-Type': 'image/png' } });
}

/**
 * Stand-in for HTMLImageElement so the `<img>` fallback can be exercised in jsdom, which
 * never actually loads an image. Fires asynchronously, the way a real element does.
 */
function stubImageElement(behavior: 'load' | 'error'): void {
  vi.stubGlobal(
    'Image',
    class {
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private src_ = '';

      get src(): string {
        return this.src_;
      }

      set src(value: string) {
        this.src_ = value;
        if (!value) {
          return;
        }
        setTimeout(() => {
          if (behavior === 'load') {
            this.onload?.();
          } else {
            this.onerror?.();
          }
        }, 0);
      }
    }
  );
}

/**
 * A response whose headers are fine but whose body cannot be read - the shape a connection
 * dropped mid-transfer, or a truncated entry in the HTTP cache, actually takes.
 */
function makeBodyFailureResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    blob: () => Promise.reject(new TypeError('Failed to fetch')),
  } as unknown as Response;
}

describe('GlUtils.initTexture retry policy', () => {
  beforeEach(() => {
    resetTextureLoadRegistry();
    vi.useFakeTimers();
    // Override the global 1x1 createImageBitmap mock so initTexture takes the non-POT branch.
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() =>
        Promise.resolve({
          width: 3,
          height: 5,
          close: () => {
            /* noop */
          },
        } as ImageBitmap)
      )
    );
  });

  // Image is stubbed by only some tests; restore it so the others keep jsdom's element.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves on first attempt when fetch is OK', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(makeOkResponse());

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/happy.png');

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const status = getTextureStatuses().find((s) => s.url.endsWith('happy.png'));

    expect(status?.state).toBe('loaded');
    expect(status?.attempts).toBe(1);
  });

  it('retries 5xx responses up to 2 times then fails', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(makeResponse(503)).mockResolvedValueOnce(makeResponse(503)).mockResolvedValueOnce(makeResponse(503));

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/hard-503.png');

    promise.catch(() => {
      /* expected */
    });
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow(/Failed to load image.*503/u);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const status = getTextureStatuses().find((s) => s.url.endsWith('hard-503.png'));

    expect(status?.state).toBe('failed');
    expect(status?.attempts).toBe(3);
  });

  it('retries 5xx then succeeds on the third attempt', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(makeResponse(503)).mockResolvedValueOnce(makeResponse(503)).mockResolvedValueOnce(makeOkResponse());

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/transient.png');

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const status = getTextureStatuses().find((s) => s.url.endsWith('transient.png'));

    expect(status?.state).toBe('loaded');
    expect(status?.attempts).toBe(3);
  });

  it('does NOT retry on 404', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(makeResponse(404));

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/missing.png');

    promise.catch(() => {
      /* expected */
    });
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow(/Failed to load image.*404/u);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const status = getTextureStatuses().find((s) => s.url.endsWith('missing.png'));

    expect(status?.state).toBe('failed');
    expect(status?.attempts).toBe(1);
  });

  it('retries on network errors (TypeError from fetch)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(makeOkResponse());

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/flaky.png');

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries when the response body fails to read', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(makeBodyFailureResponse()).mockResolvedValueOnce(makeOkResponse());

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/truncated.png');

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const status = getTextureStatuses().find((s) => s.url.endsWith('truncated.png'));

    expect(status?.state).toBe('loaded');
  });

  it('fails after exhausting retries when the body never reads', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeBodyFailureResponse())
      .mockResolvedValueOnce(makeBodyFailureResponse())
      .mockResolvedValueOnce(makeBodyFailureResponse());

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/always-truncated.png');

    promise.catch(() => {
      /* expected */
    });
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow(/Failed to load image.*Failed to fetch/u);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('bypasses the HTTP cache on retry so a poisoned cache entry can heal', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(makeBodyFailureResponse()).mockResolvedValueOnce(makeOkResponse());

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/poisoned.png');

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();

    // First attempt may use the cache; every retry must go to the network.
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
    expect(fetchMock.mock.calls[1][1]).toEqual({ cache: 'reload' });
  });

  it('falls back to an <img> element when every fetch attempt fails', async () => {
    // The measured browser failure: the body is refused on every try, but the element loads.
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(makeBodyFailureResponse());

    vi.stubGlobal('fetch', fetchMock);
    stubImageElement('load');

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/huge.png');

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const status = getTextureStatuses().find((s) => s.url.endsWith('huge.png'));

    expect(status?.state).toBe('loaded');
  });

  it('reports the original fetch failure when the <img> fallback also fails', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    vi.stubGlobal('fetch', fetchMock);
    stubImageElement('error');

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/hopeless.png');

    promise.catch(() => {
      /* expected */
    });
    await vi.runAllTimersAsync();
    // The network cause is what's actionable, not "<img> load failed".
    await expect(promise).rejects.toThrow(/Failed to load image.*Failed to fetch/u);
  });

  it('does NOT retry AbortError', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(abortErr);

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/aborted.png');

    promise.catch(() => {
      /* expected */
    });
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honors Retry-After header when within 5s cap', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeResponse(503, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(makeOkResponse());

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/retry-after.png');

    // Advance just under the Retry-After delay (2000ms) — fetch should not have been retried yet
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past — retry should fire
    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caps long Retry-After at 5000ms', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeResponse(503, { 'Retry-After': '60' })) // 60s
      .mockResolvedValueOnce(makeOkResponse());

    vi.stubGlobal('fetch', fetchMock);

    const promise = GlUtils.initTexture(fakeGl, 'http://example.test/textures/long-retry.png');

    // After 6s the cap (5s) is exceeded — retry should have fired
    await vi.advanceTimersByTimeAsync(6000);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
