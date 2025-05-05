import { GetSatType, KeepTrackApiEvents, ToastMsgType } from '@app/interfaces';
import { keepTrackApi } from '@app/keepTrackApi';
import { getEl, hideEl, showEl } from '@app/lib/get-el';
import { CameraType } from '@app/singletons/camera';

import { Doris } from '@app/doris/doris';
import { CoreEngineEvents } from '@app/doris/events/event-types';
import { MissileObject } from '@app/singletons/catalog-manager/MissileObject';
import { errorManagerInstance } from '@app/singletons/errorManager';
import { UrlManager } from '@app/static/url-manager';
import { CruncerMessageTypes } from '@app/webworker/positionCruncher';
import { vec3 } from 'gl-matrix';
import { createSampleCovarianceFromTle, DetailedSatellite, DetailedSensor, LandObject, SpaceObjectType } from 'ootk';
import { KeepTrackPlugin } from '../KeepTrackPlugin';
import { SoundNames } from '../sounds/SoundNames';
import { TopMenu } from '../top-menu/top-menu';
import { SatInfoBox } from './sat-info-box';

/**
 * This is the class that manages the selection of objects.
 */
export class SelectSatManager extends KeepTrackPlugin {
  readonly id = 'SelectSatManager';
  dependencies_ = [];
  lastCssStyle = '';
  selectedSat = -1;
  private readonly noSatObj_ = <DetailedSatellite>(<unknown>{
    id: -1,
    missile: false,
    type: SpaceObjectType.UNKNOWN,
    static: false,
  });

  primarySatObj: DetailedSatellite | MissileObject = this.noSatObj_;
  /** Ellipsoid radii for the primary satellite in RCI coordinates */
  primarySatCovMatrix: vec3;
  secondarySat = -1;
  secondarySatObj: DetailedSatellite | null = null;
  /** Ellipsoid radii for the secondary satellite in RCI coordinates */
  secondarySatCovMatrix: vec3;
  private lastSelectedPrimarySat_ = -1;
  private lastSelectedSecondarySat_ = -1;

  addJs(): void {
    super.addJs();

    this.registerKeyboardEvents_();

    Doris.getInstance().on(CoreEngineEvents.Update, () => {
      this.checkIfSelectSatVisible();

      if (this.primarySatObj.id !== -1) {
        const timeManagerInstance = keepTrackApi.getTimeManager();

        keepTrackApi.getUiManager().
          updateSelectBox(timeManagerInstance.realTime, timeManagerInstance.lastBoxUpdateTime, this.primarySatObj);
      }
    });

    Doris.getInstance().on(CoreEngineEvents.Update, () => {
      // If the selected satellite is not the same as the last selected satellite, run the event
      if (this.selectedSat !== this.lastSelectedPrimarySatId()) {
        Doris.getInstance().emit(KeepTrackApiEvents.onPrimarySatelliteChange, this.primarySatObj, this.selectedSat);
      }

      // If the primary satellite is an object, update it
      if (this.primarySatObj.id !== -1) {
        const timeManagerInstance = keepTrackApi.getTimeManager();
        const primarySat = keepTrackApi.getCatalogManager().getObject(this.primarySatObj.id, GetSatType.POSITION_ONLY) as DetailedSatellite | MissileObject;

        keepTrackApi.getMeshManager().update(timeManagerInstance.selectedDate, primarySat as DetailedSatellite);
        keepTrackApi.getMainCamera().snapToSat(primarySat, timeManagerInstance.simulationTimeObj);
        if (primarySat.isMissile()) {
          keepTrackApi.getOrbitManager().setSelectOrbit(primarySat.id);
        }

        // If in satellite view the orbit buffer needs to be updated every time
        if (!primarySat.isMissile() && (keepTrackApi.getMainCamera().cameraType === CameraType.SATELLITE ||
          keepTrackApi.getMainCamera().cameraType === CameraType.FIXED_TO_SAT)
        ) {
          keepTrackApi.getOrbitManager().updateOrbitBuffer(this.primarySatObj.id);
          const firstPointOut = [
            keepTrackApi.getDotsManager().positionData[this.primarySatObj.id * 3],
            keepTrackApi.getDotsManager().positionData[this.primarySatObj.id * 3 + 1],
            keepTrackApi.getDotsManager().positionData[this.primarySatObj.id * 3 + 2],
          ];

          keepTrackApi.getOrbitManager().updateFirstPointOut(this.primarySatObj.id, firstPointOut);
        }

        keepTrackApi.getScene().searchBox.update(primarySat, timeManagerInstance.selectedDate);

        keepTrackApi.getScene().primaryCovBubble.update(primarySat);
        Doris.getInstance().emit(KeepTrackApiEvents.onPrimarySatelliteUpdate, primarySat, primarySat.id);
      } else {
        keepTrackApi.getScene()?.searchBox.update(null);
      }

      // If the secondary satellite is not the same as the last selected satellite, run the event
      if (this.secondarySat !== this.lastSelectedSecondarySatId()) {
        Doris.getInstance().emit(KeepTrackApiEvents.onSecondarySatelliteChange, this.secondarySatObj, this.secondarySat);
      }

      // If the secondary satellite is an object, update it
      if (this.secondarySat > -1) {
        // TODO: Refactor this as a cb
        keepTrackApi.getScene().secondaryCovBubble?.update(this.secondarySatObj!);

        Doris.getInstance().emit(KeepTrackApiEvents.onSecondarySatelliteUpdate, this.secondarySatObj, this.secondarySat);
      }
    });
  }

