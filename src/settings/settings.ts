/* eslint-disable max-lines */
/**
 * /////////////////////////////////////////////////////////////////////////////
 *
 * @Copyright (C) 2025 Kruczek Labs LLC
 *
 * KeepTrack is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * KeepTrack is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * KeepTrack. If not, see <http://www.gnu.org/licenses/>.
 *
 * /////////////////////////////////////////////////////////////////////////////
 */

import { Doris } from '@app/doris/doris';
import { MenuMode, SensorGeolocation, ToastMsgType } from '@app/interfaces';
import { KeepTrackApiEvents } from '@app/keeptrack/events/event-types';
import { keepTrackApi } from '@app/keepTrackApi';
import type { FilterPluginSettings } from '@app/plugins/filter-menu/filter-menu';
import type { KeepTrackPlugins } from '@app/plugins/plugins';
import { SelectSatManager } from '@app/plugins/select-sat-manager/select-sat-manager';
import { ColorSchemeColorMap } from '@app/singletons/color-schemes/color-scheme';
import { ObjectTypeColorSchemeColorMap } from '@app/singletons/color-schemes/object-type-color-scheme';
import { EarthDayTextureQuality, EarthNightTextureQuality } from '@app/singletons/draw-manager/earth';
import { Degrees, Kilometers, Milliseconds } from 'ootk';
import { isThisNode } from '../doris/utils/isThisNode';
import { RADIUS_OF_EARTH } from '../lib/constants';
import { PersistenceManager, StorageKey } from '../singletons/persistence-manager';
import { ClassificationString } from '../static/classification';
import { GetVariables } from './getVariables';
import { darkClouds } from './presets/darkClouds';
import { SettingsPresets } from './presets/presets';
import { starTalk } from './presets/startalk';

export class SettingsManager {
  /**
   * A variable to hold a classification string, set to `null` when unused
   */
  classificationStr = null as ClassificationString | null;
  menuMode: MenuMode = MenuMode.BASIC;
  // This controls which of the built-in plugins are loaded
  plugins = <KeepTrackPlugins>{
    debug: true,
    satInfoboxCore: true,
    aboutManager: false,
    collisions: true,
    trackingImpactPredict: true,
    dops: true,
    findSat: true,
    launchCalendar: true,
    newLaunch: true,
    nextLaunch: true,
    nightToggle: true,
    photoManager: true,
    screenRecorder: true,
    satChanges: false,
    stereoMap: true,
    timeMachine: true,
    initialOrbit: true,
    missile: true,
    breakup: true,
    editSat: true,
    constellations: true,
    countries: true,
    colorsMenu: true,
    shortTermFences: true,
    orbitReferences: true,
    analysis: true,
    plotAnalysis: true,
    sensorFov: true,
    sensorSurv: true,
    satelliteFov: true,
    satelliteView: true,
    planetarium: true,
    astronomy: true,
    screenshot: true,
    watchlist: true,
    sensor: true,
    settingsMenu: true,
    graphicsMenu: true,
    datetime: true,
    social: true,
    topMenu: true,
    classificationBar: true,
    soundManager: true,
    gamepad: true,
    debrisScreening: true,
    videoDirector: true,
    reports: true,
    polarPlot: true,
    timeline: true,
    timelineAlt: true,
    transponderChannelData: true,
    calculator: true,
    createSat: true,
    filterMenu: true,
    RPOCalculator: true,
  };
  changeTimeWithKeyboardAmountBig = 1000 * 60 * 60 as Milliseconds; // 1 hour
  changeTimeWithKeyboardAmountSmall = 1000 * 60 as Milliseconds; // 1 minute
  earthDayTextureQuality = EarthDayTextureQuality.MEDIUM;
  earthNightTextureQuality = EarthNightTextureQuality.MEDIUM;
  filter: FilterPluginSettings = {};
  /**
   * This enables/disable the mission data section of the sat-info-box. There is no value if your data set contains no mission data.
   */
  isMissionDataEnabled = true;
  /**
   * If ECF Orbits are drawn, this is the number of orbits to draw.
   */
  numberOfEcfOrbitsToDraw = 1;
  /**
   * The confidence level to use when drawing Covariance ellipsoids.
   * 1 = 68.27% confidence
   * 2 = 95.45% confidence
   * 3 = 99.73% confidence
   */
  covarianceConfidenceLevel: number = 2;
  /**
   * Flag to determine if the covariance ellipsoid should be drawn.
   */
  isDrawCovarianceEllipsoid = false;
  isPreserveSettings = true;
  isMobileModeBlocked = false;
  isShowDistance = false;


