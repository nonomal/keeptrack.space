/**
 * Shared camera-focus logic for deep-space satellites (Voyager 1, etc.).
 * Used by the URL handler (?sat=10321), SelectSatManager dot clicks, and the
 * pro Deep Space Missions menu, so all three paths behave identically.
 */
import { CameraType } from '@app/engine/camera/camera-type';
import { SolarBody } from '@app/engine/core/interfaces';
import { PluginRegistry } from '@app/engine/core/plugin-registry';
import { ServiceLocator } from '@app/engine/core/service-locator';
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
 * `scene.deepSpaceSatellites`), applying interplanetary zoom limits.
 * @returns false when the probe is not in the scene (ephemeris failed to load
 * or planets are disabled), in which case nothing is changed.
 */
export function focusDeepSpaceSatellite(name: string): boolean {
  const scene = ServiceLocator.getScene();

  if (!scene?.deepSpaceSatellites?.[name]) {
    return false;
  }

  PluginRegistry.getPlugin(SelectSatManager)?.selectSat(-1);
  settingsManager.centerBody = name as SolarBody;
  settingsManager.minZoomDistance = PROBE_MIN_ZOOM;
  settingsManager.maxZoomDistance = INTERPLANETARY_MAX_ZOOM;

  const camera = ServiceLocator.getMainCamera();

  camera.cameraType = CameraType.FIXED_TO_EARTH;

  // Keep the entry framing interplanetary: the zoom floor reaches down to the
  // probe mesh (PROBE_MIN_ZOOM), so a camera that was fully zoomed in before
  // focusing would otherwise arrive 50 m from the spacecraft instead of seeing
  // the heliocentric context. Zooming into the mesh stays a deliberate act.
  const minFramingZoom = camera.getZoomFromDistance(INTERPLANETARY_MIN_ZOOM);

  if (camera.state.zoomTarget < minFramingZoom) {
    camera.state.zoomTarget = minFramingZoom;
  }

  // Interplanetary framing without the planet orbit ellipses is unreadable -
  // draw the same heliocentric context the planets menu draws (Moon, planets
  // including Earth, dwarf planets), restoring centerBody to the probe.
  PluginRegistry.getPlugin(PlanetsMenuPlugin)?.drawHeliocentricOrbits(name as SolarBody);

  ServiceLocator.getUiManager().hideSideMenus();

  return true;
}
