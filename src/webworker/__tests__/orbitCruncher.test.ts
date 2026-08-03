import { OrbitDrawTypes } from '@app/webworker/orbit-cruncher-messages';
import { onMessage } from '@app/webworker/orbitCruncher';
import { SGP4_WASM_BACKEND_MSG_TYPE } from '@app/webworker/shared/sgp4-wasm-backend-messages';
import { Sgp4, Sgp4Wasm } from '@ootk/src/main';
import { vi } from 'vitest';

// OrbitCruncherMsgType is a const enum (erased); use literal values.
const MSG = {
  INIT: 0,
  SATELLITE_UPDATE: 1,
  MISSILE_UPDATE: 2,
  CHANGE_ORBIT_TYPE: 3,
  SETTINGS_UPDATE: 4,
  RESPONSE_DATA: 5,
} as const;

// Canonical Vallado SGP4 test TLE for the ISS.
const TLE1 = '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927';
const TLE2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537';

const NUM_SEGS = 4;

let posted: { payload: unknown; opts?: unknown }[] = [];

const initSat = (seqNum: number) => {
  onMessage({
    data: {
      typ: MSG.INIT,
      numSegs: NUM_SEGS,
      objData: JSON.stringify([{ tle1: TLE1, tle2: TLE2 }]),
      orbitFadeFactor: 1,
      numberOfOrbitsToDraw: 1,
      seqNum,
    },
  } as unknown as Parameters<typeof onMessage>[0]);
};

