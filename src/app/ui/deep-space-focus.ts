/**
 * Shared camera-focus logic for deep-space satellites (Voyager 1, etc.).
 * Used by the URL handler (?sat=10321), SelectSatManager dot clicks, and the
 * pro Deep Space Missions menu, so all three paths behave identically.
 */
import { CameraType } from '@app/engine/camera/camera-type';
import { SolarBody } from '@app/engine/core/interfaces';
import { PluginRegistry } from '@app/engine/core/plugin-registry';
import { ServiceLocator } from '@app/engine/core/service-locator';
import { EventBus } from '@app/engine/events/event-bus';
import { EventBusEvent } from '@app/engine/events/event-bus-events';
import { initialFramingDistanceKm } from '@app/engine/utils/transforms';
import { PlanetsMenuPlugin } from '@app/plugins/planets-menu/planets-menu';
import { SelectSatManager } from '@app/plugins/select-sat-manager/select-sat-manager';
import { settingsManager } from '@app/settings/settings';
import { Kilometers } from '@ootk/src/main';

/** Min zoom distance for heliocentric / interplanetary framing (62 million km). */
export const INTERPLANETARY_MIN_ZOOM = 62e6 as Kilometers;
/** Max zoom distance for heliocentric / interplanetary framing (15 billion km). */
export const INTERPLANETARY_MAX_ZOOM = 1.5e10 as Kilometers;
/**
 * Min zoom distance when centered on a deep-space probe (50 m). Probes render
 * a lifelike-scale 3D mesh (meters across) at their position, so the camera
 * must be able to dolly all the way down to it - the same way a selected
 * satellite can be inspected up close. Wheel zoom sensitivity is proportional
 * to zoom level, so the ride from 15 billion km down to 50 m stays smooth.
 */
export const PROBE_MIN_ZOOM = 0.05 as Kilometers;

/**
 * Centers the camera on a deep-space satellite by name (a key of
 * `scene.deepSpaceSatellites`), framed on its 3D mesh with the zoom ceiling opened all the
 * way out to interplanetary range.
 * @returns false when the probe is not in the scene (ephemeris failed to load
 * or planets are disabled), in which case nothing is changed.
 */
export function focusDeepSpaceSatellite(name: string): boolean {
  const scene = ServiceLocator.getScene();
  const probe = scene?.deepSpaceSatellites?.[name];

  if (!probe) {
    return false;
  }

  const camera = ServiceLocator.getMainCamera();

  PluginRegistry.getPlugin(SelectSatManager)?.selectSat(-1);

  // Blend across to the probe instead of teleporting (see Camera.beginCenterBodyTransition).
  camera.beginCenterBodyTransition();
  camera.state.panCurrent = { x: 0, y: 0, z: 0 };

  settingsManager.centerBody = name as SolarBody;
  settingsManager.minZoomDistance = PROBE_MIN_ZOOM;
  settingsManager.maxZoomDistance = INTERPLANETARY_MAX_ZOOM;

  // Usage signal for telemetry: probe focus is a celestial-body selection too.
  EventBus.getInstance().emit(EventBusEvent.celestialBodySelected, name);

  camera.cameraType = CameraType.FIXED_TO_EARTH;

  /*
   * Frame the spacecraft itself, exactly the way selecting a satellite frames on its estimated
   * radius (`initialFramingDistanceKm`, 6x the bounding radius). Selecting a probe used to
   * arrive at interplanetary range instead, which put a 14 m spacecraft billions of times
   * smaller than a pixel and showed a dot - the 3D mesh, which is the whole reason these
   * probes have one, was only reachable by zooming in by hand from 62 million km.
   *
   * Never inside the floor this view just set: the smallest probes (New Horizons is a 2.5 m
   * mesh) frame at 6x radius closer than PROBE_MIN_ZOOM, and the camera would clamp the ride
   * back out anyway - so ask for the floor rather than for a distance it cannot honor.
   */
  camera.snapZoomToDistance(Math.max(initialFramingDistanceKm(probe.meshRadiusKm), PROBE_MIN_ZOOM) as Kilometers);

  // The view starts at the mesh but the zoom ceiling reaches interplanetary range, and out
  // there the planet orbit ellipses are the only thing that makes the frame readable - draw
  // the same heliocentric context the planets menu draws (Moon, planets including Earth,
  // dwarf planets), restoring centerBody to the probe.
  PluginRegistry.getPlugin(PlanetsMenuPlugin)?.drawHeliocentricOrbits(name as SolarBody);

  ServiceLocator.getUiManager().hideSideMenus();

  return true;
}
