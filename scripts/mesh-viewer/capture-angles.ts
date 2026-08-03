/* eslint-disable no-console */
/**
 * Multi-angle headless verification shots for one or more meshes, through the
 * standalone mesh viewer (engine-exact shader, scale and log depth).
 *
 * Four views per mesh, chosen to catch the failure modes docs-local/3d-model-authoring.md
 * documents rather than to look pretty:
 *   oblique  - the reference 3/4 view, sunlit
 *   far-side - yaw + PI: everything here should be the flat Kd*0.1 ambient floor.
 *              A face that stays BRIGHT from behind has an inverted normal.
 *   low45    - 45 deg from below, the angle where vertex-only log-depth sag
 *              turns into z-fighting bands / disappearing detail strips
 *   close    - half the framing distance, for cell grids and appendage joints
 *
 * Chromium MUST launch with --disable-gpu (swiftshader) or the first composited
 * WebGL context is lost and every shot is black.
 *
 *   PORT=5599 npx tsx scripts/mesh-viewer/capture-angles.ts <outDir> <name...>
 */
import { chromium } from 'playwright';

const PORT = Number.parseInt(process.env.PORT ?? '5599', 10);
const [outDir, ...names] = process.argv.slice(2);

if (!outDir || names.length === 0) {
  throw new Error('usage: capture-angles.ts <outDir> <name...>');
}

interface ViewerDebug {
  state: {
    currentName: string | null;
    model: { bboxMin: number[]; bboxMax: number[] } | null;
    /** yaw, pitch, dist, panX, panY - the viewer's orbit camera, in world km */
    cam: Record<string, number>;
    sunAz: number;
    sunEl: number;
  };
  renderFrame: () => void;
}

const VIEWS: { tag: string; yaw: number; pitch: number; distMul: number }[] = [
  { tag: 'oblique', yaw: 0.7, pitch: 0.4, distMul: 1.45 },
  { tag: 'far-side', yaw: 0.7 + Math.PI, pitch: 0.4, distMul: 1.45 },
  { tag: 'low45', yaw: 2.2, pitch: -0.78, distMul: 1.35 },
  { tag: 'close', yaw: 1.15, pitch: 0.25, distMul: 0.8 },
];

const main = async (): Promise<void> => {
  const browser = await chromium.launch({ args: ['--disable-gpu', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  let nav = 0;

  for (const name of names) {
    await page.goto(`http://localhost:${PORT}/?n=${nav++}#${encodeURIComponent(name)}`, { waitUntil: 'load' });
    await page.waitForFunction(
      (n) => {
        const dbg = (globalThis as { __viewerDebug?: ViewerDebug }).__viewerDebug;

        return dbg?.state.currentName === n && Boolean(dbg.state.model);
      },
      name,
      { timeout: 20_000 },
    );

    // The viewer's own HUD (mesh list, shading panel, material legend) covers
    // most of a 640px canvas; hide every overlay so the shot is only the model.
    await page.addStyleTag({ content: '#sidebar, .panel, #info, #materials, #controls, #cam, #hint, #error { display: none !important; }' });
    // The orientation axes are drawn INTO the canvas, so CSS cannot hide them -
    // untick the viewer's own toggle instead, or three coloured lines cross the shot.
    await page.evaluate(() => {
      const toggle = document.querySelector('#axes-toggle') as HTMLInputElement | null;

      if (toggle?.checked) {
        toggle.click();
      }
    });

    for (const view of VIEWS) {
      await page.evaluate((v) => {
        const dbg = (globalThis as { __viewerDebug?: ViewerDebug }).__viewerDebug;

        if (!dbg?.state.model) {
          throw new Error('viewer has no model loaded');
        }
        const bb = dbg.state.model;
        // The viewer aims at (panX, panY, 0), so pan onto the bbox centre in X and
        // Y. Z has no pan, so an off-centre-in-Z model is instead kept in frame by
        // widening the framing extent - otherwise it is silently cropped, which is
        // worse than a loose shot because the crop looks like missing geometry.
        const cx = (bb.bboxMin[0] + bb.bboxMax[0]) / 2;
        const cy = (bb.bboxMin[1] + bb.bboxMax[1]) / 2;
        const cz = (bb.bboxMin[2] + bb.bboxMax[2]) / 2;
        const extent =
          Math.max(bb.bboxMax[0] - bb.bboxMin[0], bb.bboxMax[1] - bb.bboxMin[1], bb.bboxMax[2] - bb.bboxMin[2]) +
          2 * Math.abs(cz);

        dbg.state.cam.panX = cx * 0.001;
        dbg.state.cam.panY = cy * 0.001;
        dbg.state.cam.yaw = v.yaw;
        dbg.state.cam.pitch = v.pitch;
        dbg.state.cam.dist = extent * 0.001 * v.distMul;
        dbg.state.sunAz = 40;
        dbg.state.sunEl = 35;
        dbg.renderFrame();
      }, view);
      await page.waitForTimeout(120);
      await page.locator('#canvas').screenshot({ path: `${outDir}/${name}-${view.tag}.png` });
    }
    console.log(`captured ${name} (${VIEWS.length} views)`);
  }

  await browser.close();
};

await main();
