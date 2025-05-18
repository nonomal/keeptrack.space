import { Doris } from '@app/doris/doris';
import { CoreEngineEvents } from '@app/doris/events/event-types';
import { ToastMsgType } from '@app/interfaces';
import { SatMath } from '@app/static/sat-math';
import { CruncerMessageTypes } from '@app/webworker/positionCruncher';
import { getDayOfYear, GreenwichMeanSiderealTime, Milliseconds } from 'ootk';
import { keepTrackApi } from '../../keepTrackApi';
import { getEl } from '../../lib/get-el';
import { DateTimeManager } from '../../plugins/date-time-manager/date-time-manager';
import { errorManagerInstance } from '../../singletons/errorManager';
import { UrlManager } from '../../static/url-manager';
import { KeepTrackApiEvents } from '../events/event-types';

export class TimeManager {
  static readonly id = 'TimeManager';
  dateDOM = null;
  datetimeInputDOM = <HTMLInputElement>null;
  /**
   * The real time at the moment when dynamicOffset or propRate changes
   */
  dynamicOffsetEpoch = <number>null;
  private iText = <number>null;
  lastPropRate = <number>1;
  /**
   * Time in Milliseconds the last time sim time was updated
   */
  private lastTime = <Milliseconds>0;
  propFrozen = 0;
  propOffset = 0;
  propRate0 = <number>null;
  /**
   * The time in the real world
   */
  realTime = <Milliseconds>0;
  selectedDate = new Date();
  /**
   * The time in the simulation
   *
   * simulationTime = realTime + staticOffset + dynamicOffset * propRate
   */
  simulationTimeObj = <Date>null;
  /**
   * The time offset ignoring propRate (ex. New Launch)
   */
  staticOffset = 0;
  private simulationTimeSerialized_ = <string>null;
  timeTextStr = <string>null;
  /**
   * Reusable empty text string to reduce garbage collection
   */
  private timeTextStrEmpty_ = <string>null;
  lastBoxUpdateTime = <Milliseconds>0;
  /**
   * dynamicOffset: The time offset that is impacted by propRate
   *
   * dynamicOffset = realTime - dynamicOffsetEpoch
   */
  private dynamicOffset_: number;
  isCreateClockDOMOnce_ = false;
  private isUpdateTimeThrottle_ = false;
  j: number;
  gmst: GreenwichMeanSiderealTime;

  constructor() {
    Doris.getInstance().on(CoreEngineEvents.BeforeUpdate, () => {
      if (!this.simulationTimeObj) {
        // TODO this happens at startup but should be prevented by not running the update loop until all components are ready
        return;
      }
      const { gmst, j } = SatMath.calculateTimeVariables(this.simulationTimeObj);

      this.gmst = gmst;
      this.j = j;
    });
  }

  static currentEpoch(currentDate: Date): [string, string] {
    const currentDateObj = new Date(currentDate);
    const epochYear = currentDateObj.getUTCFullYear().toString().slice(2, 4);
    const epochDay = getDayOfYear(currentDateObj);
    const timeOfDay = (currentDateObj.getUTCHours() * 60 + currentDateObj.getUTCMinutes()) / 1440;
    const epochDayStr = (epochDay + timeOfDay).toFixed(8).padStart(12, '0');


    return [epochYear, epochDayStr];
  }

  // Propagation Time Functions
  calculateSimulationTime(newSimulationTime?: Date): Date {
    if (typeof newSimulationTime !== 'undefined' && newSimulationTime !== null) {
      this.simulationTimeObj.setTime(newSimulationTime.getTime());

      return this.simulationTimeObj;
    }

    if (Doris.getInstance().getTimeManager().getTimeScale() === 0) {
      const simulationTime = this.dynamicOffsetEpoch + this.staticOffset;

      this.simulationTimeObj.setTime(simulationTime);
    } else {
      this.realTime = <Milliseconds>Date.now();
      this.dynamicOffset_ = this.realTime - this.dynamicOffsetEpoch;
      const simulationTime = this.dynamicOffsetEpoch + this.staticOffset + this.dynamicOffset_ * Doris.getInstance().getTimeManager().getTimeScale();

      this.simulationTimeObj.setTime(simulationTime);
    }

    return this.simulationTimeObj;
  }

