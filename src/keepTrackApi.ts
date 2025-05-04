/* eslint-disable class-methods-use-this */
import { AnalyticsInstance } from 'analytics';
import { BaseObject, DetailedSatellite, DetailedSensor } from 'ootk';
import { keepTrackContainer } from './container';
import { Constructor, KeepTrackApiEvents, Singletons } from './interfaces';
import { saveCsv, saveVariable } from './lib/saveVariable';
import { KeepTrackPlugin } from './plugins/KeepTrackPlugin';
import type { SensorManager } from './plugins/sensor/sensorManager';
import { SoundManager } from './plugins/sounds/sound-manager';
import { SettingsManager } from './settings/settings';
import { Camera } from './singletons/camera';
import type { CatalogManager } from './singletons/catalog-manager';
import { MissileObject } from './singletons/catalog-manager/MissileObject';
import type { ColorSchemeManager } from './singletons/color-scheme-manager';
import type { DotsManager } from './singletons/dots-manager';
import type { LineManager } from './singletons/draw-manager/line-manager';
import type { MeshManager } from './singletons/draw-manager/mesh-manager';
import { errorManagerInstance } from './singletons/errorManager';
import type { GroupsManager } from './singletons/groups-manager';
import type { HoverManager } from './singletons/hover-manager';
import type { InputManager } from './singletons/input-manager';
import { PanTouchEvent, TapTouchEvent } from './singletons/input-manager/touch-input';
import type { OrbitManager } from './singletons/orbitManager';
import { Scene } from './singletons/scene';
import type { TimeManager } from './singletons/time-manager';
import type { UiManager } from './singletons/uiManager';
import { WebGLRenderer } from './singletons/webgl-renderer';
import { SatMath } from './static/sat-math';
import { SensorMath } from './static/sensor-math';

declare global {
  interface Window {
    settingsManager: SettingsManager;
    gremlins: unknown;
    randomizer: unknown;
    // eslint-disable-next-line no-use-before-define
    keepTrackApi: KeepTrackApi;
    dataLayer: IArguments[]; // For Google Tag Manager
    _numeric: unknown;
    satellite: SatMath;
    M: {
      AutoInit: () => void;
      Toast: {
        dismissAll: () => void;
      };
      toast: (options: { unsafeHTML?: string, html?: string; displayLength?: number }) => {
        $el: NodeListOf<HTMLElement>;
        timeRemaining: number;
        dismiss: () => void;
      };
      Dropdown: {
        init: (el: NodeListOf<Element>) => void;
      };
      keys: {
        TAB: number;
        ENTER: number;
        ESC: number;
        ARROW_UP: number;
        ARROW_DOWN: number;
      };
    }
  }
}

declare module '@app/doris/events/event-types' {
  export interface ApplicationEventMap {
    [KeepTrackApiEvents.bottomMenuClick]: [string];
    [KeepTrackApiEvents.hideSideMenus]: [];
    [KeepTrackApiEvents.nightToggle]: [WebGL2RenderingContext, WebGLTexture, WebGLTexture];
    [KeepTrackApiEvents.orbitManagerInit]: [];
    [KeepTrackApiEvents.rmbMenuActions]: [string, number];
    [KeepTrackApiEvents.rightBtnMenuAdd]: [];
    [KeepTrackApiEvents.updateDateTime]: [Date];
    [KeepTrackApiEvents.updatePropRate]: [number];
    [KeepTrackApiEvents.AfterHtmlInitialize]: [];
    [KeepTrackApiEvents.resetSensor]: [];
    [KeepTrackApiEvents.setSensor]: [DetailedSensor | string | null, number | null];
    [KeepTrackApiEvents.onWatchlistUpdated]: [{ id: number, inView: boolean }[]];
    [KeepTrackApiEvents.staticOffsetChange]: [number];
    [KeepTrackApiEvents.onLineChange]: [LineManager];
    [KeepTrackApiEvents.sensorDotSelected]: [DetailedSensor];
    [KeepTrackApiEvents.canvasMouseDown]: [MouseEvent];
    [KeepTrackApiEvents.touchStart]: [TapTouchEvent | PanTouchEvent];
    [KeepTrackApiEvents.onCruncherMessage]: [];
    [KeepTrackApiEvents.onCruncherReady]: [];
    [KeepTrackApiEvents.onHelpMenuClick]: [];
    [KeepTrackApiEvents.onKeepTrackReady]: [];
    [KeepTrackApiEvents.selectSatData]: [DetailedSatellite | MissileObject | BaseObject, number];
    [KeepTrackApiEvents.setSecondarySat]: [DetailedSatellite | null, number];
    [KeepTrackApiEvents.HtmlInitialize]: [];
    [KeepTrackApiEvents.BeforeHtmlInitialize]: [];
    [KeepTrackApiEvents.updateSelectBox]: [DetailedSatellite | MissileObject];
    [KeepTrackApiEvents.ConeMeshUpdate]: [];
    [KeepTrackApiEvents.bottomMenuModeChange]: [];
    [KeepTrackApiEvents.saveSettings]: [];
    [KeepTrackApiEvents.loadSettings]: [];
    [KeepTrackApiEvents.onPrimarySatelliteUpdate]: [BaseObject | null, number];
    [KeepTrackApiEvents.onPrimarySatelliteChange]: [BaseObject | null, number];
    [KeepTrackApiEvents.onSecondarySatelliteUpdate]: [BaseObject | null, number];
    [KeepTrackApiEvents.onSecondarySatelliteChange]: [BaseObject | null, number];
  }
}

