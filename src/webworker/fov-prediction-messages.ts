/**
 * Message protocol for the FOV Prediction Web Worker.
 *
 * The worker computes "minutes until next FOV entry" for every satellite
 * in the catalog, caches entry/exit times, and incrementally updates
 * only stale entries when simulation time advances past a cached exit.
 */

import type { SensorObjectCruncher } from '../engine/core/interfaces';

// ─── Inbound Message Types ──────────────────────────────────────────────────

export const enum FovPredMsgType {
  /** Initialize with catalog TLE data and sensor configuration. */
  INIT = 0,
  /** Update simulation time (for cache invalidation). */
  UPDATE_TIME = 1,
  /** Cancel current computation. */
  CANCEL = 2,
}

export interface FovPredInitMsg {
  typ: FovPredMsgType.INIT;
  /** JSON string of CruncherSat[] (same format as position cruncher). */
  catalogJson: string;
  /** Active sensor(s) for FOV checks. */
  sensors: SensorObjectCruncher[];
  /** Current simulation time in ms since epoch. */
  simTimeMs: number;
  /** Max lookahead in minutes (default 120). */
  maxLookaheadMin: number;
  /** Time step for sweep in minutes (default 1). */
  sweepStepMin: number;
  /** Optional satellite indices to process first (e.g., watchlist). */
  priorityIndices?: number[];
}

export interface FovPredTimeMsg {
  typ: FovPredMsgType.UPDATE_TIME;
  /** Current simulation time in ms since epoch. */
  simTimeMs: number;
}

export interface FovPredCancelMsg {
  typ: FovPredMsgType.CANCEL;
}

export type FovPredInMsg = FovPredInitMsg | FovPredTimeMsg | FovPredCancelMsg;

// ─── Outbound Message Types ─────────────────────────────────────────────────

export const enum FovPredOutMsgType {
  /** Initial full sweep complete — all satellites processed. */
  FULL_SWEEP_COMPLETE = 0,
  /** Incremental update — stale entries recomputed. */
  INCREMENTAL_UPDATE = 1,
  /** Progress during initial sweep (0–1). */
  PROGRESS = 2,
  /** Priority satellites processed — partial results available. */
  PRIORITY_SWEEP_COMPLETE = 3,
}

export interface FovPredOutSweepMsg {
  typ: FovPredOutMsgType.FULL_SWEEP_COMPLETE | FovPredOutMsgType.INCREMENTAL_UPDATE | FovPredOutMsgType.PRIORITY_SWEEP_COMPLETE;
  /** Minutes to next FOV entry per satellite. Infinity = not in window. Transferred. */
  minutesToEntry: Float32Array;
}

export interface FovPredOutProgressMsg {
  typ: FovPredOutMsgType.PROGRESS;
  /** Progress fraction 0–1 during initial sweep. */
  progress: number;
}

export type FovPredOutMsg = FovPredOutSweepMsg | FovPredOutProgressMsg;
