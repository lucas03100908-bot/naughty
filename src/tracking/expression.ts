import type { Classifications } from '@mediapipe/tasks-vision';
import type { Blend } from '@/src/game/store';

const KEYS: (keyof Blend)[] = ['browDownLeft', 'browDownRight', 'mouthFrownLeft', 'mouthFrownRight', 'browInnerUp'];

/** Copies the blendshapes M1 cares about into `out`. Scoring (baseline, frown/sad) is M3. */
export function readBlendshapes(classifications: Classifications | undefined, out: Blend) {
  if (!classifications) return out;
  for (const c of classifications.categories) {
    if ((KEYS as string[]).includes(c.categoryName)) out[c.categoryName as keyof Blend] = c.score;
  }
  return out;
}

export const browDown = (b: Blend) => (b.browDownLeft + b.browDownRight) / 2;
export const mouthFrown = (b: Blend) => (b.mouthFrownLeft + b.mouthFrownRight) / 2;
