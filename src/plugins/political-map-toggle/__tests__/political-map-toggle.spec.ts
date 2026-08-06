import { expect, test } from '@test/e2e/coverage';
import { waitForAppReady } from '@test/e2e/keeptrack-fixtures';

/** Cycle order implemented by PoliticalMapToggle: off -> borders -> borders+labels -> labels. */
const MODES = [
  { borders: false, labels: false },
  { borders: true, labels: false },
  { borders: true, labels: true },
  { borders: false, labels: true },
];

test.describe('PoliticalMapToggle', () => {
  test('utility icon cycles borders/labels through all four modes', async ({ page }) => {
    await waitForAppReady(page, {
      plugins: { PoliticalMapToggle: { enabled: true } },
    });

    // UTILITY_ONLY icon: #PoliticalMapToggle-utility-icon
    const utilityIcon = page.locator('#PoliticalMapToggle-utility-icon');

    await expect(utilityIcon).toBeVisible();
    await expect(utilityIcon).toHaveAttribute('data-plugin-id', 'political-map-toggle-bottom-icon');

    const readState = () =>
      page.evaluate(() => ({
        borders: (window as any).settingsManager?.isDrawPoliticalMap as boolean,
        labels: (window as any).settingsManager?.isDrawPoliticalLabels as boolean,
      }));

    const initial = await readState();
    let modeIdx = MODES.findIndex((m) => m.borders === initial.borders && m.labels === initial.labels);

    expect(modeIdx).toBeGreaterThanOrEqual(0);

    // Four clicks walk every mode and land back on the initial one
    for (let click = 0; click < 4; click++) {
      // biome-ignore lint/performance/noAwaitInLoops: each click must finish before checking the next mode
      await utilityIcon.dispatchEvent('click');
      modeIdx = (modeIdx + 1) % MODES.length;
      const expected = MODES[modeIdx];

      await expect(async () => {
        const state = await readState();

        expect(state).toEqual(expected);
      }).toPass({ timeout: 5_000 });
    }

    expect(await readState()).toEqual(initial);
  });
});