  changePropRate(propRate: number) {
    if (Doris.getInstance().getTimeManager().getTimeScale() === propRate) {
      return;
    } // no change

    Doris.getInstance().getTimeManager().setTimeScale(propRate);

    this.staticOffset = this.simulationTimeObj.getTime() - Date.now();
    // Changing propRate or dynamicOffsetEpoch before calculating the staticOffset will give incorrect results
    this.dynamicOffsetEpoch = Date.now();
    this.calculateSimulationTime();

    this.synchronize();

    const toggleTimeDOM = getEl('toggle-time-rmb');

    if (!toggleTimeDOM) {
      errorManagerInstance.warn('Toggle time DOM not found');

      return;
    }

    if (Doris.getInstance().getTimeManager().getTimeScale() === 0) {
      toggleTimeDOM.childNodes[0].textContent = 'Start Clock';
    } else {
      toggleTimeDOM.childNodes[0].textContent = 'Pause Clock';
    }

    const uiManagerInstance = keepTrackApi.getUiManager();
    const currentTimeScale = Doris.getInstance().getTimeManager().getTimeScale();

    if (!settingsManager.isAlwaysHidePropRate && this.propRate0 !== currentTimeScale) {
      if (currentTimeScale > 1.01 || currentTimeScale < 0.99) {
        if (currentTimeScale < 10) {
          uiManagerInstance.toast(`Propagation Speed: ${currentTimeScale.toFixed(1)}x`, ToastMsgType.standby);
        }
        if (currentTimeScale >= 10 && currentTimeScale < 60) {
          uiManagerInstance.toast(`Propagation Speed: ${currentTimeScale.toFixed(1)}x`, ToastMsgType.caution);
        }
        if (currentTimeScale >= 60) {
          uiManagerInstance.toast(`Propagation Speed: ${currentTimeScale.toFixed(1)}x`, ToastMsgType.serious);
        }
      } else {
        uiManagerInstance.toast(`Propagation Speed: ${currentTimeScale.toFixed(1)}x`, ToastMsgType.normal);
      }

      if (!settingsManager.disableUI) {
        const datetimeTextElement = getEl('datetime-text', true);

        if (!datetimeTextElement) {
          errorManagerInstance.debug('Datetime text element not found');

          return;
        }

        if (!this.isCreateClockDOMOnce_) {
          datetimeTextElement.innerText = this.timeTextStr;
          this.isCreateClockDOMOnce_ = true;
        } else {
          datetimeTextElement.childNodes[0].nodeValue = this.timeTextStr;
        }
      }
    }

    UrlManager.updateURL();
  }

  static isLeapYear(dateIn: Date) {
    const year = dateIn.getUTCFullYear();

    if ((year & 3) !== 0) {
      return false;
    }

    return year % 100 !== 0 || year % 400 === 0;
  }

  changeStaticOffset(staticOffset: number) {
    this.dynamicOffsetEpoch = Date.now();
    this.staticOffset = staticOffset;
    this.calculateSimulationTime();
    this.synchronize();
    Doris.getInstance().emit(KeepTrackApiEvents.staticOffsetChange, this.staticOffset);
  }

  getOffsetTimeObj(offset: number) {
    // Make a time variable
    const now = new Date();
    // Set the time variable to the time in the future

    now.setTime(this.simulationTimeObj.getTime() + offset);

    return now;
  }

  getPropOffset(): number {
    if (!this.selectedDate) {
      return 0;
    }
    // Not using local scope caused time to drift backwards!

    return this.selectedDate.getTime() - Date.now();
  }

  init() {
    this.dynamicOffsetEpoch = Date.now();
    this.simulationTimeObj = new Date();

    this.timeTextStr = '';
    this.timeTextStrEmpty_ = '';

    this.propFrozen = Date.now(); // for when propRate 0
    this.realTime = <Milliseconds>this.propFrozen; // (initialized as Date.now)

    // Initialize
    this.calculateSimulationTime();
    this.setSelectedDate(this.simulationTimeObj);
    this.initializeKeyboardBindings_();

    Doris.getInstance().on(CoreEngineEvents.BeforeUpdate, () => {
      this.setNow(<Milliseconds>Date.now());
      if (!this.isUpdateTimeThrottle_) {
        this.isUpdateTimeThrottle_ = true;
        this.setSelectedDate(this.simulationTimeObj);
        setTimeout(() => {
          this.isUpdateTimeThrottle_ = false;
        }, 500);
      }
    });
  }

