import { CounterStage, CpuStage, FrameProfiler } from '@app/engine/utils/frame-profiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The profiler is a singleton; each test resets it to a clean, disabled state.
 * GPU timing is unavailable in jsdom (no WebGL context), so these cover the CPU
 * path, the enable/disable no-op contract, and snapshot statistics.
 */
describe('FrameProfiler', () => {
  const profiler = FrameProfiler.getInstance();

  beforeEach(() => {
    profiler.setEnabled(false);
    profiler.reset();
  });

  afterEach(() => {
    profiler.setEnabled(false);
    vi.restoreAllMocks();
  });

  /** Drives one frame that spends `ms` in a single CPU stage using a fake clock. */
  const runFrame = (dt: number, stage: string, ms: number): void => {
    let t = 1000;

    vi.spyOn(performance, 'now').mockImplementation(() => {
      const v = t;

      t += ms; // begin() reads t, end() reads t+ms

      return v;
    });
    profiler.frameStart(dt);
    profiler.beginCpu(stage);
    profiler.endCpu(stage);
    profiler.frameEnd();
    vi.restoreAllMocks();
  };

  it('is disabled by default and records nothing while off', () => {
    profiler.frameStart(16);
    profiler.beginCpu(CpuStage.camera);
    profiler.endCpu(CpuStage.camera);
    profiler.frameEnd();

    const snap = profiler.getSnapshot();

    expect(snap.enabled).toBe(false);
    expect(snap.frames).toBe(0);
    expect(snap.cpu).toHaveLength(0);
    expect(snap.gpu).toHaveLength(0);
  });

  it('records CPU stage timing and frame stats when enabled', () => {
    profiler.setEnabled(true);
    runFrame(16, CpuStage.camera, 5);

    const snap = profiler.getSnapshot();

    expect(snap.enabled).toBe(true);
    expect(snap.frames).toBe(1);

    const camera = snap.cpu.find((s) => s.id === CpuStage.camera);

    expect(camera).toBeDefined();
    expect(camera!.avg).toBeCloseTo(5, 3);
    expect(camera!.samples).toBe(1);
    expect(snap.frameTimeMs.avg).toBeCloseTo(16, 3);
    expect(snap.fps.avg).toBeCloseTo(1000 / 16, 1);
  });

  it('aggregates multiple frames into min/max/avg', () => {
    profiler.setEnabled(true);
    runFrame(10, CpuStage.sceneUpdate, 2);
    runFrame(20, CpuStage.sceneUpdate, 8);

    const scene = profiler.getSnapshot().cpu.find((s) => s.id === CpuStage.sceneUpdate);

    expect(scene!.samples).toBe(2);
    expect(scene!.min).toBeCloseTo(2, 3);
    expect(scene!.max).toBeCloseTo(8, 3);
    expect(scene!.avg).toBeCloseTo(5, 3);
  });

  it('sorts stages by descending average (bottleneck first)', () => {
    profiler.setEnabled(true);
    // Two stages in one frame with a controlled clock.
    const marks = [0, 2, 2, 10]; // fast begin/end, then slow begin/end
    let i = 0;

    vi.spyOn(performance, 'now').mockImplementation(() => marks[i++] ?? 10);
    profiler.frameStart(16);
    profiler.beginCpu(CpuStage.camera);
    profiler.endCpu(CpuStage.camera); // 2ms
    profiler.beginCpu(CpuStage.orbitsAbove);
    profiler.endCpu(CpuStage.orbitsAbove); // 8ms
    profiler.frameEnd();
    vi.restoreAllMocks();

    const cpu = profiler.getSnapshot().cpu;

    expect(cpu[0].id).toBe(CpuStage.orbitsAbove);
    expect(cpu[0].avg).toBeGreaterThan(cpu[1].avg);
  });

  it('reports GPU timing as unsupported without a WebGL context', () => {
    profiler.setEnabled(true);
    expect(profiler.gpuSupported).toBe(false);
    expect(profiler.getSnapshot().gpu).toHaveLength(0);
  });

  it('reset() clears accumulated samples and frame count', () => {
    profiler.setEnabled(true);
    runFrame(16, CpuStage.camera, 5);
    profiler.reset();

    const snap = profiler.getSnapshot();

    expect(snap.frames).toBe(0);
    expect(snap.cpu).toHaveLength(0);
  });

  it('accumulates counters within a frame and flushes one sample per frame', () => {
    profiler.setEnabled(true);
    // Two render passes in the same frame add up (multi-viewport)
    profiler.frameStart(16);
    profiler.addCounter(CounterStage.dots, 20000);
    profiler.addCounter(CounterStage.dots, 5000);
    profiler.frameEnd();
    // A lighter second frame
    profiler.frameStart(16);
    profiler.addCounter(CounterStage.dots, 10000);
    profiler.frameEnd();

    const dots = profiler.getSnapshot().counters.find((s) => s.id === CounterStage.dots);

    expect(dots).toBeDefined();
    expect(dots!.samples).toBe(2);
    expect(dots!.max).toBe(25000);
    expect(dots!.avg).toBeCloseTo(17500, 3);
  });

  it('records nothing for counters while disabled', () => {
    profiler.frameStart(16);
    profiler.addCounter(CounterStage.orbits, 100);
    profiler.frameEnd();

    expect(profiler.getSnapshot().counters).toHaveLength(0);
  });

  it('tallies frames slower than the 30fps budget as long frames', () => {
    profiler.setEnabled(true);
    runFrame(16, CpuStage.camera, 1);
    runFrame(50, CpuStage.camera, 1);
    runFrame(40, CpuStage.camera, 1);

    const snap = profiler.getSnapshot();

    expect(snap.frames).toBe(3);
    expect(snap.longFrames).toBe(2);
  });

  it('attributes tagged frame deltas to per-tag stats and the rest to untagged', () => {
    profiler.setEnabled(true);

    profiler.frameStart(50);
    profiler.tagFrame('cruncher-msg');
    profiler.frameEnd();

    profiler.frameStart(10);
    profiler.frameEnd();

    const tags = profiler.getSnapshot().frameTags;
    const cruncher = tags.find((t) => t.tag === 'cruncher-msg');
    const untagged = tags.find((t) => t.tag === 'untagged');

    expect(cruncher).toMatchObject({ samples: 1, longFrames: 1 });
    expect(cruncher!.avg).toBeCloseTo(50, 3);
    expect(cruncher!.max).toBeCloseTo(50, 3);
    expect(untagged).toMatchObject({ samples: 1, longFrames: 0 });
    expect(untagged!.avg).toBeCloseTo(10, 3);
  });

  it('attributes a tag set between frames to the next frame (cleared at frameEnd)', () => {
    profiler.setEnabled(true);

    profiler.frameStart(10);
    profiler.frameEnd();

    // Off-loop event lands after one frame ends and before the next starts.
    profiler.tagFrame('color-msg');

    profiler.frameStart(40);
    profiler.frameEnd();

    const tags = profiler.getSnapshot().frameTags;

    expect(tags.find((t) => t.tag === 'color-msg')).toMatchObject({ samples: 1, avg: 40, longFrames: 1 });
    expect(tags.find((t) => t.tag === 'untagged')).toMatchObject({ samples: 1, avg: 10 });
  });

  it('attributes one frame to every tag it carries', () => {
    profiler.setEnabled(true);

    profiler.frameStart(35);
    profiler.tagFrame('cruncher-msg');
    profiler.tagFrame('color-msg');
    profiler.frameEnd();

    const tags = profiler.getSnapshot().frameTags;

    expect(tags.find((t) => t.tag === 'cruncher-msg')).toMatchObject({ samples: 1, longFrames: 1 });
    expect(tags.find((t) => t.tag === 'color-msg')).toMatchObject({ samples: 1, longFrames: 1 });
    // A tagged frame is not also counted as untagged.
    expect(tags.find((t) => t.tag === 'untagged')).toBeUndefined();
  });

  it('records no frame tags while disabled and clears them on reset', () => {
    profiler.frameStart(50);
    profiler.tagFrame('cruncher-msg');
    profiler.frameEnd();

    expect(profiler.getSnapshot().frameTags).toHaveLength(0);

    profiler.setEnabled(true);
    profiler.frameStart(50);
    profiler.tagFrame('cruncher-msg');
    profiler.frameEnd();
    expect(profiler.getSnapshot().frameTags.length).toBeGreaterThan(0);

    profiler.reset();
    expect(profiler.getSnapshot().frameTags).toHaveLength(0);
  });
});
