import { create } from 'zustand';
import { PLAY, VIDEO, VIEW } from './constants';
import { prankPoints, type PrankId } from './scoring';

export type InputMode = 'none' | 'camera' | 'mouse';
export type TrackerStatus = 'idle' | 'loading' | 'running' | 'denied' | 'error';
/** CLAUDE.md state machine. judge/reward are stubs until M3. */
export type Phase = 'intro' | 'start' | 'play' | 'judge' | 'reward';

export type { Blend } from '../tracking/expression';
import type { Blend } from '../tracking/expression';
import type { SpiteParts } from '../tracking/expression';

/** Judge sub-stages, by time since the judge began. */
export type JudgeStage = 'pull' | 'baseline' | 'grin' | 'outro';

export interface JudgeResult {
  peak: number;
  heldShare: number;
  points: number;
}

/**
 * High-frequency values written by the tracker / mouse input and read every frame by the
 * scene. Mutated in place on purpose: no React re-render per sample.
 */
export const live = {
  /** Head position relative to screen centre, cm. +x right, +y up, z = distance from screen. */
  head: { x: 0, y: 0, z: 55 },
  rollDeg: 0,
  yawDeg: 0,
  /** Signed snow flow from roll, [-1, 1]. */
  flow: 0,
  faceDetected: false,
  blend: {} as Blend,
  /** Latest face landmarks, normalized video coords, x/y interleaved (478 points). */
  landmarks: new Float32Array(478 * 2),
  landmarksAt: 0,
  trackFps: 0,
  renderFps: 0,
  /** performance.now() of the last recognised shake; the snow reacts to changes. */
  lastShakeAt: 0,
  shakeCount: 0,
  /** 0 = outside view, 1 = inside the village. Written by the camera rig. */
  viewBlend: 0,
  /** 심술도, smoothed (0..1). Drives the face filter, the storm and the score. */
  spite: 0,
  spiteParts: null as SpiteParts | null,
  /** Mouse fallback: the spite button is held. */
  holdingSpite: false,
  /** Snow storm (0..1) and village light (1 = normal) following spite. */
  storm: 0,
  villageLight: 1,
  /** Debug: force the filter strength (null = follow spite). */
  filterOverride: null as number | null,
};

export interface DebugEvent {
  id: number;
  t: number;
  label: string;
}

export interface PrankRecord {
  id: PrankId;
  elapsedSec: number;
  points: number;
}

/** A camera move between outside (0) and inside (1). */
export interface ViewMove {
  from: number;
  to: number;
  startAt: number;
  durationSec: number;
}

interface AppState {
  mode: InputMode;
  status: TrackerStatus;
  error: string | null;
  debugOpen: boolean;
  events: DebugEvent[];

  phase: Phase;
  phaseAt: number;
  playStartAt: number;
  pranks: PrankRecord[];
  view: ViewMove;
  /** Bumped on restart so props remount in their untouched state. */
  round: number;
  judgeStage: JudgeStage;
  judgeResult: JudgeResult | null;

  setMode: (m: InputMode) => void;
  setStatus: (s: TrackerStatus, error?: string | null) => void;
  toggleDebug: () => void;
  pushEvent: (label: string) => void;

  begin: () => void;
  fallbackDive: () => void;
  enterPlay: () => void;
  endPlay: () => void;
  setJudgeStage: (s: JudgeStage) => void;
  finishJudge: (r: JudgeResult) => void;
  restart: () => void;
  completePrank: (id: PrankId) => void;
}

let eventId = 0;
const now = () => performance.now();

export const useApp = create<AppState>((set, get) => ({
  mode: 'none',
  status: 'idle',
  error: null,
  debugOpen: false,
  events: [],

  phase: 'intro',
  phaseAt: 0,
  playStartAt: 0,
  pranks: [],
  view: { from: 0, to: 0, startAt: 0, durationSec: 1 },
  round: 0,
  judgeStage: 'pull',
  judgeResult: null,

  setMode: (mode) => set({ mode }),
  setStatus: (status, error = null) => set({ status, error }),
  toggleDebug: () => set((s) => ({ debugOpen: !s.debugOpen })),
  pushEvent: (label) =>
    set((s) => ({ events: [{ id: ++eventId, t: now(), label }, ...s.events].slice(0, 8) })),

  /** intro → start: Humbug's line, and the camera dives through the glass. */
  /**
   * intro → start: Humbug's line over the dive-in video. The camera jumps inside the globe once
   * the video fully covers the screen; VideoTransition ends the start phase when the video does.
   */
  begin: () => {
    if (get().phase !== 'intro') return;
    const t = now();
    set({ phase: 'start', phaseAt: t, pranks: [], view: { from: live.viewBlend, to: 1, startAt: t + VIDEO.fadeInSec * 1000, durationSec: 0.05 } });
    get().pushEvent('시작: 전환 영상');
  },
  /** The video couldn't play: fall back to the real-time 3D dive. */
  fallbackDive: () => {
    const t = now();
    set({ view: { from: live.viewBlend, to: 1, startAt: t, durationSec: VIEW.diveSec } });
    get().pushEvent('영상 없이 3D로 들어가기');
  },
  enterPlay: () => {
    if (get().phase !== 'start') return;
    const t = now();
    set({ phase: 'play', phaseAt: t, playStartAt: t });
    get().pushEvent(`플레이 ${PLAY.durationSec}초`);
  },
  /** play → judge: pull back out through the glass. */
  endPlay: () => {
    if (get().phase !== 'play') return;
    const t = now();
    set({ phase: 'judge', phaseAt: t, judgeStage: 'pull', judgeResult: null, view: { from: live.viewBlend, to: 0, startAt: t, durationSec: VIEW.pullSec } });
    get().pushEvent('플레이 끝: 밖으로');
  },
  setJudgeStage: (judgeStage) => {
    if (get().judgeStage === judgeStage) return;
    set({ judgeStage });
  },
  finishJudge: (judgeResult) => {
    if (get().phase !== 'judge') return;
    set({ phase: 'reward', phaseAt: now(), judgeResult });
    get().pushEvent(`심사 끝: ${judgeResult.points}점`);
  },
  restart: () => {
    const t = now();
    set((s) => ({
      phase: 'intro',
      phaseAt: t,
      pranks: [],
      judgeResult: null,
      round: s.round + 1,
      view: { from: live.viewBlend, to: 0, startAt: t, durationSec: VIEW.pullSec },
    }));
  },
  completePrank: (id) => {
    const s = get();
    if (s.phase !== 'play' || s.pranks.some((p) => p.id === id)) return;
    const elapsedSec = (now() - s.playStartAt) / 1000;
    set({ pranks: [...s.pranks, { id, elapsedSec, points: prankPoints(elapsedSec) }] });
    s.pushEvent(`장난: ${id} (${elapsedSec.toFixed(1)}초)`);
  },
}));

/**
 * Called by both camera and mouse input when a shake is recognised. Shaking the globe is an
 * idle-screen interaction (CLAUDE.md): it only does something in `intro`.
 */
export function emitShake(source: 'camera' | 'mouse') {
  if (useApp.getState().phase !== 'intro') return;
  live.lastShakeAt = now();
  live.shakeCount += 1;
  useApp.getState().pushEvent(`흔들기 감지 #${live.shakeCount} (${source === 'camera' ? '머리' : '마우스'})`);
}

export const totalPrankPoints = (pranks: PrankRecord[]) => pranks.reduce((a, p) => a + p.points, 0);