  checkIfSelectSatVisible() {
    if (keepTrackApi.getPlugin(TopMenu)) {
      const currentSearch = keepTrackApi.getUiManager().searchManager?.getCurrentSearch();

      if (!currentSearch) {
        return;
      }

      // Base CSS Style based on if the search box is open or not
      let cssStyle = currentSearch.length > 0 ? 'display: block; max-height:auto;' : 'display: none; max-height:auto;';

      // If a satellite is selected on a desktop computer then shrink the search box
      if (window.innerWidth > 1000 && this.selectedSat !== -1) {
        cssStyle = cssStyle.replace('max-height:auto', 'max-height:27%');
      }

      // Avoid unnecessary dom updates
      if (cssStyle !== this.lastCssStyle && getEl(TopMenu.SEARCH_RESULT_ID)) {
        this.lastCssStyle = cssStyle;
      }
    }
  }

  selectPrevSat() {
    const satId = this.selectedSat - 1;

    if (satId >= 0) {
      this.selectSat(satId);
    } else {
      const activeSats = keepTrackApi.getCatalogManager().getActiveSats();
      const lastSatId = activeSats[activeSats.length - 1].id;

      this.selectSat(lastSatId);
    }
  }

  selectNextSat() {
    const activeSats = keepTrackApi.getCatalogManager().getActiveSats();
    const lastSatId = activeSats[activeSats.length - 1].id;
    const satId = this.selectedSat + 1;

    if (satId <= lastSatId) {
      this.selectSat(satId);
    } else {
      this.selectSat(0);
    }
  }

  selectSat(satId: number) {
    if (settingsManager.isDisableSelectSat) {
      return;
    }

    const obj = keepTrackApi.getCatalogManager().getObject(satId);

    if (!obj || !obj.active) {
      this.selectSatReset_();
    } else {

      if (obj.position.x === 0 && obj.position.y === 0 && obj.position.z === 0) {
        keepTrackApi.getUiManager().toast('Object is inside the Earth, cannot select it', ToastMsgType.caution);

        return;
      }

      // First thing we need to do is determine what type of SpaceObjectType we have
      switch (obj.type) {
        case SpaceObjectType.MECHANICAL:
        case SpaceObjectType.PHASED_ARRAY_RADAR:
        case SpaceObjectType.OPTICAL:
        case SpaceObjectType.OBSERVER:
        case SpaceObjectType.BISTATIC_RADIO_TELESCOPE:
        case SpaceObjectType.GROUND_SENSOR_STATION:
          this.selectSensorObject_(obj as DetailedSensor);
          keepTrackApi.getSoundManager()?.play(SoundNames.WHOOSH);

          return;
        case SpaceObjectType.PAYLOAD:
        case SpaceObjectType.ROCKET_BODY:
        case SpaceObjectType.DEBRIS:
        case SpaceObjectType.SPECIAL:
        case SpaceObjectType.NOTIONAL:
        case SpaceObjectType.UNKNOWN:
          showEl('actions-section');
          showEl('draw-line-links');
          this.selectSatObject_(obj as DetailedSatellite);
          break;
        case SpaceObjectType.PAYLOAD_OWNER:
        case SpaceObjectType.SUBORBITAL_PAYLOAD_OPERATOR:
        case SpaceObjectType.PAYLOAD_MANUFACTURER:
        case SpaceObjectType.METEOROLOGICAL_ROCKET_LAUNCH_AGENCY_OR_MANUFACTURER:
        case SpaceObjectType.INTERGOVERNMENTAL_ORGANIZATION:
          SelectSatManager.selectOwnerManufacturer_(obj as LandObject);

          return;
        case SpaceObjectType.STAR:
          return; // Do nothing
        case SpaceObjectType.BALLISTIC_MISSILE:
          hideEl('actions-section');
          hideEl('draw-line-links');
          this.selectSatObject_(obj as MissileObject);
          break;
        default:
          errorManagerInstance.log(`SelectSatManager.selectSat: Unknown SpaceObjectType: ${obj.type}`);

          return;
      }
    }

    const spaceObj = obj as DetailedSatellite | MissileObject;

    // Set the primary sat
    this.primarySatObj = spaceObj ?? this.noSatObj_;

    // Run any other callbacks
    Doris.getInstance().emit(KeepTrackApiEvents.selectSatData, spaceObj, spaceObj?.id);

    // Record the last selected sat
    this.lastSelectedPrimarySatId(this.selectedSat);
  }