  private initializeKeyboardBindings_() {
    const keyboardManager = keepTrackApi.getInputManager().keyboard;

    keyboardManager.registerKeyEvent({
      key: 't',
      callback: () => {
        keepTrackApi.getUiManager().toast('Time Set to Real Time', ToastMsgType.normal);
        this.changeStaticOffset(0); // Reset to Current Time
      },
    });

    keyboardManager.registerKeyDownEvent({
      key: ',',
      callback: () => {
        this.calculateSimulationTime();
        const currentTimeScale = Doris.getInstance().getTimeManager().getTimeScale();

        let newPropRate = currentTimeScale;

        if (currentTimeScale < 0.001 && currentTimeScale > -0.001) {
          newPropRate = -0.001;
        }

        if (currentTimeScale < -1000) {
          newPropRate = -1000;
        }

        if (newPropRate < 0) {
          newPropRate = (currentTimeScale * 1.5);
        } else {
          newPropRate = ((currentTimeScale * 2) / 3);
        }

        const calendarInstance = keepTrackApi.getPlugin(DateTimeManager)?.calendar;

        if (calendarInstance) {
          calendarInstance.updatePropRate(newPropRate);
        } else {
          this.changePropRate(newPropRate);
        }
      },
    });

    keyboardManager.registerKeyDownEvent({
      key: '.',
      callback: () => {
        this.calculateSimulationTime();
        const currentTimeScale = Doris.getInstance().getTimeManager().getTimeScale();
        let newPropRate = currentTimeScale;

        if (currentTimeScale < 0.001 && currentTimeScale > -0.001) {
          newPropRate = 0.001;
        }

        if (currentTimeScale > 1000) {
          newPropRate = 1000;
        }

        if (newPropRate > 0) {
          newPropRate = (currentTimeScale * 1.5);
        } else {
          newPropRate = ((currentTimeScale * 2) / 3);
        }

        const calendarInstance = keepTrackApi.getPlugin(DateTimeManager)?.calendar;

        if (calendarInstance) {
          calendarInstance.updatePropRate(newPropRate);
        } else {
          this.changePropRate(newPropRate);
        }
      },
    });

    keyboardManager.registerKeyEvent({
      key: '<',
      callback: () => {
        this.calculateSimulationTime();
        this.changeStaticOffset(this.staticOffset - settingsManager.changeTimeWithKeyboardAmountBig);
        Doris.getInstance().emit(KeepTrackApiEvents.updateDateTime, new Date(this.dynamicOffsetEpoch + this.staticOffset));
      },
    });

    keyboardManager.registerKeyEvent({
      key: '>',
      callback: () => {
        this.calculateSimulationTime();
        this.changeStaticOffset(this.staticOffset + settingsManager.changeTimeWithKeyboardAmountBig);
        Doris.getInstance().emit(KeepTrackApiEvents.updateDateTime, new Date(this.dynamicOffsetEpoch + this.staticOffset));
      },
    });

    keyboardManager.registerKeyEvent({
      key: '/',
      callback: () => {
        let newPropRate: number;

        if (Doris.getInstance().getTimeManager().getTimeScale() === 1) {
          newPropRate = 0;
        } else {
          newPropRate = 1;
        }

        const calendarInstance = keepTrackApi.getPlugin(DateTimeManager)?.calendar;

        if (calendarInstance) {
          calendarInstance.updatePropRate(newPropRate);
        } else {
          this.changePropRate(newPropRate);
        }
        this.calculateSimulationTime();
      },
    });

    keyboardManager.registerKeyEvent({
      key: 'Equal',
      callback: () => {
        this.calculateSimulationTime();
        this.changeStaticOffset(this.staticOffset + settingsManager.changeTimeWithKeyboardAmountSmall);
        Doris.getInstance().emit(KeepTrackApiEvents.updateDateTime, new Date(this.dynamicOffsetEpoch + this.staticOffset));
      },
    });

    keyboardManager.registerKeyEvent({
      key: 'Minus',
      callback: () => {
        this.calculateSimulationTime();
        this.changeStaticOffset(this.staticOffset - settingsManager.changeTimeWithKeyboardAmountSmall);
        Doris.getInstance().emit(KeepTrackApiEvents.updateDateTime, new Date(this.dynamicOffsetEpoch + this.staticOffset));
      },
    });
  }

