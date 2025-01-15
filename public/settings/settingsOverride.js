/**
 * // /////////////////////////////////////////////////////////////////////////////
 *
 * @Copyright (C) 2016-2024 Theodore Kruczek
 * @Copyright (C) 2020-2024 Heather Kruczek
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

// Settings Manager Overrides
const settingsOverride = {
  // Classification can be "Unclassified", "Secret", "Top Secret", "Top Secret//SCI"
  classificationStr: '',
  // This controls which of the built-in plugins are loaded
  plugins: {
    debug: false,
    satInfoboxCore: true,
    aboutManager: false,
    collisions: true,
    trackingImpactPredict: false,
    dops: false,
    findSat: true,
    launchCalendar: false,
    newLaunch: false,
    nextLaunch: false,
    nightToggle: false,
    photoManager: false,
    screenRecorder: true,
    satChanges: false,
    stereoMap: true,
    timeMachine: false,
    initialOrbit: false,
    missile: false,
    breakup: true,
    editSat: false,
    constellations: true,
    countries: true,
    colorsMenu: true,
    shortTermFences: false,
    orbitReferences: false,
    analysis: false,
    plotAnalysis: true,
    sensorFov: false,
    sensorSurv: false,
    satelliteFov: true,
    satelliteView: false,
    planetarium: true,
    astronomy: false,
    screenshot: true,
    watchlist: false,
    sensor: true,
    settingsMenu: true,
    datetime: true,
    social: false,
    topMenu: true,
    classificationBar: false,
    soundManager: true,
    gamepad: false,
    scenarioCreator: false,
    debrisScreening: false,
    videoDirector: false,
    reports: true,
    polarPlot: true,
    timeline: false,
    timelineAlt: false,
    transponderChannelData: true,
    calculator: false,
  },
  isEnableJscCatalog: false,
  colors: {
    version: '1.4.0',
    length: 0,
    facility: [0.64, 0.0, 0.64, 1.0],
    sunlight100: [1.0, 1.0, 1.0, 0.7],
    sunlight80: [1.0, 1.0, 1.0, 0.4],
    sunlight60: [1.0, 1.0, 1.0, 0.1],
    starHi: [1.0, 1.0, 1.0, 1.0],
    starMed: [1.0, 1.0, 1.0, 0.85],
    starLow: [1.0, 1.0, 1.0, 0.65],
    sensor: [1.0, 0.0, 0.0, 1.0],
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
    payload: [0.188, 0.929, 0.26, 1.0],
    rocketBody: [0.93, 0.2, 0.1, 1],
    debris: [0.47, 0.47, 0.47, 1],
    unknown: [1, 0.65, 0.17, 1],
    pink: [1, 0.65, 0.17, 1],
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
    age1: [0, 1.0, 0, 0.9],
    age2: [0.6, 0.996, 0, 0.9],
    age3: [0.8, 1.0, 0, 0.9],
    age4: [1.0, 1.0, 0, 0.9],
    age5: [1.0, 0.8, 0.0, 0.9],
    age6: [1.0, 0.6, 0.0, 0.9],
    age7: [1.0, 0.0, 0.0, 0.9],
    lostobjects: [0.2, 1.0, 0.0, 0.65],
    satLEO: [0.2, 1.0, 0.0, 0.65],
    satGEO: [0.2, 1.0, 0.0, 0.65],
    inGroup: [1.0, 0.0, 0.0, 1.0],
    countryPRC: [1.0, 0, 0, 0.6],
    countryUS: [0.2, 0.4, 1.0, 1],
    countryCIS: [1.0, 1.0, 1.0, 1.0],
    countryOther: [0, 1.0, 0, 0.6],
    densityPayload: [0.15, 0.7, 0.8, 1.0],
    densityHi: [1, 0, 0, 1],
    densityMed: [1, 0.4, 0, 1],
    densityLow: [1, 1, 0, 0.9],
    densityOther: [0.8, 0.8, 0.8, 0.3],
    notional: [1, 0, 0, 0.8],
    starlink: [0.0, 0.8, 0.0, 0.8],
    starlinkNot: [0.8, 0.0, 0.0, 0.8],
    celestrakDefaultActivePayload: [0.0, 1.0, 0.0, 0.85],
    celestrakDefaultInactivePayload: [1.0, 0.5, 0.0, 0.85],
    celestrakDefaultRocketBody: [1.0, 0.0, 0.0, 0.85],
    celestrakDefaultDebris: [0.5, 0.5, 0.5, 0.9],
    celestrakDefaultSensor: [0.0, 0.0, 1.0, 0.85],
    celestrakDefaultFov: [0.0, 0.0, 1.0, 0.85],
    celestrakDefaultUnknown: [1, 1, 1, 0.85],
  },
};

// Expose these to the console
window.settingsOverride = settingsOverride;