  private selectSensorObject_(sensor: DetailedSensor) {
    // All sensors should have a sensorId
    if (!sensor.isSensor()) {
      errorManagerInstance.log(`SelectSatManager.selectSensorObject_: SensorObject does not have a sensorId: ${sensor}`);

      return;
    }

    // stop rotation if it is on
    keepTrackApi.getMainCamera().autoRotate(false);
    keepTrackApi.getMainCamera().panCurrent = {
      x: 0,
      y: 0,
      z: 0,
    };

    if (keepTrackApi.getMainCamera().cameraType === CameraType.DEFAULT) {
      keepTrackApi.getMainCamera().earthCenteredLastZoom = keepTrackApi.getMainCamera().zoomLevel();
      Doris.getInstance().emit(KeepTrackApiEvents.sensorDotSelected, sensor);
    }

    this.setSelectedSat_(-1);
    getEl('menu-sensor-info', true)?.classList.remove('bmenu-item-disabled');
    getEl('menu-fov-bubble', true)?.classList.remove('bmenu-item-disabled');
    getEl('menu-surveillance', true)?.classList.remove('bmenu-item-disabled');
    getEl('menu-planetarium', true)?.classList.remove('bmenu-item-disabled');
    getEl('menu-astronomy', true)?.classList.remove('bmenu-item-disabled');
  }

  private selectSatChange_(obj = null as DetailedSatellite | MissileObject | null) {
    const id = obj?.id ?? -1;

    keepTrackApi.getSoundManager()?.play(SoundNames.WHOOSH);

    if ((obj as DetailedSatellite)?.sccNum === '25544') {
      keepTrackApi.getSoundManager()?.play(SoundNames.CHATTER);
    } else {
      keepTrackApi.getSoundManager()?.stop(SoundNames.CHATTER);
    }

    SelectSatManager.updateCruncher_(id);
    this.updateDotSizeAndColor_(id);
    this.setSelectedSat_(id);

    // If deselecting a satellite, clear the selected orbit
    if (id === -1 && this.lastSelectedPrimarySat_ > -1) {
      keepTrackApi.getOrbitManager().clearSelectOrbit();
    }

    UrlManager.updateURL();
  }

  private selectSatReset_() {
    if (this.lastSelectedPrimarySatId() !== -1) {
      this.selectSatChange_(null);
    }

    // Run this ONCE when clicking empty space
    if (this.lastSelectedPrimarySatId() !== -1) {
      keepTrackApi.getMainCamera().exitFixedToSat();

      document.documentElement.style.setProperty('--search-box-bottom', '0px');
      keepTrackApi.getPlugin(SatInfoBox)?.hide();
    }

    this.setSelectedSat_(-1);
  }

