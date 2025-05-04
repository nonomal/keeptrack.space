import { keepTrackContainer } from '@app/container';
import { Doris } from '@app/doris/doris';
import { KeepTrackApiEvents, Singletons } from '@app/interfaces';
import { keepTrackApi } from '@app/keepTrackApi';
import { DateTimeManager } from '@app/plugins/date-time-manager/date-time-manager';
import { SensorFov } from '@app/plugins/sensor-fov/sensor-fov';
import { SensorListPlugin } from '@app/plugins/sensor-list/sensor-list';
import { SensorManager } from '@app/plugins/sensor/sensorManager';
import { TopMenu } from '@app/plugins/top-menu/top-menu';
import { defaultSensor } from './environment/apiMocks';
import { setupStandardEnvironment } from './environment/standard-env';
import { standardPluginMenuButtonTests, standardPluginSuite, websiteInit } from './generic-tests';

describe('SensorFov_class', () => {
  let SensorFovPlugin: SensorFov;

  beforeEach(() => {
    setupStandardEnvironment([TopMenu, DateTimeManager, SensorListPlugin]);
    SensorFovPlugin = new SensorFov();
  });

  standardPluginSuite(SensorFov, 'SensorFov');
  standardPluginMenuButtonTests(SensorFov, 'SensorFov');

  // Test bottom menu click responses
  it('test_bottom_menu_click', () => {
    websiteInit(SensorFovPlugin);

    expect(() => Doris.getInstance().emit(KeepTrackApiEvents.bottomMenuClick, SensorFovPlugin.bottomIconElementName)).not.toThrow();

    const sensorManagerInstance = new SensorManager();

    sensorManagerInstance.isSensorSelected = jest.fn().mockReturnValue(true);
    keepTrackContainer.registerSingleton(Singletons.SensorManager, sensorManagerInstance);
    expect(() => Doris.getInstance().emit(KeepTrackApiEvents.bottomMenuClick, SensorFovPlugin.bottomIconElementName)).not.toThrow();
  });

  // Test changing sensor
  it('test_change_sensor', () => {
    websiteInit(SensorFovPlugin);

    expect(() => keepTrackApi.runEvent(KeepTrackApiEvents.setSensor, 'sensor', 1)).not.toThrow();
    expect(() => keepTrackApi.runEvent(KeepTrackApiEvents.setSensor, null, null)).not.toThrow();
    expect(() => keepTrackApi.runEvent(KeepTrackApiEvents.setSensor, defaultSensor, 0)).not.toThrow();
    expect(() => keepTrackApi.runEvent(KeepTrackApiEvents.setSensor, null, null)).not.toThrow();
    expect(() => keepTrackApi.runEvent(KeepTrackApiEvents.setSensor, defaultSensor, 2)).not.toThrow();
  });
});
