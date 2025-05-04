/* eslint-disable dot-notation */
import { KeepTrackApiEvents } from '@app/interfaces';
import { keepTrackApi } from '@app/keepTrackApi';
import { SatInfoBox } from '@app/plugins/select-sat-manager/sat-info-box';
import { SelectSatManager } from '@app/plugins/select-sat-manager/select-sat-manager';
import { ShortTermFences } from '@app/plugins/short-term-fences/short-term-fences';
import { defaultSat, defaultSensor } from './environment/apiMocks';
import { setupStandardEnvironment } from './environment/standard-env';
import { standardPluginSuite, websiteInit } from './generic-tests';
import { Doris } from '@app/doris/doris';

describe('ShortTermFences_class', () => {
  beforeEach(() => {
    keepTrackApi.containerRoot.innerHTML = '';
    setupStandardEnvironment([SelectSatManager, SatInfoBox]);
  });

  standardPluginSuite(ShortTermFences, 'ShortTermFences');
  //   standardPluginMenuButtonTests(ShortTermFences, 'ShortTermFences');

  it('should be able to closeAndDisable', () => {
    const stf = new ShortTermFences();

    websiteInit(stf);
    expect(() => stf['closeAndDisable_']()).not.toThrow();
  });

  it('should be able to handle setSensor', () => {
    const stf = new ShortTermFences();

    websiteInit(stf);
    expect(() => Doris.getInstance().emit(KeepTrackApiEvents.setSensor, null, null)).not.toThrow();
    expect(() => Doris.getInstance().emit(KeepTrackApiEvents.setSensor, defaultSensor, 1)).not.toThrow();
  });

  // test stfFormOnSubmit static method
  describe('stfFormOnSubmit', () => {
    it('should call the stfFormOnSubmit method on the ShortTermFences instance', () => {
      const stf = new ShortTermFences();

      websiteInit(stf);
      expect(() => stf['onSubmit_']()).not.toThrow();

      keepTrackApi.getSensorManager().setCurrentSensor(null);
      expect(() => stf['onSubmit_']()).not.toThrow();
    });
  });

  // test stfOnObjectLinkClick method
  describe('stfOnObjectLinkClick', () => {
    it('should call the stfOnObjectLinkClick method on the ShortTermFences instance', () => {
      const stf = new ShortTermFences();

      websiteInit(stf);
      expect(() => stf['stfOnObjectLinkClick_']()).not.toThrow();

      keepTrackApi.getSensorManager().setCurrentSensor(null);
      expect(() => stf['stfOnObjectLinkClick_']()).not.toThrow();

      keepTrackApi.getCatalogManager().getObject = jest.fn().mockReturnValue(defaultSat);
      keepTrackApi.getPlugin(SelectSatManager).selectSat(0);
      expect(() => stf['stfOnObjectLinkClick_']()).not.toThrow();
    });
  });
});
