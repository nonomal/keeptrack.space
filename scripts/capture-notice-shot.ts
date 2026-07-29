/**
 * capture-notice-shot: headless capture of a KeepTrack 3D view for publication.
 *
 * Drives the PUBLIC app at app.keeptrack.space (not the dev server) so the image
 * matches what a reader sees when they click the link in the article. That means
 * living with the production boot flow: the "Click to Begin" splash gate, the
 * onboarding modal, the ad slot and the toast strip all have to be dealt with
 * before the frame is worth keeping.
 *
 * Companion to keeptrack-catalog-db's `notice-to-article.ts`, which prints the
 * exact invocation it wants for a given NOTICE.
 *
 * Usage:
 *   npx tsx scripts/capture-notice-shot.ts --url "https://app.keeptrack.space/?search=2022-151" \
 *     --out ../keeptrack-home/src/assets/images/ktoc-notice/kt-20260711-62338-fra-3d-view.png
 *
 * Options:
 *   --url <url>       page to capture (default: the public app root)
 *   --out <path>      output PNG path (required)
 *   --width <px>      viewport width  (default 1600)
 *   --height <px>     viewport height (default 900)
 *   --scale <n>       device scale factor (default 1.5)
 *   --settle <ms>     wait after the splash click before capturing (default 30000)
 *   --wheel <n>       mouse-wheel notches over the canvas before capturing
 *                     (positive zooms out). A `?sat=` deep link parks the camera
 *                     close enough that Earth fills the frame; for a GEO object
 *                     the orbit reads better from further back.
 *   --canvas          also write a canvas-only crop next to the main file
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_URL = 'https://app.keeptrack.space/';

/**
 * Ad networks. Blocking the requests outright is what actually keeps ad frames
 * out of the capture: CSS alone still leaves the reserved slot painted as an
 * empty placeholder block, which on the `?sat=` view lands on top of the globe.
 */
const AD_HOSTS = [
  'googlesyndication.com',
  'doubleclick.net',
  'googletagservices.com',
  'googletagmanager.com',
  'adservice.google.com',
  'amazon-adsystem.com',
];

/**
 * Overlay chrome that must not appear in a published frame. Slot containers are
 * matched by their stable id prefixes (`div-gpt-ad-*`, `google_ads_iframe*`)
 * rather than by any single hard-coded id, because the GPT slot names are
 * generated per deploy.
 */
const SUPPRESS_CSS = `
  iframe[id^="google_ads_iframe"], div[id^="google_ads_iframe"],
  div[id^="div-gpt-ad-"], ins.adsbygoogle, .adsbygoogle,
  #sat-sponsor-data, #sat-sponsor-ad, [class*="sponsor"], [id*="sponsor"],
  [class*="ad-slot"], #ads-bottom, #ad-banner, .ad-container,
  .toast, #toast-container, .kt-toast, .snackbar,
  a[href*="remove-ads"], #remove-ads { display: none !important; visibility: hidden !important; }
`;

interface Options {
  url: string;
  out: string;
  width: number;
  height: number;
  scale: number;
  settleMs: number;
  wheel: number;
  canvas: boolean;
}

function parseArgs(argv: string[]): Options {
  const read = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const out = read('--out');
  if (!out) {
    console.error('capture-notice-shot: --out <path> is required');
    process.exit(1);
  }

  return {
    url: read('--url') ?? DEFAULT_URL,
    out,
    width: Number(read('--width') ?? 1600),
    height: Number(read('--height') ?? 900),
    scale: Number(read('--scale') ?? 1.5),
    settleMs: Number(read('--settle') ?? 30_000),
    wheel: Number(read('--wheel') ?? 0),
    canvas: argv.includes('--canvas'),
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });

  const browser = await chromium.launch({
    // SwiftShader keeps this runnable on headless boxes and CI without a GPU.
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: opts.scale,
    });

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (AD_HOSTS.some((host) => url.includes(host))) {
        route.abort().catch(() => { /* already handled */ });

        return;
      }
      route.continue().catch(() => { /* navigation raced */ });
    });

    console.log(`capture-notice-shot: ${opts.url}`);
    await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    // The splash button pulses, so it never reports "stable"; force past the check.
    const begin = page.getByText(/click to begin/iu).first();
    await begin.waitFor({ state: 'visible', timeout: 60_000 });
    await begin.click({ timeout: 10_000, force: true });

    await page.waitForTimeout(opts.settleMs);

    // First-visit onboarding modal. Absent for returning users, so failure is fine.
    try {
      const dismiss = page.getByText(/explore on my own/iu).first();
      if (await dismiss.isVisible({ timeout: 3000 })) {
        await dismiss.click({ force: true });
      }
    } catch {
      // No modal on this boot.
    }

    await page.addStyleTag({ content: SUPPRESS_CSS });

    if (opts.wheel !== 0) {
      // Wheel over the canvas centre; the camera eases, so step and let it settle.
      await page.mouse.move(opts.width / 2, opts.height / 2);
      const step = opts.wheel > 0 ? 120 : -120;
      for (let i = 0; i < Math.abs(opts.wheel); i++) {
        await page.mouse.wheel(0, step);
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(4000);
    }

    // Toasts fade on their own timer; the style rule hides any already on screen.
    await page.waitForTimeout(9000);

    await page.screenshot({ path: opts.out });
    console.log(`  wrote ${opts.out}`);

    if (opts.canvas) {
      const canvas = page.locator('#keeptrack-canvas');
      if (await canvas.count()) {
        const canvasOut = opts.out.replace(/\.png$/iu, '-canvas.png');
        await canvas.screenshot({ path: canvasOut });
        console.log(`  wrote ${canvasOut}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => {
  console.error('capture-notice-shot failed:', err);
  process.exit(1);
});
