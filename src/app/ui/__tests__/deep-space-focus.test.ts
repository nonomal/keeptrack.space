import { focusDeepSpaceSatellite, INTERPLANETARY_MAX_ZOOM, PROBE_MIN_ZOOM } from '@app/app/ui/deep-space-focus';
import { ServiceLocator } from '@app/engine/core/service-locator';
import { DEFAULT_PROBE_MESH_RADIUS_M } from '@app/engine/rendering/draw-manager/celestial-bodies/deep-space-satellite';
// The module under test reads the imported singleton, not the global the test env swaps in.
import { settingsManager } from '@app/settings/settings';
import { Kilometers } from '@ootk/src/main';
import { setupStandardEnvironment } from '@test/environment/standard-env';
import { vi } from 'vitest';

describe('focusDeepSpaceSatellite', () => {
  let snapSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setupStandardEnvironment();
    vi.spyOn(ServiceLocator.getUiManager(), 'hideSideMenus').mockImplementation(() => undefined);
    snapSpy = vi.spyOn(ServiceLocator.getMainCamera(), 'snapZoomToDistance').mockImplementation(() => undefined);
    // The camera is a singleton that survives setupStandardEnvironment, so spying it again
    // hands back the same mock with the previous test's calls still on it.
    snapSpy.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  /*
   * Selecting a probe used to land at interplanetary range (62 million km), where a 14 m
   * spacecraft is a dot and the 3D mesh - the whole reason these probes have one - could only
   * be reached by zooming in by hand.
   */
  it('frames the probe on its mesh, the way selecting a satellite does', () => {
    expect(focusDeepSpaceSatellite('Voyager 1')).toBe(true);

    // Voyager's 13.8 m magnetometer boom -> 14 m bounding radius -> 6x = 84 m.
    expect(snapSpy).toHaveBeenCalledWith(0.084);
  });

  it('frames a small probe at the zoom floor rather than inside it', () => {
    // Pioneer's 6.6 m boom -> 7 m radius -> 6x = 42 m, which is closer than the floor this
    // view sets, and the camera would only clamp it back out.
    expect(focusDeepSpaceSatellite('Pioneer 10')).toBe(true);

    expect(snapSpy).toHaveBeenCalledWith(PROBE_MIN_ZOOM);
  });

  it('never frames closer than the fallback radius would, for a probe added without one', () => {
    // The fallback is the generic sat2 bus (3.3 m), not a spacecraft-sized guess: a probe that
    // omits meshRadiusM lands at the floor, never billions of times too far out.
    expect((6 * DEFAULT_PROBE_MESH_RADIUS_M) / 1000).toBeLessThanOrEqual(PROBE_MIN_ZOOM);
  });

  it('still opens the zoom range from the mesh out to interplanetary', () => {
    focusDeepSpaceSatellite('Voyager 1');

    // The framing is close, but nothing stops the user pulling back to heliocentric context.
    expect(settingsManager.minZoomDistance).toBe(PROBE_MIN_ZOOM);
    expect(settingsManager.maxZoomDistance).toBe(INTERPLANETARY_MAX_ZOOM);
    expect(settingsManager.centerBody).toBe('Voyager 1');
  });

  it('frames no closer than the zoom floor the view sets', () => {
    focusDeepSpaceSatellite('Voyager 1');

    const framing = snapSpy.mock.calls[0][0] as Kilometers;

    expect(framing).toBeGreaterThan(PROBE_MIN_ZOOM);
  });

  it('changes nothing for a body that is not a deep-space probe', () => {
    const before = settingsManager.centerBody;

    expect(focusDeepSpaceSatellite('Enterprise')).toBe(false);
    expect(snapSpy).not.toHaveBeenCalled();
    expect(settingsManager.centerBody).toBe(before);
  });
});