  static preserveSettings() {
    if (!settingsManager.isPreserveSettings) {
      return;
    }

    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_CAMERA_WIDGET, settingsManager.drawCameraWidget.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_ORBITS, settingsManager.isDrawOrbits.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_TRAILING_ORBITS, settingsManager.isDrawTrailingOrbits.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_ECF, settingsManager.isOrbitCruncherInEcf.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_IN_COVERAGE_LINES, settingsManager.isDrawInCoverageLines.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_SUN, settingsManager.isDrawSun.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_COVARIANCE_ELLIPSOID, settingsManager.isDrawCovarianceEllipsoid.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_BLACK_EARTH, settingsManager.isBlackEarth.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_ATMOSPHERE, settingsManager.isDrawAtmosphere.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_AURORA, settingsManager.isDrawAurora.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DRAW_MILKY_WAY, settingsManager.isDrawMilkyWay.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_GRAY_SKYBOX, settingsManager.isGraySkybox.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_ECI_ON_HOVER, settingsManager.isEciOnHover.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_HOS, settingsManager.colors.transparent[3] === 0 ? 'true' : 'false');
    if (settingsManager.isShowConfidenceLevels) {
      PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_CONFIDENCE_LEVELS, settingsManager.isShowConfidenceLevels.toString());
    } else {
      PersistenceManager.getInstance().removeItem(StorageKey.SETTINGS_CONFIDENCE_LEVELS);
    }
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DEMO_MODE, settingsManager.isDemoModeOn.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_SAT_LABEL_MODE, settingsManager.isSatLabelModeOn.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_FREEZE_PROP_RATE_ON_DRAG, settingsManager.isFreezePropRateOnDrag.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DISABLE_TIME_MACHINE_TOASTS, settingsManager.isDisableTimeMachineToasts.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_SEARCH_LIMIT, settingsManager.searchLimit.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.GRAPHICS_SETTINGS_GODRAYS_SAMPLES, settingsManager.godraysSamples.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.GRAPHICS_SETTINGS_GODRAYS_DECAY, settingsManager.godraysDecay.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.GRAPHICS_SETTINGS_GODRAYS_EXPOSURE, settingsManager.godraysExposure.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.GRAPHICS_SETTINGS_GODRAYS_DENSITY, settingsManager.godraysDensity.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.GRAPHICS_SETTINGS_GODRAYS_WEIGHT, settingsManager.godraysWeight.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.GRAPHICS_SETTINGS_GODRAYS_ILLUMINATION_DECAY, settingsManager.godraysIlluminationDecay.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.GRAPHICS_SETTINGS_EARTH_DAY_RESOLUTION, settingsManager.earthDayTextureQuality.toString());
    PersistenceManager.getInstance().saveItem(StorageKey.GRAPHICS_SETTINGS_EARTH_NIGHT_RESOLUTION, settingsManager.earthNightTextureQuality.toString());

    Doris.getInstance().emit(KeepTrackApiEvents.saveSettings);
  }

  colors: ColorSchemeColorMap & ObjectTypeColorSchemeColorMap;

  /**
   * The default color scheme to use when the application is loaded. This must be a string that matches a class name of one of the available color schemes.
   * Ex. DefaultColorScheme, CelestrakColorScheme, etc.
   */
  defaultColorScheme: 'CelestrakColorScheme';

  /** Ensures no html is injected into the page */
  isPreventDefaultHtml = false;
  /**
   * Delay before advancing in Time Machine mode
   */
  timeMachineDelay = <Milliseconds>5000;
  /**
   * Delay before advancing in Time Machine mode
   */
  timeMachineDelayAtPresentDay = <Milliseconds>20000;
  /**
   * Initial resolution of the map width to increase performance
   */
  mapWidth = 800;
  /**
   * Initial resolution of the map height to increase performance
   */
  mapHeight = 600;
  /**
   * Flag for loading the last sensor used by user
   */
  isLoadLastSensor = true;
  /**
   * Disable main user interface. Currently an all or nothing package.
   */
  disableUI = false;
  isMobileModeEnabled = false;
  /**
   * The last time the stereographic map was updated.
   *
   * TODO: This doesn't belong in the settings manager.
   */
  lastMapUpdateTime = 0;
  hiResWidth: number | null = null;
  hiResHeight: number | null = null;
  screenshotMode = null;
  lastBoxUpdateTime = null;
  /**
   * The initial field of view settings for FPS, Planetarium, Astronomy, and Satellite View
   */
  fieldOfView = 0.6;
  db = null;
  /**
   * Catch Errors and report them via github
   */
  isGlobalErrorTrapOn = true;
  /**
   * Determines whether or not the splash screen images should be displayed.
   * The text and version number still appear.
   */
  isShowSplashScreen = true;
  /**
   * Determines whether or not to show notional debris in the application. This was designed for presentation purposes.
   */
  isNotionalDebris = false;
  isFreezePropRateOnDrag = false;
  /**
   * Disable the optional ASCII catalog (only applies to offline mode)
   *
   * /tle/TLE.txt
   */
  isDisableAsciiCatalog = true;
  settingsManager = null;
  /**
   * Indicates whether or not Launch Agency and Payload Owners/Manufacturers should be displayed on globe.
   *
   * TODO: This needs to be revamped. Most agencies are not linked to any satellites!
   */
  isShowAgencies = false;
  /**
   * Determines whether or not to show Geo satellites in the application.
   */
  isShowGeoSats = true;
  /**
   * Determines whether or not to show HEO satellites in the application.
   */
  isShowHeoSats = true;
  /**
   * Determines whether or not to show MEO satellites in the application.
   */
  isShowMeoSats = true;
  /**
   * Determines whether or not to show LEO satellites in the application.
   */
  isShowLeoSats = true;
  /**
   * Determines whether or not to show Notional satellites in the application.
   * Notional satellites are satellites that haven't launched yet.
   */
  isShowNotionalSats = true;
  /**
   * Determines whether or not to show Vimpel satellites in the application.
   */
  isShowVimpelSats = true;
  /**
   * Determines whether or not to show Starlink satellites in the application.
   */
  isShowStarlinkSats = true;
  /**
   * Determines whether or not payloads should be displayed.
   */
  isShowPayloads = true;
  /**
   * Determines whether or not rocket bodies are shown.
   */
  isShowRocketBodies = true;
  /**
   * Determines whether or not debris is shown.
   */
  isShowDebris = true;
  /**
   * @deprecated
   * Maximum number of orbits to display when selecting "all" satellites
   */
  maxOribtsDisplayedDesktopAll = 1000;
  /**
   * Transparency when a group of satellites is selected
   */
  orbitGroupAlpha = 0.5;
  loopTimeMachine = false;
  isDisableSelectSat: boolean | null = null;
  timeMachineLongToast = false;
  lastInteractionTime = 0;
  /**
   * Disables the JSON Catalog (only applies to offline mode)
   *
   * /tle/extra.json
   */
  isDisableExtraCatalog = true;
  /**
   * Number of lines to draw when making an orbit
   *
   * Larger numbers will make smoother orbits, but will be more resource intensive
   */
  orbitSegments = 255;
  /**
   * The timestamp of the last gamepad movement.
   */
  lastGamepadMovement = 0;
  /**
   * Indicates whether the gamepad controls are limited or not.
   */
  isLimitedGamepadControls = false;
  /**
   * Toggles multiple presets for use with EPFL (École polytechnique fédérale de Lausanne).
   *
   * NOTE: This may be useful for other institutions as well or presentations.
   */
  isEPFL = false;
  isDisableUrlBar = null;
  /**
   * Add custom mesh list to force loading of specific meshes
   *
   * These can then be used in the mesh manager to force a specific mesh to be used
   */
  meshListOverride: string[] = [];
  isDebrisOnly = false;
  isDisableCss = null;
  /**
   * Allow Right Click Menu
   */
  isAllowRightClick = true;
  /**
   * Callback function that is called when the settings are loaded.
   */
  // eslint-disable-next-line no-empty-function
  onLoadCb = () => { };
  /**
   * Disables Toasts During Time Machine
   */
  isDisableTimeMachineToasts = false;
  isDrawConstellationBoundaries = null;
  isDrawNasaConstellations = null;
  /**
   * Determines whether or not to draw the sun in the application.
   */
  isDrawSun = true;
  /**
   * Determines how many draw commands are used for sun illumination
   * This should be a GodraySamples value (16, 32, 64, 128)
   * @default 16
   */
  godraysSamples = 16;
  /**
   * The decay factor for the godray effect.
   *
   * This value controls how fast the godray intensity decreases with distance.
   * Lower values result in shorter/less visible godrays, while higher values
   * create longer/more prominent godrays.
   *
   * @default 0.983
   */
  godraysDecay = 0.983;
  /**
   * The exposure level for the godrays effect.
   * Controls the brightness/intensity of the godray rendering.
   * Higher values make godrays more pronounced.
   * @default 0.75.
   */
  godraysExposure = 0.75;
  /**
   * The density of godrays effect.
   * Controls the intensity and thickness of the light scattering effect.
   * Higher values result in more pronounced godrays.
   * @default 1.8
   */
  godraysDensity = 1.8;
  /**
   * The weight factor for the godray effect.
   * Controls the intensity of the godray/light scattering effect.
   * Higher values increase the visibility of godrays.
   * @default 0.085
   */
  godraysWeight = 0.085;
  /**
   * Represents the rate at which the intensity of godrays (volumetric light scattering) diminishes
   * with distance from the light source.
   *
   * Higher values make the godrays fade more quickly as they extend away from the light source.
   * Lower values allow the godrays to extend further with less intensity reduction.
   *
   * @default 2.7
   */
  godraysIlluminationDecay = 2.7;
  /**
   * The size of the sun in the simulation, represented as a scale factor.
   * A value of 0.9 indicates the sun is displayed at 90% of its default size.
   * A value of 1.1 indicates the sun is displayed at 110% of its default size.
   */
  sizeOfSun = 1.1;
  /**
   * Determines whether to use a sun texture.
   * When set to true, the application will render the sun with a custom texture.
   * When set to false, the application will use a default sun representation.
   * @default false
   */
  isUseSunTexture = false;
  /**
   * Draw Lines from Sensors to Satellites When in FOV
   */
  isDrawInCoverageLines = true;
  /**
   * Determines whether or not to draw orbits.
   */
  isDrawOrbits = true;
  /**
   * Display ECI coordinates on object hover
   */
  isEciOnHover = false;
  /**
   * Determines whether the Milky Way should be drawn on the screen.
   */
  isDrawMilkyWay = true;
  /**
   * Determines whether the background of the canvas should be gray or black.
   *
   * NOTE: This is only used when the Milky Way is not drawn.
   */
  isGraySkybox = false;
  /**
   * Global flag for determining if the user is dragging the globe
   */
  isDragging = false;
  /**
   * Show orbits in ECF vs ECI
   */
  isOrbitCruncherInEcf = false;
  lastSearch: string | string[] = '';
  isGroupOverlayDisabled: boolean | null = null;
  /**
   * Distance from satellite when we switch to close camera mode.
   * This is used to slow down the dolly effect when zooming in on a satellite.
   */
  nearZoomLevel = 25 as Kilometers;
  isPreventColorboxClose = false;
  isDayNightToggle = false;
  isUseHigherFOVonMobile = null;
  lostSatStr = '';
  maxOribtsDisplayed = 100000;
  isOrbitOverlayVisible = false;
  isShowSatNameNotOrbit = null;
  /**
   * Determines whether or not to show the next pass time when hovering over an object.
   *
   * This is proccess intensive and should be disabled on low end devices
   */
  isShowNextPass = false;
  dotsOnScreen = 0;
  versionDate = '';
  versionNumber = '';
  /**
   * Geolocation data of the user.
   */
  geolocation: SensorGeolocation = {
    lat: null,
    lon: null,
    alt: null,
    minaz: null,
    maxaz: null,
    minel: null,
    maxel: null,
    minrange: null,
    maxrange: null,
  };

  altMsgNum = null;
  altLoadMsgs = false;
  /**
   * Adjust to change camera speed of auto pan around earth
   */
  autoPanSpeed = 1;

  /**
   * Adjust to change camera speed of auto rotate around earth
   */
  autoRotateSpeed = 0.000075;
  /**
   * Determines whether or not to use lighter blue texture for the Earth.
   */
  blueImages = false;
  /**
   * The speed at which the camera decays.
   *
   * Reduce this give momentum to camera changes
   */
  cameraDecayFactor = 5;
  /**
   * The speed at which the camera moves.
   *
   * TODO: This needs to be made read-only and a sepearate internal camera variable should be used to handle
   * the logic when shift is pressed
   */
  cameraMovementSpeed = 0.003;
  /**
   * The minimum speed at which the camera moves.
   *
   * TODO: This needs to be made read-only and a sepearate internal camera variable should be used to handle
   * the logic when shift is pressed
   */
  cameraMovementSpeedMin = 0.005;
  /**
   * The distance the a satellites fov cone is drawn away from the earth.
   *
   * This is used to prevent the cone from clipping into the earth.
   *
   * You can adjust this value to make the cone appear closer or further away from the earth.
   *
   * Negative values will cause the cone to clip into the earth, but that may be desired for some use cases.
   */
  coneDistanceFromEarth = 15 as Kilometers;
  /**
   * Used for disabling the copyright text on screenshots and the map.
   */
  copyrightOveride = false;
  /**
   * Global flag for determining if the cruncher's loading is complete
   */
  cruncherReady = false;
  /**
   * The current legend to display.
   */
  currentLegend = 'default';
  /**
   * The number of days before a TLE is considered lost.
   */
  daysUntilObjectLost = 60;
  /**
   * The number of milliseconds between each satellite in demo mode.
   */
  demoModeInterval = <Milliseconds>3000;
  /**
   * The maximum number of satellite labels to display on desktop devices.
   */
  desktopMaxLabels = 500;
  /**
   * The minimum width of the desktop view in pixels.
   */
  desktopMinimumWidth = 1300;
  /**
   * Currently only disables panning.
   *
   * TODO: Disable all camera movement
   */
  disableCameraControls = false;
  /**
   * Disable normal browser right click menu
   */
  disableDefaultContextMenu = true;
  /**
   * Disable normal browser events from keyboard/mouse
   */
  disableNormalEvents = false;
  /**
   * Disable Scrolling the Window Object
   */
  disableWindowScroll = true;
  /**
   * Disable Touch Move
   *
   * NOTE: Caused drag errors on Desktop
   */
  disableWindowTouchMove = true;
  /**
   * Disable Zoom Keyboard Keys
   */
  disableZoomControls = true;
  /**
   * The number of latitude segments used to render the Earth object.
   */
  earthNumLatSegs = 128;
  /**
   * The number of longitude segments used to render the Earth.
   */
  earthNumLonSegs = 128;
  /**
   * Updates Orbit of selected satellite on every draw.
   *
   * Performance hit, but makes it clear what direction the satellite is going
   */
  enableConstantSelectedSatRedraw = true;
  /**
   * Shows the oribt of the object when highlighted
   */
  enableHoverOrbits = true;
  /**
   * Shows an overlay with object information
   */
  enableHoverOverlay = true;
  /**
   * Indicates whether the fallback css is enabled. This only loads if isDisableCss is true.
   */
  enableLimitedUI = true;
  /**
   * Number of steps to fit TLEs in the Initial Orbit plugin
   */
  fitTleSteps = 3; // Increasing this will kill performance
  /**
   * Speed at which the camera moves in the Z direction when in FPS mode.
   */
  fpsForwardSpeed = 3;
  /**
   * Speed the camera pitches up and down when in FPS mode.
   */
  fpsPitchRate = 0.02;
  /**
   * Speed at which the camera rotates when in FPS mode.
   */
  fpsRotateRate = 0.02;
  /**
   * Speed at which the camera moves in the X direction when in FPS mode.
   */
  fpsSideSpeed = 2;
  /**
   * Minimum fps or sun/moon are skipped
   */
  fpsThrottle1 = 0;
  /**
   * Minimum fps or satellite velocities are ignored
   */
  fpsThrottle2 = 10;
  /**
   * Speed at which the camera moves in the Y direction when in FPS mode.
   */
  fpsVertSpeed = 2;
  /**
   * Speed at which the camera twists (yaws) when in FPS mode.
   */
  fpsYawRate = 0.02;
  /**
   * Global flag for determining if geolocation is being used
   */
  geolocationUsed = false;
  /**
   * Minimum elevation to for calculating DOPs in dop plugin
   */
  gpsElevationMask = <Degrees>15;
  /**
   * Determines whether to use default high resolution texture for the Earth.
   */
  hiresImages = false;
  /**
   * Determines whether to use default high resolution texture for the Earth minus clouds.
   */
  hiresNoCloudsImages = false;
  /**
   * Color of the dot when hovering over an object.
   */
  hoverColor = <[number, number, number, number]>[1.0, 1.0, 0.0, 1.0]; // Yellow
  /**
   * The relative path to the installation directory. This is necessary if the application is
   * a folder inside the main folder of the webserver.
   */
  installDirectory = '';
  dataSources = {
    /**
     * This is where the TLEs are loaded from
     *
     * It was previously: ${settingsManager.installDirectory}tle/TLE2.json`
     *
     * It can be loaded from a local file or a remote source
     */
    tle: 'https://api.keeptrack.space/v3/sats',
    /** url for an external TLE source */
    externalTLEs: '',
    /**
     * A boolean flag indicating whether only external TLEs (Two-Line Elements) should be used.
     * When set to `true`, the system will exclusively utilize external TLE data.
     * When set to `false`, the system may use internal or other sources of TLE data.
     */
    externalTLEsOnly: false,
    tleDebris: 'https://app.keeptrack.space/tle/TLEdebris.json',
    vimpel: 'https://api.keeptrack.space/v3/r2/vimpel.json',
    /** This determines if tle source is loaded to supplement externalTLEs  */
    isSupplementExternal: false,
  };
  telemetryServer = 'https://telemetry.keeptrack.space';
  /**
   * Determines whether or not to hide the propogation rate text on the GUI.
   */
  isAlwaysHidePropRate = false;
  /**
   * Determines whether the canvas should automatically resize when the window is resized.
   */
  isAutoResizeCanvas = true;
  /**
   * If true, hide the earth textures and make the globe black
   */
  isBlackEarth = false;
  /**
   * Determines whether or not to load the specularity map for the Earth.
   */
  isDrawSpecMap = true;
  /**
   * Determines whether or not to load the bump map for the Earth.
   */
  isDrawBumpMap = true;
  /**
   * Determines whether the atmosphere should be drawn or not.
   */
  isDrawAtmosphere = true;
  /**
   * Determines whether or not to draw the Aurora effect.
   */
  isDrawAurora = true;
  /**
   * Determines whether or not to run the demo mode.
   */
  isDemoModeOn = false;
  /**
   * Disables the loading of control site data
   */
  isDisableControlSites = false;
  /**
   * Disables the loading of launch site data
   */
  isDisableLaunchSites = false;
  /**
   * Disables the loading of sensor data
   */
  isDisableSensors = false;
  /**
   * Determines whether the application should use a reduced-draw mode.
   * If true, the application will use a less resource-intensive method of rendering.
   * If false, the application will use the default rendering method.
   */
  isDrawLess = false;
  isEnableConsole = false;
  /**
   * Determines whether the last map that was loaded should be loaded again on the next session.
   */
  isLoadLastMap = true;
  /**
   * Global flag for determining if the application is resizing
   */
  isResizing = false;
  /**
   * Determines whether or not to show the satellite labels.
   */
  isSatLabelModeOn = true;
  /**
   * Flag for showing the primary logo
   */
  isShowPrimaryLogo = true;
  /**
   * Flag for showing the secondary logo for partnerships
   */
  isShowSecondaryLogo = false;
  /**
   * Flag for using the debris catalog instead of the full catalog
   *
   * /tle/TLEdebris.json
   */
  isUseDebrisCatalog = false;
  /**
   * Determines whether zooming stops auto rotation in the application.
   */
  isZoomStopsRotation = true;
  /**
   * Changing the zoom with the mouse wheel will stop the camera from following the satellite.
   */
  isZoomStopsSnappedOnSat = false;
  /**
   * List of the last search results
   */
  lastSearchResults: number[] = [];
  /**
   * String to limit which satellites are loaded from the catalog
   */
  limitSats = '';
  /**
   * Minimum elevation to draw a line scan
   */
  lineScanMinEl = 5;
  /**
   * The speed at which the scan lines for radars move across the screen
   *
   * About 30 seconds to scan earth (arbitrary)
   *
   * (each draw will be +speed lat/lon)
   */
  lineScanSpeedRadar = 0.25;
  /**
   * The speed at which the scan lines for radars move across the screen
   *
   * About 6 seconds to scan earth (no source, just a guess)
   *
   * (each draw will be +speed lat/lon)
   */
  lineScanSpeedSat = 6;
  lkVerify = 0;
  lowPerf = false;
  /**
   * Determines whether to use default low resolution texture for the Earth.
   */
  lowresImages = false;
  /**
   * Preallocate the maximum number of analyst satellites that can be manipulated
   *
   * NOTE: This mainly applies to breakup scenarios
   */
  maxAnalystSats = 10000;
  /**
   * Preallocate the maximum number of field of view marker dots that can be displayed
   */
  maxFieldOfViewMarkers = 1;
  /**
   * Preallocate the maximum number of labels that can be displayed
   *
   * Set mobileMaxLabels and desktopMaxLabels instead of this directly
   */
  maxLabels = 0; // 20000;
  /**
   * Preallocate the maximum number of missiles that can be displayed
   *
   * NOTE: New attack scenarios are limited to this number
   */
  maxMissiles = 500;
  /**
   * The maximum number of orbits to display on mobile devices.
   */
  maxOrbitsDisplayedMobile = 1500;
  /**
   * The maximum number of orbits to be displayed on desktop.
   */
  maxOribtsDisplayedDesktop = 100000;
  /**
   * The maximum zoom distance from the Earth's surface in kilometers.
   *
   * Used for zooming in and out in default and offset camera modes.
   */
  maxZoomDistance = <Kilometers>120000;
  /**
   * Which mesh to use if meshOverride is set
   */
  meshOverride = null;
  /**
   * The rotation of the mesh if meshOverride is set
   */
  meshRotation = {
    x: 0,
    y: 0,
    z: 0,
  };

  /**
   * Minimum time between draw calls in milliseconds
   *
   * 20 FPS = 50ms
   * 30 FPS = 33.33ms
   * 60 FPS = 16.67ms
   */
  minimumDrawDt = <Milliseconds>0.0;
  /**
   * The minimum number of characters to type before searching.
   */
  minimumSearchCharacters = 2; // Searches after 3 characters typed
  /**
   * The minimum zoom distance from 0,0,0 in kilometers.
   *
   * Used for zooming in and out in default and offset camera modes.
   */
  minZoomDistance = <Kilometers>(RADIUS_OF_EARTH + 50);
  /**
   * Maximum number of satellite labels to display on mobile devices
   */
  mobileMaxLabels = 100;
  /**
   * Override the default models on satellite view
   */
  modelsOnSatelliteViewOverride = false;
  /**
   * Name of satellite category for objects not in the official catalog.
   */
  nameOfSpecialSats = 'Special Sats';
  /**
   * Determines whether or not to use NASA Blue Marble texture for the Earth.
   */
  nasaImages = false;
  /**
   * The number of passes to consider when determining lookangles.
   */
  nextNPassesCount = 5;
  noMeshManager = false;
  /**
   * TODO: Reimplement stars
   */
  isDisableStars = true;
  /** Flag to determine if external data is available */
  offline = false;
  /**
   * The offset in the x direction for the offset camera mode.
   */
  offsetCameraModeX = 15000;
  /**
   * The offset in the z direction for the offset camera mode.
   */
  offsetCameraModeZ = -6000;
  /**
   * How much an orbit fades over time
   *
   * 0.0 = Not Visible
   *
   * 1.0 = No Fade
   */
  orbitFadeFactor = 0.6;
  /**
   * Color of orbits when a group of satellites is selected.
   */
  orbitGroupColor = <[number, number, number, number]>[1.0, 1.0, 0.0, 0.7];
  /**
   * Color of orbit when hovering over an object.
   */
  orbitHoverColor = <[number, number, number, number]>[1.0, 1.0, 0.0, 0.9];
  /**
   * Color of orbit when in view.
   */
  orbitInViewColor = <[number, number, number, number]>[1.0, 1.0, 1.0, 0.7]; // WHITE
  /**
   * Color of orbit when in Planetarium View.
   */
  orbitPlanetariumColor = <[number, number, number, number]>[1.0, 1.0, 1.0, 0.2]; // Transparent White
  /**
   * Color of orbit when selected.
   */
  orbitSelectColor = <[number, number, number, number]>[1.0, 0.0, 0.0, 0.9];
  /**
   * Color of secondary object orbit.
   */
  orbitSelectColor2 = <[number, number, number, number]>[0.0, 0.4, 1.0, 0.9];
  /**
   * Determines whether or not to use political map texture for the Earth.
   */
  politicalImages = false;
  pTime = [];
  /**
   * Global flag for determining if a screenshot is queued
   */
  queuedScreenshot = false;
  retro = false;
  /**
   * Minimum time between new satellite labels in milliseconds
   */
  minTimeBetweenSatLabels = <Milliseconds>100;
  /**
   * The settings for the satellite shader.
   */
  satShader = {
    /**
     * The minimum zoom level at which large objects are displayed.
     */
    largeObjectMinZoom: 0.37,
    /**
     * The maximum zoom level at which large objects are displayed.
     */
    largeObjectMaxZoom: 0.58,
    /**
     * The minimum size of objects in the shader.
     */
    minSize: 5.5,
    /**
     * The minimum size of objects in the shader when in planetarium mode.
     */
    minSizePlanetarium: 5.5,
    /**
     * The maximum size of objects in the shader when in planetarium mode.
     */
    maxSizePlanetarium: 10.0,
    /**
     * The maximum allowed size of objects in the shader.
     * This value is dynamically changed based on zoom level.
     */
    maxAllowedSize: 35.0,
    /**
     * Whether or not to use dynamic sizing for objects in the shader.
     */
    isUseDynamicSizing: false,
    /**
     * The scalar value used for dynamic sizing of objects in the shader.
     */
    dynamicSizeScalar: 1.0,
    /**
     * The size of stars and searched objects in the shader.
     */
    starSize: '20.0',
    /**
     * The distance at which objects start to grow in kilometers.
     * Must be a float as a string for the GPU to read.
     * This makes stars bigger than satellites.
     */
    distanceBeforeGrow: '14000.0',
    /**
     * The blur radius factor used for satellites.
     */
    blurFactor1: '0.53',
    /**
     * The blur alpha factor used for satellites.
     */
    blurFactor2: '0.5',
    /**
     * The blur radius factor used for stars.
     */
    blurFactor3: '0.43',
    /**
     * The blur alpha factor used for stars.
     */
    blurFactor4: '0.25',
    /**
     * The maximum size of objects in the shader.
     */
    maxSize: 70.0,
  };

  /**
   * The maximum number of satellites to display when searching.
   */
  searchLimit = 600;
  /**
   * Color of the dot when selected.
   */
  selectedColor = <[number, number, number, number]>[1.0, 0.0, 0.0, 1.0]; // Red
  /**
   * Determines whether the orbit should be shown through the Earth or not.
   */
  showOrbitThroughEarth = false;
  /**
   * Determines whether small images should be used.
   *
   * Use these to default smallest resolution maps
   * Really useful on small screens and for faster loading times
   */
  smallImages = false;
  /**
   * Allows canvas will steal focus on load
   */
  startWithFocus = false;
  /**
   * Automatically display all of the orbits
   * This fires startWithOrbits in groups-manager.ts
   */
  startWithOrbitsDisplayed = false;
  brownEarthImages = false;
  /**
   * How many draw calls to wait before updating orbit overlay if last draw time was greater than 50ms
   */
  updateHoverDelayLimitBig = 5;
  /**
   * How many draw calls to wait before updating orbit overlay if last draw time was greater than 20ms
   */
  updateHoverDelayLimitSmall = 3;
  /**
   * Determines whether to use vector map texture for the Earth.
   */
  vectorImages = false;
  /**
   * Size of the dot vertex shader
   */
  vertShadersSize = 12;
  /**
   * The desired video bitrate in bits per second for video recording.
   *
   * This value is set to 30,000,000 bits per second (or 10.0 Mbps) by default.
   */
  videoBitsPerSecond = 30000000;
  /**
   * The maximum z-depth for the WebGL renderer.
   *
   * Increasing this causes z-fighting
   * Decreasing this causes clipping of stars and satellites
   */
  zFar = 450000.0;
  /**
   * The minimum z-depth for the WebGL renderer.
   */
  zNear = 1.0;
  /**
   * The speed at which the zoom level changes when the user zooms in or out.
   */
  zoomSpeed = 0.0025;
  /**
   * Draw Trailing Orbits
   */
  isDrawTrailingOrbits = false;
  /**
   * Enables the old extended catalog including JSC Vimpel data
   * @deprecated Use isEnableJscCatalog instead
   */
  isEnableExtendedCatalog = false;
  selectedColorFallback = <[number, number, number, number]>[0, 0, 0, 0];
  /**
   * Flag if the keyboard should be disabled
   */
  isDisableKeyboard = false;
  /**
   * Flag for if the user is running inside an iframe
   */
  isInIframe = false;
  isAutoRotateL = true;
  isAutoRotateR = false;
  isAutoRotateU = false;
  isAutoRotateD = false;
  isAutoPanL = false;
  isAutoPanR = false;
  isAutoPanU = false;
  isAutoPanD = false;
  isAutoZoomIn = false;
  isAutoZoomOut = false;
  autoZoomSpeed = 0.00002;
  maxNotionalDebris = 100000;
  /**
   * This is an override for how many dot colors are calculated per draw loop.
   * Higher numbers will make the dots more accurate, but will slow down the simulation.
   */
  dotsPerColor: number;
  /**
   * Minimum distance from satellite when we switch to close camera mode
   * The camera will not be able to get closer than this distance
   */
  minDistanceFromSatellite = 1.25 as Kilometers;

  /**
   * Disable toast messages
   */
  isDisableToasts = false;
  /*
   * Enables the new JSC Vimpel catalog
   */
  isEnableJscCatalog = true;
  /**
   * Size of the dot for picking purposes
   */
  pickingDotSize: string = '16.0';

  /**
   * Disable drawing godrays (huge performance hit on mobile)
   */
  isDisableGodrays = false;
  isDisableSkybox = false;
  isDisableMoon = false;
  isDisableSearchBox = false;
  isDisableAsyncReadPixels = false;
  /**
   * Use 16K textures for the Milky Way
   */
  hiresMilkWay = false;
  /**
   * When set to true, only load satellites with the name "Starlink"
   */
  isStarlinkOnly = false;
  /**
   * Indicates whether to show confidence levels when hovering over an object.
   */
  isShowConfidenceLevels = true;
  /**
   * The container root element for the application
   * NOTE: This is for initializing it, but keepTrackApi.containerRoot will be used throughout
   * the application when looking for the container root element
   */
  containerRoot: HTMLDivElement;
  /**
   * The initial zoom level for the camera.
   * 0 = earth and 1 = max distance from earth
   */
  initZoomLevel: number;
  positionCruncher: Worker | null = null;
  orbitCruncher: Worker | null = null;
  /** Enables the camera widget */
  drawCameraWidget = false;

  loadPersistedSettings() {
    this.isDrawOrbits = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_ORBITS, this.isDrawOrbits) as boolean;
    this.drawCameraWidget = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_CAMERA_WIDGET, this.drawCameraWidget) as boolean;
    this.isDrawTrailingOrbits = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_TRAILING_ORBITS, this.isDrawTrailingOrbits) as boolean;
    this.isOrbitCruncherInEcf = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_ECF, this.isOrbitCruncherInEcf) as boolean;
    this.isDrawInCoverageLines = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_IN_COVERAGE_LINES, this.isDrawInCoverageLines) as boolean;
    this.isDrawSun = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_SUN, this.isDrawSun) as boolean;
    this.isDrawCovarianceEllipsoid = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_COVARIANCE_ELLIPSOID, this.isDrawCovarianceEllipsoid) as boolean;
    this.isBlackEarth = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_BLACK_EARTH, this.isBlackEarth) as boolean;
    this.isDrawAtmosphere = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_ATMOSPHERE, this.isDrawAtmosphere) as boolean;
    this.isDrawAurora = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_AURORA, this.isDrawAurora) as boolean;
    this.isDrawMilkyWay = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DRAW_MILKY_WAY, this.isDrawMilkyWay) as boolean;
    this.isGraySkybox = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_GRAY_SKYBOX, this.isGraySkybox) as boolean;
    this.isEciOnHover = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_ECI_ON_HOVER, this.isEciOnHover) as boolean;
    if (settingsManager.isShowConfidenceLevels) {
      this.isShowConfidenceLevels = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_CONFIDENCE_LEVELS, this.isShowConfidenceLevels) as boolean;
    } else {
      this.isShowConfidenceLevels = false;
    }
    this.isDemoModeOn = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DEMO_MODE, this.isDemoModeOn) as boolean;
    this.isSatLabelModeOn = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_SAT_LABEL_MODE, this.isSatLabelModeOn) as boolean;
    this.isFreezePropRateOnDrag = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_FREEZE_PROP_RATE_ON_DRAG, this.isFreezePropRateOnDrag) as boolean;
    this.isDisableTimeMachineToasts = PersistenceManager.getInstance().checkIfEnabled(StorageKey.SETTINGS_DISABLE_TIME_MACHINE_TOASTS, this.isDisableTimeMachineToasts) as boolean;

    const earthDayTextureQaulityString = PersistenceManager.getInstance().getItem(StorageKey.GRAPHICS_SETTINGS_EARTH_DAY_RESOLUTION);

    if (earthDayTextureQaulityString !== null) {
      this.earthDayTextureQuality = earthDayTextureQaulityString as EarthDayTextureQuality;
    }

    const earthNightTextureQaulityString = PersistenceManager.getInstance().getItem(StorageKey.GRAPHICS_SETTINGS_EARTH_NIGHT_RESOLUTION);

    if (earthNightTextureQaulityString !== null) {
      this.earthNightTextureQuality = earthNightTextureQaulityString as EarthNightTextureQuality;
    }

    const searchLimitString = PersistenceManager.getInstance().getItem(StorageKey.SETTINGS_SEARCH_LIMIT);

    if (searchLimitString !== null) {
      this.searchLimit = parseInt(searchLimitString);
    }
  }

  init(settingsOverride?: SettingsManagerOverride) {
    this.pTime = [];

    this.checkIfIframe_();
    this.setInstallDirectory_();
    this.setMobileSettings_();
    this.setColorSettings_();
    /**
     * Load Order:
     * URL Params > Local Storage > Default
     */
    this.loadPersistedSettings();

    if (settingsOverride) {
      this.loadOverrides_(settingsOverride);
    }

    const params = this.loadOverridesFromUrl_();

    this.initParseFromGETVariables_(params);

    // If No UI Reduce Overhead
    if (this.disableUI) {
      // LEAVE AT LEAST ONE TO PREVENT ERRORS
      this.maxFieldOfViewMarkers = 1;
      this.maxMissiles = 1;
      this.maxAnalystSats = 1;
    }

    // Disable resource intense plugins if lowPerf is enabled
    if (this.lowPerf) {
      this.plugins.sensorFov = false;
      this.plugins.sensorSurv = false;
      this.plugins.satelliteFov = false;
      this.maxFieldOfViewMarkers = 1;
    }

    this.loadLastMapTexture_();

    /*
     * Export settingsManager to everyone else
     * window.settingsManager = this;
     * Expose these to node if running in node
     */
    if (global) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (<any>global).settingsManager = this;
    }
  }

  private checkIfIframe_() {
    if (window.self !== window.top) {
      this.isInIframe = true;
      this.isShowPrimaryLogo = true;
    }
  }

  /**
   * Sets the color settings for the application. If the colors are not found in local storage or the version is outdated,
   * default colors are used and saved to local storage.
   *
   * @private
   */
  private setColorSettings_() {
    this.selectedColorFallback = this.selectedColor;

    this.colors = {} as ColorSchemeColorMap & ObjectTypeColorSchemeColorMap;
    try {
      const jsonString = PersistenceManager.getInstance().getItem(StorageKey.SETTINGS_DOT_COLORS);

      if (jsonString) {
        this.colors = JSON.parse(jsonString);
      }
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Settings Manager: Unable to get color settings - localStorage issue!');
    }
    if (!this.colors || Object.keys(this.colors).length === 0 || this.colors.version !== '1.4.5') {
      this.colors = {
        version: '1.4.5',
        length: 0,
        facility: [0.64, 0.0, 0.64, 1.0],
        sunlight100: [1.0, 1.0, 1.0, 0.7],
        sunlight80: [1.0, 1.0, 1.0, 0.4],
        sunlight60: [1.0, 1.0, 1.0, 0.1],
        starHi: [1.0, 1.0, 1.0, 1.0],
        starMed: [1.0, 1.0, 1.0, 0.85],
        starLow: [1.0, 1.0, 1.0, 0.65],
        sensor: [1.0, 0.0, 0.0, 1.0],
        sensorAlt: [0.0, 0.0, 1.0, 1.0],
        marker: [
          [0.2, 1.0, 1.0, 1.0],
          [1.0, 0.2, 1.0, 1.0],
          [1.0, 1.0, 0.2, 1.0],
          [0.2, 0.2, 1.0, 1.0],
          [0.2, 1.0, 0.2, 1.0],
          [1.0, 0.2, 0.2, 1.0],
          [0.5, 0.6, 1.0, 1.0],
          [0.6, 0.5, 1.0, 1.0],
          [1.0, 0.6, 0.5, 1.0],
          [1.0, 1.0, 1.0, 1.0],
          [0.2, 1.0, 1.0, 1.0],
          [1.0, 0.2, 1.0, 1.0],
          [1.0, 1.0, 0.2, 1.0],
          [0.2, 0.2, 1.0, 1.0],
          [0.2, 1.0, 0.2, 1.0],
          [1.0, 0.2, 0.2, 1.0],
          [0.5, 0.6, 1.0, 1.0],
          [0.6, 0.5, 1.0, 1.0],
        ],
        deselected: [1.0, 1.0, 1.0, 0],
        inFOV: [0.85, 0.5, 0.0, 1.0],
        inFOVAlt: [0.2, 0.4, 1.0, 1],
        payload: [0.2, 1.0, 0.0, 0.5],
        rocketBody: [0.2, 0.4, 1.0, 1],
        debris: [0.5, 0.5, 0.5, 1],
        unknown: [0.5, 0.5, 0.5, 0.85],
        pink: [1.0, 0.0, 0.6, 1.0],
        analyst: [1.0, 1.0, 1.0, 0.8],
        missile: [1.0, 1.0, 0.0, 1.0],
        missileInview: [1.0, 0.0, 0.0, 1.0],
        transparent: [1.0, 1.0, 1.0, 0.1],
        satHi: [1.0, 1.0, 1.0, 1.0],
        satMed: [1.0, 1.0, 1.0, 0.8],
        satLow: [1.0, 1.0, 1.0, 0.6],
        sunlightInview: [0.85, 0.5, 0.0, 1.0],
        penumbral: [1.0, 1.0, 1.0, 0.3],
        umbral: [1.0, 1.0, 1.0, 0.1],
        /*
         * DEBUG Colors
         * sunlight = [0.2, 0.4, 1.0, 1]
         * penumbral = [0.5, 0.5, 0.5, 0.85]
         * umbral = [0.2, 1.0, 0.0, 0.5]
         */
        gradientAmt: 0,
        /*
         * Gradients Must be Edited in color-scheme.js
         * apogeeGradient = [1.0 - this.colors.gradientAmt, this.colors.gradientAmt, 0.0, 1.0]
         * velGradient = [1.0 - this.colors.gradientAmt, this.colors.gradientAmt, 0.0, 1.0]
         */
        satSmall: [0.2, 1.0, 0.0, 0.65],
        confidenceHi: [0.0, 1.0, 0.0, 0.65],
        confidenceMed: [1.0, 0.4, 0.0, 0.65],
        confidenceLow: [1.0, 0.0, 0.0, 0.65],
        rcsXXSmall: [1.0, 0, 0, 0.6],
        rcsXSmall: [1.0, 0.2, 0, 0.6],
        rcsSmall: [1.0, 0.4, 0, 0.6],
        rcsMed: [0.2, 0.4, 1.0, 1],
        rcsLarge: [0, 1.0, 0, 0.6],
        rcsUnknown: [1.0, 1.0, 0, 0.6],
        lostobjects: [1, 0, 0, 0.8],
        inGroup: [1.0, 0.0, 0.0, 1.0],
        countryPRC: [1.0, 0, 0, 0.6],
        countryUS: [0.2, 0.4, 1.0, 1],
        countryCIS: [1.0, 1.0, 1.0, 1.0],
        countryOther: [0, 1.0, 0, 0.6],
        densityPayload: [0.15, 0.7, 0.8, 1.0],
        spatialDensityHi: [1, 0, 0, 1],
        spatialDensityMed: [1, 0.4, 0, 1],
        spatialDensityLow: [1, 1, 0, 0.9],
        spatialDensityOther: [0.8, 0.8, 0.8, 0.3],
        notional: [1, 0, 0, 0.8],
        starlink: [0.0, 0.8, 0.0, 0.8],
        starlinkNot: [0.8, 0.0, 0.0, 0.8],
      };

      if (this.isPreserveSettings) {
        PersistenceManager.getInstance().saveItem(StorageKey.SETTINGS_DOT_COLORS, JSON.stringify(this.colors));
      }
    }
  }

  /**
   * Loads overrides from the URL query string and applies them to the plugin settings.
   * @returns An array of query string parameters.
   */
  private loadOverridesFromUrl_() {
    const queryStr = window.location.search.substring(1);

    // URI Encode all %22 to ensure url is not broken
    const params = queryStr
      .split('%22')
      .map((item, index) => {
        if (index % 2 === 0) {
          return item;
        }

        return encodeURIComponent(item);

      })
      .join('')
      .split('&');

    const plugins = this.plugins;

    for (const param of params) {
      const key = param.split('=')[0];
      const val = param.split('=')[1];

      if (key === 'settingsManagerOverride') {
        const overrides = JSON.parse(decodeURIComponent(val));

        Object.keys(overrides.plugins)
          .filter((_key) => _key in plugins)
          .forEach((_key) => {
            if (typeof overrides.plugins[_key] === 'undefined') {
              return;
            }
            this.plugins[_key] = overrides.plugins[_key];
          });
      }
    }

    return params;
  }

  disableAllPlugins() {
    Object.keys(this.plugins).forEach((key) => {
      this.plugins[key] = false;
    });
  }

  /**
   * This is an initial parse of the GET variables to determine
   * critical settings. Other variables are checked later during catalogManagerInstance.init
   */
  // eslint-disable-next-line complexity
  private initParseFromGETVariables_(params: string[]) {
    if (!this.disableUI) {
      for (const param of params) {
        const key = param.split('=')[0];
        const val = param.split('=')[1];

        switch (key) {
          case 'preset':
            switch (val) {
              case 'ops-center':
                SettingsPresets.loadPresetOpsCenter(this);
                break;
              case 'education':
                SettingsPresets.loadPresetEducation(this);
                break;
              case 'outreach':
                SettingsPresets.loadPresetOutreach(this);
                break;
              case 'debris':
                SettingsPresets.loadPresetDebris(this);
                break;
              case 'dark-clouds':
                darkClouds(settingsManager);
                break;
              case 'startalk':
                starTalk(settingsManager);
                break;
              case 'million-year':
                SettingsPresets.loadPresetMillionYear(this);
                break;
              case 'million-year2':
                SettingsPresets.loadPresetMillionYear2(this);
                break;
              case 'facsat2':
                SettingsPresets.loadPresetFacSat2(this);
                break;
              case 'altitudes':
                SettingsPresets.loadPresetAltitudes_(this);
                break;
              case 'starlink':
                SettingsPresets.loadPresetStarlink(this);
                break;
              default:
                break;
            }
            break;
          case 'external-only':
            this.dataSources.externalTLEsOnly = true;
            break;
          case 'gp':
            this.dataSources.tle = decodeURIComponent(val);
            break;
          case 'tle':
            // Decode from UTF-8
            this.dataSources.externalTLEs = decodeURIComponent(val);
            break;
          case 'jsc':
            this.isEnableJscCatalog = val === 'true';
            break;
          case 'sat':
            Doris.getInstance().on(KeepTrackApiEvents.onCruncherReady, () => {
              setTimeout(() => {
                if (typeof val === 'string') {
                  const sccNum = parseInt(val);

                  if (sccNum >= 0) {
                    const id = keepTrackApi.getCatalogManager().sccNum2Id(sccNum.toString().padStart(5, '0'));

                    if (id && id >= 0) {
                      keepTrackApi.getPlugin(SelectSatManager)?.selectSat(id);
                    } else {
                      keepTrackApi.getUiManager().toast(`Invalid Satellite: ${val}`, ToastMsgType.error);
                    }
                  } else {
                    keepTrackApi.getUiManager().toast(`Invalid Satellite: ${val}`, ToastMsgType.error);
                  }
                }
              }, 2000);
            });
            break;
          case 'debug':
            this.plugins.debug = true;
            break;
          case 'nomarkers':
            this.maxFieldOfViewMarkers = 1;
            break;
          case 'noorbits':
            this.isDrawOrbits = false;
            break;
          case 'searchLimit':
            if (parseInt(val) > 0) {
              this.searchLimit = parseInt(val);
            } else {
              keepTrackApi.getUiManager().toast(`Invalid search limit: ${val}`, ToastMsgType.error);
            }
            break;
          case 'console':
            this.isEnableConsole = true;
            break;
          case 'godrays':
            this.godraysSamples = GetVariables.godrays(val);
            break;
          case 'smallImages':
            this.smallImages = true;
            break;
          case 'lowperf':
            this.isShowSplashScreen = false;
            this.isDrawMilkyWay = false;
            this.isDrawLess = true;
            this.zFar = 250000.0;
            this.noMeshManager = true;
            this.maxFieldOfViewMarkers = 1;
            this.smallImages = true;
            break;
          case 'hires':
            this.earthNumLatSegs = 128;
            this.earthNumLonSegs = 128;
            break;
          case 'nostars':
            this.isDisableStars = true;
            this.isDrawMilkyWay = false;
            break;
          case 'draw-less':
            this.isDrawMilkyWay = false;
            this.isDrawLess = true;
            this.zFar = 250000.0;
            this.noMeshManager = true;
            break;
          case 'draw-more':
            this.isDrawLess = false;
            this.noMeshManager = false;
            this.smallImages = false;
            this.isDrawMilkyWay = true;
            break;
          case 'hires-milky-way':
            this.hiresMilkWay = true;
            break;
          case 'vec':
            this.vectorImages = true;
            break;
          case 'political':
            this.politicalImages = true;
            break;
          case 'offline':
            this.offline = true;
            this.dataSources.tle = '/tle/tle.json';
            this.dataSources.vimpel = '/tle/vimpel.json';
            break;
          case 'notmtoast':
            this.isDisableTimeMachineToasts = true;
            break;
          case 'cpo':
            this.copyrightOveride = true;
            break;
          case 'logo':
            this.isShowPrimaryLogo = true;
            break;
          case 'noPropRate':
            this.isAlwaysHidePropRate = true;
            break;
          case 'supplement-data':
            this.dataSources.isSupplementExternal = true;
            break;
          case 'latest-sats':
            this.dataSources.tle = `https://api.keeptrack.space/v3/sats/latest/${val}`;
            this.isEnableJscCatalog = false;
            break;
          case 'CATNR':
            this.dataSources.externalTLEs = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${val}&FORMAT=3LE`;
            this.dataSources.externalTLEsOnly = true;
            break;
          case 'NAME':
            this.dataSources.externalTLEs = `https://celestrak.org/NORAD/elements/gp.php?NAME=${val}&FORMAT=3LE`;
            this.dataSources.externalTLEsOnly = true;
            break;
          case 'INTDES':
            this.dataSources.externalTLEs = `https://celestrak.org/NORAD/elements/gp.php?INTDES=${val}&FORMAT=3LE`;
            this.dataSources.externalTLEsOnly = true;
            break;
          case 'GROUP':
            this.dataSources.externalTLEs = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${val}&FORMAT=3LE`;
            this.dataSources.externalTLEsOnly = true;
            break;
          case 'SPECIAL':
            this.dataSources.externalTLEs = `https://celestrak.org/NORAD/elements/gp.php?SPECIAL=${val}&FORMAT=3LE`;
            this.dataSources.externalTLEsOnly = true;
            break;
          default:
        }
      }
    }
  }

  /**
   * Load the previously saved map texture.
   */
  private loadLastMapTexture_() {
    if (this.disableUI) {
      this.isLoadLastMap = false;
    }

    if (this.isLoadLastMap && !this.isDrawLess) {
      const lastMap = PersistenceManager.getInstance().getItem(StorageKey.LAST_MAP);

      switch (lastMap) {
        case 'blue':
          this.blueImages = true;
          break;
        case 'nasa':
          this.nasaImages = true;
          break;
        case 'low':
          this.lowresImages = true;
          break;
        case 'brown':
          this.brownEarthImages = true;
          break;
        case 'high':
          this.hiresImages = true;
          break;
        case 'high-nc':
          this.hiresNoCloudsImages = true;
          break;
        case 'vec':
          this.vectorImages = true;
          break;
        case 'political':
          this.politicalImages = true;
          break;
        // file deepcode ignore DuplicateCaseBody: The default image could change in the future
        default:
          this.lowresImages = true;
          break;
      }
    }

    // Make sure there is some map loaded!
    if (
      !this.blueImages &&
      !this.nasaImages &&
      !this.lowresImages &&
      !this.brownEarthImages &&
      !this.hiresImages &&
      !this.hiresNoCloudsImages &&
      !this.vectorImages &&
      !this.politicalImages &&
      !this.smallImages
    ) {
      this.lowresImages = true;
    }
  }

  /**
   * Sets the mobile settings based on the current window width.
   * If the window width is less than or equal to the desktop minimum width,
   * mobile mode is enabled and certain settings are adjusted accordingly.
   */
  private setMobileSettings_() {
    if (window.innerWidth <= this.desktopMinimumWidth) {
      this.disableWindowTouchMove = false;
      /*
       * this.maxFieldOfViewMarkers = 20000;
       * this.isDrawLess = true;
       * this.noMeshManager = true;
       */
    }
  }

  exportSettingsToJSON() {
    const settings = {};

    for (const key of Object.keys(this)) {
      settings[key] = this[key];
    }

    // Save the settings to a file
    const settingsBlob = new Blob([JSON.stringify(settings)], { type: 'application/json' });
    const url = URL.createObjectURL(settingsBlob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'settings.json';

    a.click();
  }

  private loadOverrides_(settingsOverride: SettingsManagerOverride) {
    // combine settingsOverride with window.settingsOverride
    const overrides = { ...settingsOverride, ...window.settingsOverride };
    // override values in this with overrides

    for (const key of Object.keys(overrides)) {
      if (key in this) {
        if (key === 'colors' || key === 'plugins') {
          // Merge the colors object
          this[key] = { ...this[key], ...overrides[key] };
        } else {
          this[key] = overrides[key];
        }
      }
    }
  }

  private setInstallDirectory_() {
    switch (window.location.host) {
      case 'dev.keeptrack.space':
      case 'www.dev.keeptrack.space':
      case 'keeptrack.space':
      case 'www.keeptrack.space':
        this.installDirectory = '/app/';
        break;
      case 'localhost':
      case '127.0.0.1':
        // Is node running? This must be some kind of test
        if (isThisNode()) {
          this.installDirectory = 'http://127.0.0.1:8080/';
        } else {
          /*
           * Comment Out the Next Two Lines if you are testing on a local server
           * and have the keeptrack files installed in a subdirectory
           */
          this.installDirectory = '/';
          // this.offline = true;
        }
        break;
      case 'darts.staging.dso.mil':
        this.installDirectory = '/keeptrack/';
        break;
      case 'thkruz.github.io':
      case 'www.thkruz.github.io':
        this.installDirectory = '/keeptrack.space/';
        break;
      case '':
        this.offline = true;
        this.isDisableAsciiCatalog = false;
        this.installDirectory = './';
        break;
      case 'poderespacial.fac.mil.co':
        SettingsPresets.loadPresetFacSat2(this);
        break;
      default:
        this.installDirectory = '/';
        break;
    }
    if (typeof this.installDirectory === 'undefined') {
      // Put Your Custom Install Directory Here
      this.installDirectory = '/';
    }
  }

  /**
   * Placeholder for overrides
   */
  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  timeMachineString(_yearStr: string): string | boolean {
    return false;
  }
}

// Create a type based on the parameters of SettingsManager (ignore methods)
export type SettingsManagerOverride = Partial<Omit<SettingsManager,
  'exportSettingsToJSON' | 'loadOverridesFromUrl_' | 'loadLastMapTexture_' | 'setEmbedOverrides_' | 'setMobileSettings_' | 'setInstallDirectory_' | 'setColorSettings_' |
  'checkIfIframe_' | 'initParseFromGETVariables_' | 'loadOverrides_' | 'setMobileSettings_' | 'setEmbedOverrides_' | 'loadLastMapTexture_' | 'setColorSettings_'>>;

// Export the settings manager instance

export const settingsManager = new SettingsManager();
