import { Camera } from '@app/engine/camera/camera';
import { CameraType } from '@app/engine/camera/camera-type';
import { SolarBody } from '@app/engine/core/interfaces';
import { ServiceLocator } from '@app/engine/core/service-locator';
import { settingsManager } from '@app/settings/settings';
import { Kilometers } from '@ootk/src/main';
import { vi } from 'vitest';

/**
 * The "stay out of the center body" rule in `updateZoom_`. It measures an Earth-relative distance,
 * which is what the Earth view and a satellite orbit want - but centered on anything else that
 * number is interplanetary, so the rule only ever fired by accident: on the frame after a recenter,
 * before the world shift is re-based, the Earth distance reads ~0 and a freshly focused probe got
 * shoved out of the framing it just asked for (50 m asked, 134 m measured).
 *
 * The camera distance and the Earth distance are both stubbed rather than driven through the zoom
 * curve, so the assertions are about the rule and not about whatever zoom limits a neighbouring
 * suite left on the settings singleton.
 */
describe('Camera center-body keep-out', () => {
  let camera: Camera;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priv = () => camera as any;
  /** Distance a freshly focused probe is framed at (PROBE_MIN_ZOOM). */
  const PROBE_FRAMING_KM = 0.05;

  /** Both the imported singleton and the global: suites disagree on which one is live. */
  const setSetting = (key: string, value: unknown) => {
    (settingsManager as unknown as Record<string, unknown>)[key] = value;
    (globalThis.settingsManager as unknown as Record<string, unknown>)[key] = value;
  };

  const mockCenterBody = (name: string, body: { RADIUS?: number; zoomFloorRadiusKm?: number } | null) => {
    setSetting('centerBody', name);
    vi.spyOn(ServiceLocator, 'getScene').mockReturnValue({ getBodyById: () => body } as never);
  };

  /** Camera distance to whatever sits at the origin of the shifted frame (the center body). */
  const atDistanceFromCenterBody = (km: number) => {
    camera.state.zoomLevel = 0.0001;
    camera.state.zoomTarget = 0.0001;
    vi.spyOn(camera, 'calcDistanceBasedOnZoom').mockReturnValue(km as Kilometers);
  };

  beforeEach(() => {
    camera = new Camera();
    camera.cameraType = CameraType.FIXED_TO_EARTH;
    setSetting('isAutoZoomIn', false);
    setSetting('isAutoZoomOut', false);
  });

  afterEach(() => vi.restoreAllMocks());

  it('leaves a centered probe at its framing distance while the world shift is still stale', () => {
    // RADIUS is the 1 m sphere placeholder; the mesh is what the camera actually has to clear.
    mockCenterBody('Pioneer 10', { RADIUS: 0.001, zoomFloorRadiusKm: 0.007 });
    atDistanceFromCenterBody(PROBE_FRAMING_KM);
    // The frame right after a recenter, before the renderer re-anchors the shift to the probe.
    vi.spyOn(camera, 'getDistFromEarth').mockReturnValue(0 as Kilometers);

    const framing = camera.state.zoomTarget;

    priv().updateZoom_(16);

    expect(camera.state.zoomTarget).toBe(framing);
  });

  it('still pushes out when the camera is genuinely inside a non-Earth center body', () => {
    mockCenterBody('Mars', { RADIUS: 3389, zoomFloorRadiusKm: 3389 });
    atDistanceFromCenterBody(1000);
    vi.spyOn(camera, 'getDistFromEarth').mockReturnValue(2.2e8 as Kilometers);

    const framing = camera.state.zoomTarget;

    priv().updateZoom_(16);

    expect(camera.state.zoomTarget).toBeGreaterThan(framing);
  });

  it('keeps measuring against Earth for the Earth view', () => {
    mockCenterBody(SolarBody.Earth, { RADIUS: 6371, zoomFloorRadiusKm: 6371 });
    atDistanceFromCenterBody(6390);
    // Below the surface + 30 km margin: the rule has to fire.
    vi.spyOn(camera, 'getDistFromEarth').mockReturnValue(6390 as Kilometers);

    const framing = camera.state.zoomTarget;

    priv().updateZoom_(16);

    expect(camera.state.zoomTarget).toBeGreaterThan(framing);
  });

  it('does not push out from Earth once the camera clears the surface margin', () => {
    mockCenterBody(SolarBody.Earth, { RADIUS: 6371, zoomFloorRadiusKm: 6371 });
    atDistanceFromCenterBody(6800);
    vi.spyOn(camera, 'getDistFromEarth').mockReturnValue(6800 as Kilometers);

    const framing = camera.state.zoomTarget;

    priv().updateZoom_(16);

    expect(camera.state.zoomTarget).toBe(framing);
  });
});
