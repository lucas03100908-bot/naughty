import type { Classifications } from '@mediapipe/tasks-vision';
import { JUDGE, TITLES } from '../game/constants.ts';

/** All 52 ARKit-style blendshape scores by name. */
export type Blend = Record<string, number>;

/** Copies every blendshape score into `out`. */
export function readBlendshapes(classifications: Classifications | undefined, out: Blend) {
  if (!classifications) return out;
  for (const c of classifications.categories) out[c.categoryName] = c.score;
  return out;
}

const mean = (b: Blend, names: string[]) => names.reduce((a, n) => a + (b[n] ?? 0), 0) / names.length;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const browDown = (b: Blend) => mean(b, ['browDownLeft', 'browDownRight']);
export const mouthFrown = (b: Blend) => mean(b, ['mouthFrownLeft', 'mouthFrownRight']);

const CHANNELS = {
  smile: ['mouthSmileLeft', 'mouthSmileRight'],
  brow: ['browDownLeft', 'browDownRight'],
  squint: ['eyeSquintLeft', 'eyeSquintRight', 'cheekSquintLeft', 'cheekSquintRight'],
  sneer: ['noseSneerLeft', 'noseSneerRight'],
} as const;

export interface SpiteParts {
  smile: number;
  brow: number;
  squint: number;
  sneer: number;
  closed: number;
  spite: number;
}

/**
 * 심술도 (0..1) for one frame, relative to the viewer's own baseline.
 * Smile and brow-down are multiplied (then square-rooted): the biggest share needs the
 * grin-while-frowning. A smile on its own still counts a little, so a first try isn't stuck at 0
 * (browDown is a weak blendshape and many faces barely move it). An open mouth damps it.
 */
export function spiteParts(b: Blend, base: Blend): SpiteParts {
  const ch = (k: keyof typeof CHANNELS) => clamp01((mean(b, [...CHANNELS[k]]) - mean(base, [...CHANNELS[k]])) / JUDGE.range[k]);
  const smile = ch('smile');
  const brow = ch('brow');
  const squint = ch('squint');
  const sneer = ch('sneer');
  const closed = 1 - clamp01((b.jawOpen ?? 0) / JUDGE.jawOpenFull);
  const w = JUDGE.weights;
  const spite = clamp01((w.grin * Math.sqrt(smile * brow) + w.smile * smile + w.squint * squint + w.sneer * sneer) * (0.75 + 0.25 * closed));
  return { smile, brow, squint, sneer, closed, spite };
}

/** Accumulates a baseline (mean of samples). */
export class BaselineRecorder {
  private sum: Blend = {};
  private n = 0;
  add(b: Blend) {
    for (const k in b) this.sum[k] = (this.sum[k] ?? 0) + b[k];
    this.n++;
  }
  result(): Blend {
    const out: Blend = {};
    for (const k in this.sum) out[k] = this.sum[k] / Math.max(1, this.n);
    return out;
  }
  get samples() {
    return this.n;
  }
}

/** Tracks peak and time above threshold during the grin. Time-weighted, so frame rate doesn't matter. */
export class SpiteScorer {
  peak = 0;
  heldSec = 0;
  totalSec = 0;
  add(spite: number, dt: number) {
    this.peak = Math.max(this.peak, spite);
    this.totalSec += dt;
    if (spite >= JUDGE.threshold) this.heldSec += dt;
  }
  get heldShare() {
    return this.totalSec > 0 ? this.heldSec / this.totalSec : 0;
  }
  get points() {
    return Math.round(JUDGE.maxPoints * (JUDGE.peakShare * this.peak + JUDGE.holdShare * this.heldShare));
  }
}

export function titleFor(total: number) {
  let name = TITLES[0].name;
  for (const t of TITLES) if (total >= t.min) name = t.name;
  return name;
}
