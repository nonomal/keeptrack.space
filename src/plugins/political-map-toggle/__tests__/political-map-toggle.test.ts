import { EventBus } from '@app/engine/events/event-bus';
import { EventBusEvent } from '@app/engine/events/event-bus-events';
import { PoliticalMapToggle } from '@app/plugins/political-map-toggle/political-map-toggle';
import { setupStandardEnvironment } from '@test/environment/standard-env';
import { standardPluginSuite } from '@test/generic-tests';
import { vi } from 'vitest';

describe('PoliticalMapToggle', () => {
  beforeEach(() => {
    setupStandardEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  standardPluginSuite(PoliticalMapToggle, 'PoliticalMapToggle');
});

describe('PoliticalMapToggle methods', () => {
  let plugin: PoliticalMapToggle;

  beforeEach(() => {
    setupStandardEnvironment();
    plugin = new PoliticalMapToggle();
    plugin.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes its bottom-icon config and "l" shortcut and commands', () => {
    expect(plugin.getBottomIconConfig().elementName).toBe('political-map-toggle-bottom-icon');
    expect(plugin.getKeyboardShortcuts()[0].key).toBe('l');
    expect(() => plugin.getKeyboardShortcuts()[0].callback()).not.toThrow();
    expect(plugin.getCommandPaletteCommands().map((c) => c.id)).toEqual(['PoliticalMapToggle.cycle', 'PoliticalMapToggle.toggle', 'PoliticalMapToggle.toggleLabels']);
    plugin.getCommandPaletteCommands().forEach((c) => {
      expect(() => c.callback()).not.toThrow();
    });
  });

  it('cycles off -> borders -> borders+labels -> labels -> off', () => {
    settingsManager.isDrawPoliticalMap = false;
    settingsManager.isDrawPoliticalLabels = false;

    plugin.cycleMode();
    expect(settingsManager.isDrawPoliticalMap).toBe(true);
    expect(settingsManager.isDrawPoliticalLabels).toBe(false);

    plugin.cycleMode();
    expect(settingsManager.isDrawPoliticalMap).toBe(true);
    expect(settingsManager.isDrawPoliticalLabels).toBe(true);

    plugin.cycleMode();
    expect(settingsManager.isDrawPoliticalMap).toBe(false);
    expect(settingsManager.isDrawPoliticalLabels).toBe(true);

    plugin.cycleMode();
    expect(settingsManager.isDrawPoliticalMap).toBe(false);
    expect(settingsManager.isDrawPoliticalLabels).toBe(false);
  });

  it('toggles borders and labels independently via the palette commands', () => {
    settingsManager.isDrawPoliticalMap = false;
    settingsManager.isDrawPoliticalLabels = false;

    plugin.toggleBorders();
    expect(settingsManager.isDrawPoliticalMap).toBe(true);
    expect(settingsManager.isDrawPoliticalLabels).toBe(false);

    plugin.toggleCountryLabels();
    expect(settingsManager.isDrawPoliticalLabels).toBe(true);

    plugin.toggleBorders();
    expect(settingsManager.isDrawPoliticalMap).toBe(false);
    expect(settingsManager.isDrawPoliticalLabels).toBe(true);
  });

  it('bridges bottomIconCallback and syncs on uiManagerFinal', () => {
    const clickSpy = vi.spyOn(plugin, 'onBottomIconClick');

    plugin.bottomIconCallback();
    expect(clickSpy).toHaveBeenCalled();

    settingsManager.isDrawPoliticalMap = true;
    const selectSpy = vi.spyOn(plugin, 'setBottomIconToSelected');

    EventBus.getInstance().emit(EventBusEvent.uiManagerFinal);
    expect(selectSpy).toHaveBeenCalled();
  });
});