  setNow(realTime: Milliseconds) {
    this.realTime = realTime;
    this.lastTime = <Milliseconds>this.simulationTimeObj.getTime();

    // NOTE: This should be the only regular call to calculateSimulationTime!!
    this.calculateSimulationTime();
  }

  toggleTime() {
    const currentTimeScale = Doris.getInstance().getTimeManager().getTimeScale();

    if (currentTimeScale === 0) {
      this.changePropRate(this.lastPropRate);
    } else {
      this.lastPropRate = currentTimeScale;
      this.changePropRate(0);
    }

    const uiManagerInstance = keepTrackApi.getUiManager();

    if (currentTimeScale > 1.01 || currentTimeScale < 0.99) {
      if (currentTimeScale < 10) {
        uiManagerInstance.toast(`Propagation Speed: ${currentTimeScale.toFixed(1)}x`, ToastMsgType.standby);
      }
      if (currentTimeScale >= 10 && currentTimeScale < 60) {
        uiManagerInstance.toast(`Propagation Speed: ${currentTimeScale.toFixed(1)}x`, ToastMsgType.caution);
      }
      if (currentTimeScale >= 60) {
        uiManagerInstance.toast(`Propagation Speed: ${currentTimeScale.toFixed(1)}x`, ToastMsgType.serious);
      }
    } else {
      uiManagerInstance.toast(`Propagation Speed: ${currentTimeScale.toFixed(1)}x`, ToastMsgType.normal);
    }
  }

  setSelectedDate(selectedDate: Date) {
    this.selectedDate = selectedDate;

    // This function only applies when datetime plugin is enabled
    if (settingsManager.plugins.datetime) {
      if (this.lastTime - this.simulationTimeObj.getTime() < <Milliseconds>300) {
        this.simulationTimeSerialized_ = this.simulationTimeObj.toJSON();
        this.timeTextStr = this.timeTextStrEmpty_;
        for (this.iText = 11; this.iText < 20; this.iText++) {
          if (this.iText > 11) {
            this.timeTextStr += this.simulationTimeSerialized_[this.iText - 1];
          }
        }
        this.propRate0 = Doris.getInstance().getTimeManager().getTimeScale();
      }

      // Avoid race condition
      if (!this.dateDOM) {
        try {
          this.dateDOM = getEl('datetime-text');
          if (!this.dateDOM) {
            return;
          }
        } catch {
          errorManagerInstance.debug('Date DOM not found');

          return;
        }
      }

      // textContent doesn't remove the Node! No unecessary DOM changes everytime time updates.
      this.dateDOM.textContent = this.timeTextStr;

      // Load the current JDAY
      const jday = getDayOfYear(this.simulationTimeObj);

      getEl('jday').innerHTML = jday.toString();
    }

    // Passing datetimeInput eliminates needing jQuery in main module
    if (
      this.lastTime - this.simulationTimeObj.getTime() < 300 &&
      ((keepTrackApi.getPlugin(DateTimeManager))?.isEditTimeOpen || !settingsManager.cruncherReady || !keepTrackApi.getPlugin(DateTimeManager))
    ) {
      if (settingsManager.plugins.datetime) {
        if (!this.datetimeInputDOM) {
          this.datetimeInputDOM = <HTMLInputElement>getEl('datetime-input-tb', true);
        }
        if (!this.datetimeInputDOM) {
          this.datetimeInputDOM.value = `${this.selectedDate.toISOString().slice(0, 10)} ${this.selectedDate.toISOString().slice(11, 19)}`;
        }
      }
    }
  }

  synchronize() {
    const catalogManagerInstance = keepTrackApi.getCatalogManager();
    const orbitManagerInstance = keepTrackApi.getOrbitManager();

    const message = {
      typ: CruncerMessageTypes.OFFSET,
      staticOffset: this.staticOffset,
      dynamicOffsetEpoch: this.dynamicOffsetEpoch,
      propRate: Doris.getInstance().getTimeManager().getTimeScale(),
    };

    catalogManagerInstance.satCruncher.postMessage(message);

    /*
     * OrbitWorker starts later than the satCruncher so it might not be
     * ready yet.
     */
    if (orbitManagerInstance.orbitWorker) {
      orbitManagerInstance.orbitWorker.postMessage(message);
    }
  }
}