  private selectSatObject_(sat: DetailedSatellite | MissileObject) {
    if (sat.id !== this.lastSelectedPrimarySatId()) {
      this.selectSatChange_(sat);
      if (sat.id >= 0 && sat instanceof DetailedSatellite) {
        const covMatrix = createSampleCovarianceFromTle(sat.tle1, sat.tle2).matrix.elements;

        // Cap radii at 1200 km (radial), 1000 km (cross-track), and 5000 km (in-track) to avoid huge bubbles
        const radii = [
          Math.min(Math.sqrt(covMatrix[0][0]) * settingsManager.covarianceConfidenceLevel, 1200), // Radial
          Math.min(Math.sqrt(covMatrix[2][2]) * settingsManager.covarianceConfidenceLevel, 1000), // Cross-track
          Math.min(Math.sqrt(covMatrix[1][1]) * settingsManager.covarianceConfidenceLevel, 5000), // In-track
        ] as vec3;

        this.primarySatCovMatrix = radii;

        const primaryCovBubble = keepTrackApi.getScene().primaryCovBubble;

        primaryCovBubble.setColor([1, 0, 0, 0.3]);
        primaryCovBubble.setRadii(keepTrackApi.getRenderer().gl, radii);
      }
    }


    // stop rotation if it is on
    keepTrackApi.getMainCamera().autoRotate(false);
    keepTrackApi.getMainCamera().panCurrent = {
      x: 0,
      y: 0,
      z: 0,
    };

    if (keepTrackApi.getMainCamera().cameraType === CameraType.DEFAULT) {
      keepTrackApi.getMainCamera().earthCenteredLastZoom = keepTrackApi.getMainCamera().zoomLevel();
      keepTrackApi.getMainCamera().cameraType = CameraType.FIXED_TO_SAT;
    }

    // If we deselect an object but had previously selected one then disable/hide stuff
    keepTrackApi.getMainCamera().camZoomSnappedOnSat = true;
    keepTrackApi.getMainCamera().camDistBuffer = settingsManager.minDistanceFromSatellite;
    keepTrackApi.getMainCamera().camAngleSnappedOnSat = true;

    if (sat instanceof DetailedSatellite) {
      keepTrackApi.analytics.track('select_satellite', {
        id: sat.id,
        name: sat.name,
        sccNum: sat.sccNum,
      });
    }

    this.setSelectedSat_(sat.id);
  }

  private static selectOwnerManufacturer_(obj: LandObject) {
    const catalogManagerInstance = keepTrackApi.getCatalogManager();
    const searchStr = catalogManagerInstance.objectCache
      .filter((_sat) => {
        const isOwner = (_sat as DetailedSatellite).owner === obj.Code;
        const isManufacturer = (_sat as DetailedSatellite).manufacturer === obj.Code; // TODO: This might not work anymroe without coutnry codes


        return isOwner || isManufacturer;
      })
      .map((_sat) => (_sat as DetailedSatellite).sccNum)
      .join(',');

    if (searchStr.length === 0) {
      keepTrackApi.getUiManager().toast('No satellites found for this owner/manufacturer', ToastMsgType.caution, false);
    } else {
      keepTrackApi.getUiManager().searchManager.doSearch(searchStr);
      keepTrackApi.getMainCamera().changeZoom(0.9);
    }
  }

  lastSelectedPrimarySatId(id?: number): number {
    if (typeof id !== 'undefined' && id !== null && id >= -1) {
      this.lastSelectedPrimarySat_ = id;
    }

    return this.lastSelectedPrimarySat_;
  }

  lastSelectedSecondarySatId(id?: number): number {
    if (typeof id !== 'undefined' && id !== null && id >= -1) {
      this.lastSelectedSecondarySat_ = id;
    }

    return this.lastSelectedSecondarySat_;
  }

  private static updateCruncher_(i: number) {
    keepTrackApi.getCatalogManager().satCruncher.postMessage({
      typ: CruncerMessageTypes.SATELLITE_SELECTED,
      satelliteSelected: [i],
    });
  }