type rmbMenuItem = {
  /**
   * Element ID of the main menu item
   */
  elementIdL1: string;
  /**
   * Element ID of the sub menu container
   */
  elementIdL2: string;
  /**
   * The sorting order for the menus
   */
  order: number;
  /**
   * Determines if the menu item is visible when right clicking on the earth
   */
  isRmbOnEarth: boolean;
  /**
   * Determines if the menu item is visible when right clicking off the earth
   */
  isRmbOffEarth: boolean;
  /**
   * Determines if the menu item is visible when right clicking on a satellite
   */
  isRmbOnSat: boolean;
};

export class KeepTrackApi {
  analytics: AnalyticsInstance = {
    identify: () => {
      // do nothing
    },
    track: () => {
      // do nothing
    },
    page: () => {
      // do nothing
    },
    user: () => ({
      anonymousId: '',
      id: '',
    }),
    reset: () => {
      // do nothing
    },
    ready: () => Promise.resolve(),
    on: () => {
      // do nothing
    },
    once: () => {
      // do nothing
    },
    getState: () => ({
      plugins: {},
    }),
  } as unknown as AnalyticsInstance;

  unregisterAllPlugins() {
    this.loadedPlugins = [];
  }

  containerRoot = null as unknown as HTMLDivElement;
  isInitialized = false;
  loadedPlugins = <KeepTrackPlugin[]>[];
  rmbMenuItems = <rmbMenuItem[]>[];

  getPlugin<T extends KeepTrackPlugin>(pluginClass: Constructor<T>): T | null {
    if (this.loadedPlugins.some((plugin: KeepTrackPlugin) => plugin instanceof pluginClass)) {
      return this.loadedPlugins.find((plugin: KeepTrackPlugin) => plugin instanceof pluginClass) as T;
    }

    return null;
  }

  /**
   * Retrieves a plugin by its name.
   *
   * This is for debugging and should not be used in production.
   * @deprecated
   *
   * @param pluginName - The name of the plugin to retrieve.
   * @returns The plugin with the specified name, or null if not found.
   */
  getPluginByName<T extends KeepTrackPlugin>(pluginName: string): T | null {
    if (this.loadedPlugins.some((plugin: KeepTrackPlugin) => plugin.id === pluginName)) {
      return this.loadedPlugins.find((plugin: KeepTrackPlugin) => plugin.id === pluginName) as T;
    }

    return null;
  }

  /**
   * This is not a standard function. It is used in development for formatting template literals.
   * example: keepTrackApi.html\`\<div>example\</div>\`
   * TODO: This should be a static method
   */
  html(strings: TemplateStringsArray, ...placeholders: string[]) {
    for (const placeholder of placeholders) {
      if (typeof placeholder !== 'string') {
        errorManagerInstance.error(new Error('Invalid input'), 'keepTrackApi.html');
      }
    }

    return String.raw(strings, ...placeholders);
  }

  /**
   * This is not a standard function. It is used in development for formatting template literals.
   * example: keepTrackApi.glsl\`uniform float example\`
   * TODO: This should be a static method
   */
  // eslint-disable-next-line class-methods-use-this
  glsl(literals: TemplateStringsArray, ...placeholders): string {
    let str = '';

    for (let i = 0; i < placeholders.length; i++) {
      str += literals[i];
      str += placeholders[i];
    }
    str += literals[literals.length - 1];

    return str;
  }

  getSoundManager = () => keepTrackContainer.get<SoundManager>(Singletons.SoundManager);
  getRenderer = () => keepTrackContainer.get<WebGLRenderer>(Singletons.WebGLRenderer);
  getScene = () => keepTrackContainer.get<Scene>(Singletons.Scene);
  getCatalogManager = () => keepTrackContainer.get<CatalogManager>(Singletons.CatalogManager);
  getSensorManager = () => keepTrackContainer.get<SensorManager>(Singletons.SensorManager);
  getUiManager = () => keepTrackContainer.get<UiManager>(Singletons.UiManager);
  getInputManager = () => keepTrackContainer.get<InputManager>(Singletons.InputManager);
  getGroupsManager = () => keepTrackContainer.get<GroupsManager>(Singletons.GroupsManager);
  getTimeManager = () => keepTrackContainer.get<TimeManager>(Singletons.TimeManager);
  getOrbitManager = () => keepTrackContainer.get<OrbitManager>(Singletons.OrbitManager);
  getColorSchemeManager = () => keepTrackContainer.get<ColorSchemeManager>(Singletons.ColorSchemeManager);
  getDotsManager = () => keepTrackContainer.get<DotsManager>(Singletons.DotsManager);
  getSensorMath = () => keepTrackContainer.get<SensorMath>(Singletons.SensorMath);
  getLineManager = () => keepTrackContainer.get<LineManager>(Singletons.LineManager);
  getHoverManager = () => keepTrackContainer.get<HoverManager>(Singletons.HoverManager);
  getMainCamera = () => keepTrackContainer.get<Camera>(Singletons.MainCamera);
  getMeshManager = () => keepTrackContainer.get<MeshManager>(Singletons.MeshManager);

  saveCsv = saveCsv;
  saveVariable = saveVariable;
}

export const keepTrackApi = new KeepTrackApi();
