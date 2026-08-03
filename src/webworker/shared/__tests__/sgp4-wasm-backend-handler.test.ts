import { handleSgp4WasmBackendMsg, SGP4_WASM_BACKEND_MSG_TYPE } from '@app/webworker/shared/sgp4-wasm-backend-handler';
import { Sgp4WasmBackendMsgData } from '@app/webworker/shared/sgp4-wasm-backend-messages';
import { Sgp4, Sgp4Wasm, Sgp4XpWasm } from '@ootk/src/main';
import { vi } from 'vitest';

const msg = (backend: Sgp4WasmBackendMsgData['backend']): Sgp4WasmBackendMsgData => ({
  typ: SGP4_WASM_BACKEND_MSG_TYPE,
  backend,
  glueUrl: '/wasm/Sgp4Prop.js',
  wasmUrl: '/wasm/Sgp4Prop.wasm',
});

/** Flushes the microtask queue so the handler's .then/.catch chain runs. */
const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('handleSgp4WasmBackendMsg', () => {
  let useWasmBackendSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // The real static validates a fully loaded Emscripten runtime; the routing is its concern, not this file's.
    useWasmBackendSpy = vi.spyOn(Sgp4, 'useWasmBackend').mockImplementation(() => undefined) as ReturnType<typeof vi.spyOn>;
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined) as ReturnType<typeof vi.spyOn>;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined) as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads Sgp4Wasm with the supplied artifact urls and routes Sgp4 through it', async () => {
    const loadSpy = vi.spyOn(Sgp4Wasm.prototype, 'load').mockImplementation(function (this: Sgp4Wasm) {
      return Promise.resolve(this);
    });

    handleSgp4WasmBackendMsg(msg('sgp4-wasm'));
    await flushMicrotasks();

    expect(loadSpy).toHaveBeenCalledWith({ glue: '/wasm/Sgp4Prop.js', wasm: '/wasm/Sgp4Prop.wasm' });
    expect(useWasmBackendSpy).toHaveBeenCalledTimes(1);
    expect(useWasmBackendSpy.mock.calls[0][0]).toBeInstanceOf(Sgp4Wasm);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('sgp4-wasm backend active'));
  });

  it('instantiates Sgp4XpWasm when the message selects the xp backend', async () => {
    const xpLoadSpy = vi.spyOn(Sgp4XpWasm.prototype, 'load').mockImplementation(function (this: Sgp4XpWasm) {
      return Promise.resolve(this);
    });
    const baseLoadSpy = vi.spyOn(Sgp4Wasm.prototype, 'load');

    handleSgp4WasmBackendMsg(msg('sgp4-xp-wasm'));
    await flushMicrotasks();

    expect(xpLoadSpy).toHaveBeenCalledTimes(1);
    // Sgp4XpWasm extends Sgp4Wasm's base, but the non-xp class itself must not be constructed/loaded.
    expect(baseLoadSpy).not.toHaveBeenCalled();
    expect(useWasmBackendSpy.mock.calls[0][0]).toBeInstanceOf(Sgp4XpWasm);
  });

  it('reports attach/fallback stats at t+10s and t+30s after activation', async () => {
    vi.spyOn(Sgp4Wasm.prototype, 'load').mockImplementation(function (this: Sgp4Wasm) {
      return Promise.resolve(this);
    });

    handleSgp4WasmBackendMsg(msg('sgp4-wasm'));
    await flushMicrotasks();
    debugSpy.mockClear();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0][0]).toMatch(/t\+10s: \d+ TLEs on wasm, \d+ on TypeScript fallback/u);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(debugSpy.mock.calls[1][0]).toContain('t+30s');
  });

  it('keeps the TypeScript implementation and warns when the wasm artifacts fail to load', async () => {
    vi.spyOn(Sgp4Wasm.prototype, 'load').mockRejectedValue(new Error('404 on Sgp4Prop.wasm'));

    handleSgp4WasmBackendMsg(msg('sgp4-wasm'));
    await flushMicrotasks();

    expect(useWasmBackendSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to the TypeScript SGP4: 404 on Sgp4Prop.wasm'));
  });
});
