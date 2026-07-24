import { neZoomFromCameraDistance } from '@app/engine/rendering/draw-manager/country-label-manager';
import { PoliticalMap } from '@app/engine/rendering/draw-manager/political-map';
import { describe, expect, it, vi } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const freshInstance = (): PoliticalMap => new (PoliticalMap as any)() as PoliticalMap;

const feature = (geometry: unknown, properties: Record<string, unknown> = {}) => ({
  properties,
  geometry,
});

describe('PoliticalMap.parseFeatures_', () => {
  const parse = (features: unknown[]) => (PoliticalMap as any).parseFeatures_(features);

  it('flattens Polygon and MultiPolygon rings and keeps label metadata', () => {
    const countries = parse([
      feature(
        {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
        { name: 'A', labelX: 10, labelY: 20, labelRank: 3, minLabel: 2.5, names: { de: 'Aa' } }
      ),
      feature(
        {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [0, 0],
                [1, 1],
                [0, 0],
              ],
            ],
            [
              [
                [2, 2],
                [3, 3],
                [2, 2],
              ],
              [
                [4, 4],
                [5, 5],
                [4, 4],
              ],
            ],
          ],
        },
        { name: 'B' }
      ),
    ]);

    expect(countries).toHaveLength(2);
    expect(countries[0].rings).toHaveLength(1);
    expect(countries[0].rings[0]).toHaveLength(8);
    expect(countries[0].labelLon).toBe(10);
    expect(countries[0].labelLat).toBe(20);
    expect(countries[0].names?.de).toBe('Aa');
    expect(countries[1].rings).toHaveLength(3);
  });

  it('skips features without geometry and applies defaults', () => {
    const countries = parse([
      feature(null, { name: 'Nowhere' }),
      feature(
        {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
        {}
      ),
    ]);

    expect(countries).toHaveLength(1);
    expect(countries[0].labelRank).toBe(10);
    expect(countries[0].minLabel).toBe(5);
  });
});

describe('PoliticalMap.rasterizeSlice_', () => {
  const makeCtx = () => ({
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
  });

  const runSlice = (rings: number[][][]) => {
    const ctx = makeCtx();
    const countries = [
      {
        name: 'X',
        labelLon: 0,
        labelLat: 0,
        labelRank: 2,
        minLabel: 1,
        rings: rings.map((r) => Float32Array.from(r.flat())),
      },
    ];
    const job = { canvas: { width: 360, height: 180 }, ctx, countryIdx: 0, ringIdx: 0 };

    (PoliticalMap as any).rasterizeSlice_(job, countries, Number.POSITIVE_INFINITY);

    return { ctx, job };
  };

  it('strokes normal segments', () => {
    const { ctx, job } = runSlice([
      [
        [0, 0],
        [10, 10],
        [20, 0],
      ],
    ]);

    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(job.countryIdx).toBe(1);
  });

  it('skips segments that run along the antimeridian', () => {
    // Two edge segments at lon 180, one real segment in between
    const { ctx } = runSlice([
      [
        [180, 10],
        [180, 20],
        [170, 20],
        [180, 10],
      ],
    ]);

    // 180,10 -> 180,20 skipped; 180,20 -> 170,20 drawn; 170,20 -> 180,10 drawn
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
  });

  it('skips segments that run along the south-pole edge', () => {
    const { ctx } = runSlice([
      [
        [-180, -90],
        [180, -90],
      ],
    ]);

    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
  });

  it('maps lon/lat to equirectangular pixels with row 0 at the north pole', () => {
    const { ctx } = runSlice([
      [
        [-180, 90],
        [0, 0],
      ],
    ]);

    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(180, 90);
  });
});

describe('PoliticalMap.update', () => {
  const gl = { getParameter: vi.fn(() => 8192) } as unknown as WebGL2RenderingContext;

  it('starts a single fetch and exposes no texture before rasterization completes', () => {
    const map = freshInstance();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));

    map.update(gl);
    map.update(gl);

    // Filter to our URL - unrelated async fetches (i18next, env setup) can land on the spy
    expect(fetchSpy.mock.calls.filter((c) => String(c[0]).includes('ne_50m_admin_0_countries.geojson'))).toHaveLength(1);
    expect(map.texture).toBeNull();
    expect(map.labelCountries).toBeNull();
    vi.restoreAllMocks();
  });

  it('marks the dataset failed after a fetch error and stops retrying', async () => {
    const map = freshInstance();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    // Await the fetch chain directly so the failed state is settled deterministically
    await (map as any).fetchDataset_();
    expect((map as any).isFailed_).toBe(true);

    // A failed dataset must never be re-fetched by later frames
    fetchSpy.mockClear();
    map.update(gl);

    expect(fetchSpy.mock.calls.filter((c) => String(c[0]).includes('ne_50m_admin_0_countries.geojson'))).toHaveLength(0);
    expect(map.texture).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('neZoomFromCameraDistance', () => {
  it('is monotonically decreasing with distance and clamped to [0, 7]', () => {
    const far = neZoomFromCameraDistance(200_000);
    const mid = neZoomFromCameraDistance(30_000);
    const near = neZoomFromCameraDistance(7_000);

    expect(far).toBeLessThan(mid);
    expect(mid).toBeLessThan(near);
    expect(far).toBeGreaterThanOrEqual(0);
    expect(near).toBeLessThanOrEqual(7);
  });

  it('shows only major countries when zoomed out and nearly all when close', () => {
    // Natural Earth MIN_LABEL is ~1.7 for the largest countries, ~6 for small ones
    expect(neZoomFromCameraDistance(90_000)).toBeLessThan(3);
    expect(neZoomFromCameraDistance(7_000)).toBeGreaterThan(5.5);
  });
});