describe('orbitCruncher worker', () => {
  beforeEach(() => {
    posted = [];
    globalThis.postMessage = vi.fn((payload: unknown, opts?: unknown) => {
      posted.push({ payload, opts });
    }) as unknown as typeof globalThis.postMessage;
  });

  it('responds "ready" to an INIT message', () => {
    initSat(1);

    expect(posted.at(-1)?.payload).toBe('ready');
  });

  // Regression: a single bad object in the catalog used to throw 'Invalid Object
  // Data' mid-init, so postMessage('ready') never ran and boot hung forever at
  // "Building 3D Models…" (stalled worker: orbitCruncher.js). One bad object must
  // never take down the whole cruncher.
  it('still posts "ready" when an object has no usable TLE (does not throw)', () => {
    expect(() =>
      onMessage({
        data: {
          typ: MSG.INIT,
          numSegs: NUM_SEGS,
          // A Satellite whose TLE failed to parse arrives with empty tle1/tle2.
          objData: JSON.stringify([{ tle1: TLE1, tle2: TLE2 }, { tle1: '', tle2: '' }, {}]),
          seqNum: 1,
        },
      } as unknown as Parameters<typeof onMessage>[0])
    ).not.toThrow();

    expect(posted.at(-1)?.payload).toBe('ready');
  });

  // Regression (issue #1420): the producer sent objData as undefined when INIT
  // fired before the catalog populated. JSON.parse(undefined) threw "Unexpected
  // identifier 'undefined'", killing the worker before postMessage('ready').
  it('still posts "ready" when objData is undefined instead of a JSON string', () => {
    expect(() =>
      onMessage({
        data: {
          typ: MSG.INIT,
          numSegs: NUM_SEGS,
          objData: undefined,
          seqNum: 1,
        },
      } as unknown as Parameters<typeof onMessage>[0])
    ).not.toThrow();

    expect(posted.at(-1)?.payload).toBe('ready');
  });

  it('still posts "ready" when a TLE is malformed and createSatrec would throw', () => {
    expect(() =>
      onMessage({
        data: {
          typ: MSG.INIT,
          numSegs: NUM_SEGS,
          objData: JSON.stringify([
            { tle1: TLE1, tle2: TLE2 },
            { tle1: 'not a tle', tle2: 'garbage line 2' },
          ]),
          seqNum: 1,
        },
      } as unknown as Parameters<typeof onMessage>[0])
    ).not.toThrow();

    expect(posted.at(-1)?.payload).toBe('ready');
  });

  it('draws an empty orbit (all zeros) for a skipped no-TLE object rather than crashing', () => {
    onMessage({
      data: {
        typ: MSG.INIT,
        numSegs: NUM_SEGS,
        objData: JSON.stringify([
          { tle1: TLE1, tle2: TLE2 },
          { tle1: '', tle2: '' },
        ]),
        seqNum: 1,
      },
    } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 1, simulationTime: Date.UTC(2022, 0, 1), seqNum: 1 },
    } as unknown as Parameters<typeof onMessage>[0]);

    const last = posted.at(-1)!.payload as { typ: number; pointsOut: Float32Array; satId: number };

    expect(last.typ).toBe(MSG.RESPONSE_DATA);
    expect(last.satId).toBe(1);
    expect(last.pointsOut.every((v) => v === 0)).toBe(true);
  });

  it('propagates a satellite orbit and posts RESPONSE_DATA with a points buffer', () => {
    initSat(1);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 0, simulationTime: Date.UTC(2022, 0, 1), seqNum: 1 },
    } as unknown as Parameters<typeof onMessage>[0]);

    const last = posted.at(-1)!.payload as { typ: number; pointsOut: Float32Array; satId: number };

    expect(last.typ).toBe(MSG.RESPONSE_DATA);
    expect(last.satId).toBe(0);
    expect(last.pointsOut).toBeInstanceOf(Float32Array);
    expect(last.pointsOut.length).toBe((NUM_SEGS + 1) * 4);
    // A real LEO orbit should produce non-zero coordinates somewhere.
    expect(last.pointsOut.some((v) => v !== 0)).toBe(true);
  });

  it('discards stale SATELLITE_UPDATE messages (seqNum below current)', () => {
    initSat(5);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 0, simulationTime: Date.UTC(2022, 0, 1), seqNum: 2 },
    } as unknown as Parameters<typeof onMessage>[0]);

    expect(posted).toHaveLength(0);
  });

  it('posts a zero buffer for an out-of-range satellite id', () => {
    initSat(1);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 999, simulationTime: Date.UTC(2022, 0, 1), seqNum: 1 },
    } as unknown as Parameters<typeof onMessage>[0]);

    const last = posted.at(-1)!.payload as { typ: number; pointsOut: Float32Array; satId: number };

    expect(last.typ).toBe(MSG.RESPONSE_DATA);
    expect(last.satId).toBe(999);
    expect(last.pointsOut.every((v) => v === 0)).toBe(true);
  });

  it('handles SETTINGS_UPDATE and CHANGE_ORBIT_TYPE without throwing', () => {
    initSat(1);

    expect(() =>
      onMessage({
        data: { typ: MSG.SETTINGS_UPDATE, numberOfOrbitsToDraw: 3 },
      } as unknown as Parameters<typeof onMessage>[0])
    ).not.toThrow();

    expect(() =>
      onMessage({
        data: { typ: MSG.CHANGE_ORBIT_TYPE, orbitType: OrbitDrawTypes.TRAIL },
      } as unknown as Parameters<typeof onMessage>[0])
    ).not.toThrow();
  });

  it('draws a missile trajectory on MISSILE_UPDATE', () => {
    onMessage({
      data: {
        typ: MSG.INIT,
        numSegs: NUM_SEGS,
        objData: JSON.stringify([
          {
            missile: true,
            latList: [0, 1, 2, 3],
            lonList: [0, 1, 2, 3],
            altList: [100, 200, 300, 400],
          },
        ]),
        seqNum: 10,
      },
    } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: {
        typ: MSG.MISSILE_UPDATE,
        id: 0,
        simulationTime: Date.UTC(2022, 0, 1),
        seqNum: 10,
        latList: [0, 1, 2, 3],
        lonList: [0, 1, 2, 3],
        altList: [100, 200, 300, 400],
      },
    } as unknown as Parameters<typeof onMessage>[0]);

    const last = posted.at(-1)!.payload as { typ: number; pointsOut: Float32Array };

    expect(last.typ).toBe(MSG.RESPONSE_DATA);
    expect(last.pointsOut.some((v) => v !== 0)).toBe(true);
  });

  it('rotates each missile sample by the GMST at its own time when a launch epoch is given', () => {
    // A 2-hour trajectory whose ground-referenced position never changes. With a
    // per-sample GMST each sample is rotated by the Earth's spin at its own time, so
    // the drawn line sweeps a ~30° arc; with a single GMST (no launch epoch) every
    // sample collapses onto the same ECI point. This is the GEO-interceptor fix:
    // a multi-hour arc must not be drawn with one GMST or it drifts off its dots.
    const durationSec = 7200;
    const lat = new Array(durationSec + 1).fill(0);
    const lon = new Array(durationSec + 1).fill(0);
    const alt = new Array(durationSec + 1).fill(35786);

    onMessage({
      data: {
        typ: MSG.INIT,
        numSegs: NUM_SEGS,
        objData: JSON.stringify([{ missile: true, latList: lat, lonList: lon, altList: alt }]),
        seqNum: 20,
      },
    } as unknown as Parameters<typeof onMessage>[0]);

    const spreadOfXCoords = (startTime?: number): number => {
      posted = [];
      onMessage({
        data: {
          typ: MSG.MISSILE_UPDATE,
          id: 0,
          simulationTime: Date.UTC(2022, 0, 1),
          seqNum: 20,
          latList: lat,
          lonList: lon,
          altList: alt,
          startTime,
        },
      } as unknown as Parameters<typeof onMessage>[0]);
      const { pointsOut } = posted.at(-1)!.payload as { pointsOut: Float32Array };
      const xs: number[] = [];

      for (let p = 0; p < NUM_SEGS + 1; p++) {
        xs.push(pointsOut[p * 4]);
      }

      return Math.max(...xs) - Math.min(...xs);
    };

    // Single GMST: identical ground point → identical ECI point (no spread).
    expect(spreadOfXCoords(undefined)).toBeLessThan(1);
    // Per-sample GMST: 2 hours of Earth rotation spreads the samples by thousands of km.
    expect(spreadOfXCoords(Date.UTC(2022, 0, 1))).toBeGreaterThan(1000);
  });
});