  private updateDotSizeAndColor_(i: number) {
    const dotsManagerInstance = keepTrackApi.getDotsManager();
    const colorSchemeManagerInstance = keepTrackApi.getColorSchemeManager();
    const { gl } = keepTrackApi.getRenderer();

    gl.bindBuffer(gl.ARRAY_BUFFER, colorSchemeManagerInstance.colorBuffer);
    // If Old Select Sat Picked Color it Correct Color
    const lastSelectedObject = this.lastSelectedPrimarySatId();

    if (lastSelectedObject > -1) {
      colorSchemeManagerInstance.currentColorSchemeUpdate ??=
        colorSchemeManagerInstance.colorSchemeInstances[settingsManager.defaultColorScheme]?.update ??
        Object.values(colorSchemeManagerInstance.colorSchemeInstances)[0].update;

      const lastSat = keepTrackApi.getCatalogManager().getObject(lastSelectedObject);

      if (lastSat) {
        const newColor = colorSchemeManagerInstance.currentColorScheme.update(lastSat).color;

        colorSchemeManagerInstance.colorData[lastSelectedObject * 4] = newColor[0]; // R
        colorSchemeManagerInstance.colorData[lastSelectedObject * 4 + 1] = newColor[1]; // G
        colorSchemeManagerInstance.colorData[lastSelectedObject * 4 + 2] = newColor[2]; // B
        colorSchemeManagerInstance.colorData[lastSelectedObject * 4 + 3] = newColor[3]; // A
        gl.bufferSubData(gl.ARRAY_BUFFER, lastSelectedObject * 4 * 4, new Float32Array(newColor));

        if (!settingsManager.lastSearchResults.includes(lastSelectedObject)) {
          dotsManagerInstance.sizeData[lastSelectedObject] = 0.0;
          gl.bindBuffer(gl.ARRAY_BUFFER, dotsManagerInstance.buffers.size);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, dotsManagerInstance.sizeData);
        }
      }
    }
    // If New Select Sat Picked Color it
    if (i > -1) {
      if (i >= 0 && i < colorSchemeManagerInstance.colorData.length / 4) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dotsManagerInstance.buffers.color); // Ensure we are using the correct buffer
        gl.bufferSubData(gl.ARRAY_BUFFER, i * 4 * Float32Array.BYTES_PER_ELEMENT, new Float32Array(settingsManager.selectedColor));
      } else {
        throw new RangeError(`bufferSubData: Index out of bounds. Provided index: ${i}, valid range: 0 to ${colorSchemeManagerInstance.colorData.length / 4 - 1}`);
      }

      dotsManagerInstance.sizeData[i] = 1.0;
      gl.bindBuffer(gl.ARRAY_BUFFER, dotsManagerInstance.buffers.size);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dotsManagerInstance.sizeData);
    }
  }

  getSelectedSat(type = GetSatType.DEFAULT): DetailedSatellite | MissileObject {
    return keepTrackApi.getCatalogManager().getObject(this.selectedSat, type) as DetailedSatellite | MissileObject;
  }

  setSecondarySat(id: number): void {
    if (settingsManager.isDisableSelectSat) {
      return;
    }
    this.secondarySat = id;
    if (this.secondarySatObj?.id !== id) {
      this.secondarySatObj = keepTrackApi.getCatalogManager().getObject(id) as DetailedSatellite;

      if (!this.secondarySatObj) {
        this.secondarySatObj = null;
      }

      if ((this.secondarySatObj?.id ?? -1) >= 0 && this.secondarySatObj instanceof DetailedSatellite) {
        const covMatrix = createSampleCovarianceFromTle(this.secondarySatObj.tle1, this.secondarySatObj.tle2).matrix.elements;

        // Cap radii at 1200 km (radial), 1000 km (cross-track), and 5000 km (in-track) to avoid huge bubbles
        const radii = [
          Math.min(Math.sqrt(covMatrix[0][0]) * settingsManager.covarianceConfidenceLevel, 1200), // Radial
          Math.min(Math.sqrt(covMatrix[2][2]) * settingsManager.covarianceConfidenceLevel, 1000), // Cross-track
          Math.min(Math.sqrt(covMatrix[1][1]) * settingsManager.covarianceConfidenceLevel, 5000), // In-track
        ] as vec3;

        this.secondarySatCovMatrix = radii;

        const secondaryCovBubble = keepTrackApi.getScene().secondaryCovBubble;

        secondaryCovBubble.setColor([0, 0, 1, 0.4]);
        secondaryCovBubble.setRadii(keepTrackApi.getRenderer().gl, radii);
      }
    }

    if (this.secondarySat === this.selectedSat) {
      this.selectedSat = -1;
      this.setSelectedSat_(-1);
      keepTrackApi.getOrbitManager().clearSelectOrbit(false);
    }

    Doris.getInstance().emit(KeepTrackApiEvents.setSecondarySat, this.secondarySatObj, id);
  }

  private setSelectedSat_(id: number): void {
    if (settingsManager.isDisableSelectSat || id === null) {
      return;
    }
    this.selectedSat = id;

    if (this.selectedSat === this.secondarySat && this.selectedSat !== -1) {
      this.setSecondarySat(-1);
      keepTrackApi.getOrbitManager().clearSelectOrbit(true);
    }
  }

  switchPrimarySecondary(): void {
    const _primary = this.selectedSat;
    const _secondary = this.secondarySat;

    this.setSecondarySat(_primary);
    const orbitManagerInstance = keepTrackApi.getOrbitManager();

    if (_primary !== -1) {
      orbitManagerInstance.setSelectOrbit(_primary, true);
    } else {
      orbitManagerInstance.clearSelectOrbit(true);
    }
    this.setSelectedSat_(_secondary);
  }

  private registerKeyboardEvents_() {
    const inputManagerInstance = keepTrackApi.getInputManager();

    inputManagerInstance.keyboard.registerKeyDownEvent({
      key: ']',
      callback: () => {
        this.switchPrimarySecondary();
      },
    });
    inputManagerInstance.keyboard.registerKeyDownEvent({
      key: '[',
      callback: () => {
        this.switchPrimarySecondary();
      },
    });
  }
}
