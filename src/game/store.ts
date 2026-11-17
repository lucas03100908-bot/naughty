import { create } from 'zustand';

export type InputMode = 'none' | 'camera' | 'mouse';
export type TrackerStatus = 'idle' | 'loading' | 'running' | 'denied' | 'error';

export interface Blend {
  browDownLeft: number;
  browDownRight: number;
  mouthFrownLeft: number;
  mouthFrownRight: number;
  browInnerUp: number;
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
  blend: { browDownLeft: 0, browDownRight: 0, mouthFrownLeft: 0, mouthFrownRight: 0, browInnerUp: 0 } as Blend,
  trackFps: 0,
  renderFps: 0,
  /** performance.now() of the last recognised shake; the snow reacts to changes. */
  lastShakeAt: 0,
  shakeCount: 0,
};

export interface DebugEvent {
  id: number;
  t: number;
  label: string;
}

interface AppState {
  mode: InputMode;
  status: TrackerStatus;
  error: string | null;
  debugOpen: boolean;
  events: DebugEvent[];
  setMode: (m: InputMode) => void;
  setStatus: (s: TrackerStatus, error?: string | null) => void;
  toggleDebug: () => void;
  pushEvent: (label: string) => void;
}

let eventId = 0;

export const useApp = create<AppState>((set) => ({
  mode: 'none',
  status: 'idle',
  error: null,
  debugOpen: true,
  events: [],
  setMode: (mode) => set({ mode }),
  setStatus: (status, error = null) => set({ status, error }),
  toggleDebug: () => set((s) => ({ debugOpen: !s.debugOpen })),
  pushEvent: (label) =>
    set((s) => ({ events: [{ id: ++eventId, t: performance.now(), label }, ...s.events].slice(0, 8) })),
}));

/** Called by both camera and mouse input when a shake is recognised. */
export function emitShake(source: 'camera' | 'mouse') {
  live.lastShakeAt = performance.now();
  live.shakeCount += 1;
  useApp.getState().pushEvent(`흔들기 감지 #${live.shakeCount} (${source === 'camera' ? '머리' : '마우스'})`);
}