// Near-equatorial, near-circular GEO element set (same one proximityOpsWorker.test.ts uses),
// epoch 2024-01-01 12:00 UTC.
const GEO_TLE1 = '1 41866U 16071A   24001.50000000  .00000000  00000-0  00000-0 0  9991';
const GEO_TLE2 = '2 41866   0.0200  90.0000 0001000   0.0000   0.0000  1.00270000    01';
const GEO_EPOCH_MS = Date.UTC(2024, 0, 1, 12);

describe('orbitCruncher worker - draw modes and edge paths', () => {
  beforeEach(() => {
    posted = [];
    globalThis.postMessage = vi.fn((payload: unknown, opts?: unknown) => {
      posted.push({ payload, opts });
    }) as unknown as typeof globalThis.postMessage;
  });

  afterEach(() => {
    // orbitType is worker-module state; leave every test on the default so ordering never matters.
    onMessage({ data: { typ: MSG.CHANGE_ORBIT_TYPE, orbitType: OrbitDrawTypes.ORBIT } } as unknown as Parameters<typeof onMessage>[0]);
    vi.restoreAllMocks();
  });

  const lastResponse = () => posted.at(-1)!.payload as { typ: number; pointsOut: Float32Array; anchor: [number, number, number]; satId: number };

  /** Absolute (anchor re-added) [x, y, z] of vertex i from an anchor-relative response. */
  const absVertex = (res: { pointsOut: Float32Array; anchor: [number, number, number] }, i: number): [number, number, number] => [
    res.anchor[0] + res.pointsOut[i * 4],
    res.anchor[1] + res.pointsOut[i * 4 + 1],
    res.anchor[2] + res.pointsOut[i * 4 + 2],
  ];

  it('routes the SGP4 wasm backend message to the shared handler and posts nothing', async () => {
    const loadSpy = vi.spyOn(Sgp4Wasm.prototype, 'load').mockRejectedValue(new Error('artifacts not deployed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    onMessage({
      data: { typ: SGP4_WASM_BACKEND_MSG_TYPE, backend: 'sgp4-wasm', glueUrl: '/wasm/Sgp4Prop.js', wasmUrl: '/wasm/Sgp4Prop.wasm' },
    } as unknown as Parameters<typeof onMessage>[0]);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    // The wasm message is routed, not treated as an orbit request.
    expect(posted).toHaveLength(0);
    // Let the rejected load settle inside this test so the warn lands while the spy is active.
    await Promise.resolve();
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to the TypeScript SGP4'));
  });

  it('ignores messages with an unknown typ', () => {
    onMessage({ data: { typ: 99 } } as unknown as Parameters<typeof onMessage>[0]);

    expect(posted).toHaveLength(0);
  });

  it('treats a malformed objData JSON string as an empty catalog and still posts "ready"', () => {
    expect(() =>
      onMessage({
        data: { typ: MSG.INIT, numSegs: NUM_SEGS, objData: '{not valid json', seqNum: 30 },
      } as unknown as Parameters<typeof onMessage>[0])
    ).not.toThrow();

    expect(posted.at(-1)?.payload).toBe('ready');
  });

  it('caches an explicit ignore entry and draws it as an empty orbit', () => {
    onMessage({
      data: { typ: MSG.INIT, numSegs: NUM_SEGS, objData: JSON.stringify([{ ignore: true }]), seqNum: 31 },
    } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 0, simulationTime: GEO_EPOCH_MS, seqNum: 31 },
    } as unknown as Parameters<typeof onMessage>[0]);

    expect(lastResponse().pointsOut.every((v) => v === 0)).toBe(true);
  });

  it('draws a GEO orbit in ECF as a tight cluster instead of the full ECI circle', () => {
    onMessage({
      data: { typ: MSG.INIT, numSegs: NUM_SEGS, objData: JSON.stringify([{ tle1: GEO_TLE1, tle2: GEO_TLE2 }]), orbitFadeFactor: 1, numberOfOrbitsToDraw: 2, seqNum: 32 },
    } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 0, simulationTime: GEO_EPOCH_MS, seqNum: 32, isEcfOutput: true },
    } as unknown as Parameters<typeof onMessage>[0]);

    const res = lastResponse();
    const xs: number[] = [];

    for (let i = 0; i < NUM_SEGS + 1; i++) {
      const [x, y, z] = absVertex(res, i);
      const radius = Math.hypot(x, y, z);

      // Every sample stays at geostationary altitude...
      expect(radius).toBeGreaterThan(41_000);
      expect(radius).toBeLessThan(43_500);
      xs.push(x);
    }
    // ...and in ECF a geostationary satellite barely moves (its figure-8 spans a few km),
    // while in ECI the same samples would sweep tens of thousands of km.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5000);
  });

  it('swaps in a new satrec when SATELLITE_UPDATE carries fresh TLEs', () => {
    onMessage({
      data: { typ: MSG.INIT, numSegs: NUM_SEGS, objData: JSON.stringify([{ tle1: GEO_TLE1, tle2: GEO_TLE2 }]), orbitFadeFactor: 1, seqNum: 33 },
    } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    // Same id, but the update replaces the GEO elements with the ISS TLE.
    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 0, simulationTime: Date.UTC(2008, 8, 20), seqNum: 33, tle1: TLE1, tle2: TLE2 },
    } as unknown as Parameters<typeof onMessage>[0]);

    const res = lastResponse();
    const [x, y, z] = absVertex(res, 0);

    // LEO radius proves the new satrec (not the cached GEO one) produced the points.
    expect(Math.hypot(x, y, z)).toBeLessThan(8000);
  });

  it('draws a fading trail in TRAIL mode: head vertex visible, tail transparent', () => {
    initSat(34);
    onMessage({ data: { typ: MSG.CHANGE_ORBIT_TYPE, orbitType: OrbitDrawTypes.TRAIL } } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 0, simulationTime: Date.UTC(2008, 8, 20), seqNum: 34 },
    } as unknown as Parameters<typeof onMessage>[0]);

    const res = lastResponse();

    expect(res.typ).toBe(MSG.RESPONSE_DATA);
    // Positions are real (non-zero somewhere)...
    expect(res.pointsOut.some((v) => v !== 0)).toBe(true);
    // ...with the trail alpha profile: only the first 1/40th of vertices carry alpha.
    expect(res.pointsOut[3]).toBeGreaterThan(0);
    expect(res.pointsOut[7]).toBe(0);
  });

  it('outputs the TRAIL in ECF when the polar view requests it', () => {
    initSat(35);
    onMessage({ data: { typ: MSG.CHANGE_ORBIT_TYPE, orbitType: OrbitDrawTypes.TRAIL } } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 0, simulationTime: Date.UTC(2008, 8, 20), seqNum: 35, isPolarViewEcf: true },
    } as unknown as Parameters<typeof onMessage>[0]);

    const res = lastResponse();
    const [x, y, z] = absVertex(res, 0);

    // Still a real LEO position after the ECI→ECF rotation.
    expect(Math.hypot(x, y, z)).toBeGreaterThan(6000);
    expect(Math.hypot(x, y, z)).toBeLessThan(8000);
  });

  it.each([
    ['ORBIT', OrbitDrawTypes.ORBIT],
    ['TRAIL', OrbitDrawTypes.TRAIL],
  ])('zeroes the %s vertex when propagation returns no state vector (decayed satrec)', (_label, orbitType) => {
    initSat(36);
    onMessage({ data: { typ: MSG.CHANGE_ORBIT_TYPE, orbitType } } as unknown as Parameters<typeof onMessage>[0]);
    vi.spyOn(Sgp4, 'propagate').mockReturnValue(null as never);
    posted = [];

    onMessage({
      data: { typ: MSG.SATELLITE_UPDATE, id: 0, simulationTime: Date.UTC(2008, 8, 20), seqNum: 36 },
    } as unknown as Parameters<typeof onMessage>[0]);

    expect(lastResponse().pointsOut.every((v) => v === 0)).toBe(true);
  });

  it('discards stale MISSILE_UPDATE messages (seqNum below current)', () => {
    onMessage({
      data: { typ: MSG.INIT, numSegs: NUM_SEGS, objData: JSON.stringify([{ missile: true, latList: [0], lonList: [0], altList: [100] }]), seqNum: 40 },
    } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: { typ: MSG.MISSILE_UPDATE, id: 0, simulationTime: GEO_EPOCH_MS, seqNum: 2 },
    } as unknown as Parameters<typeof onMessage>[0]);

    expect(posted).toHaveLength(0);
  });

  it('draws an empty orbit for a missile whose trajectory is not populated yet', () => {
    onMessage({
      data: { typ: MSG.INIT, numSegs: NUM_SEGS, objData: JSON.stringify([{ missile: true }]), seqNum: 41 },
    } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: { typ: MSG.MISSILE_UPDATE, id: 0, simulationTime: GEO_EPOCH_MS, seqNum: 41 },
    } as unknown as Parameters<typeof onMessage>[0]);

    const res = lastResponse();

    expect(res.typ).toBe(MSG.RESPONSE_DATA);
    expect(res.pointsOut.every((v) => v === 0)).toBe(true);
  });

  it('posts a zero buffer for an out-of-range missile id', () => {
    onMessage({
      data: { typ: MSG.INIT, numSegs: NUM_SEGS, objData: JSON.stringify([{ missile: true, latList: [0], lonList: [0], altList: [100] }]), seqNum: 42 },
    } as unknown as Parameters<typeof onMessage>[0]);
    posted = [];

    onMessage({
      data: { typ: MSG.MISSILE_UPDATE, id: 999, simulationTime: GEO_EPOCH_MS, seqNum: 42 },
    } as unknown as Parameters<typeof onMessage>[0]);

    const res = lastResponse();

    expect(res.satId).toBe(999);
    expect(res.pointsOut.every((v) => v === 0)).toBe(true);
  });
});
