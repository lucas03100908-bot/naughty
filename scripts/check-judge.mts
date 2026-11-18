// Headless check of the spite scoring.
//   node scripts/check-judge.mts
import { BaselineRecorder, SpiteScorer, spiteParts, titleFor } from '../src/tracking/expression.ts';

const neutral = { mouthSmileLeft: 0.05, mouthSmileRight: 0.06, browDownLeft: 0.04, browDownRight: 0.05, eyeSquintLeft: 0.1, eyeSquintRight: 0.1, cheekSquintLeft: 0.02, cheekSquintRight: 0.02, noseSneerLeft: 0.01, noseSneerRight: 0.01, jawOpen: 0.02 };
const smileOnly = { ...neutral, mouthSmileLeft: 0.7, mouthSmileRight: 0.7, cheekSquintLeft: 0.3, cheekSquintRight: 0.3 };
const frownOnly = { ...neutral, browDownLeft: 0.45, browDownRight: 0.45 };
const spiteGrin = { ...neutral, mouthSmileLeft: 0.65, mouthSmileRight: 0.6, browDownLeft: 0.4, browDownRight: 0.42, eyeSquintLeft: 0.45, eyeSquintRight: 0.45, cheekSquintLeft: 0.35, cheekSquintRight: 0.35, noseSneerLeft: 0.2, noseSneerRight: 0.2 };
const openGrin = { ...spiteGrin, jawOpen: 0.5 };
// A modest attempt: real faces often move browDown only a little while smiling.
const weakGrin = { ...neutral, mouthSmileLeft: 0.4, mouthSmileRight: 0.38, browDownLeft: 0.1, browDownRight: 0.1, eyeSquintLeft: 0.2, eyeSquintRight: 0.2 };

const base = new BaselineRecorder();
for (let i = 0; i < 60; i++) base.add(neutral);
const b = base.result();
const fmt = (o: ReturnType<typeof spiteParts>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(2)]));
console.log('neutral   ', fmt(spiteParts(neutral, b)));
console.log('smile only', fmt(spiteParts(smileOnly, b)));
console.log('frown only', fmt(spiteParts(frownOnly, b)));
console.log('spite grin', fmt(spiteParts(spiteGrin, b)));
console.log('open grin ', fmt(spiteParts(openGrin, b)));
console.log('weak grin ', fmt(spiteParts(weakGrin, b)));

const run = (face: Record<string, number>, sec: number) => {
  const s = new SpiteScorer();
  for (let t = 0; t < sec; t += 1 / 30) s.add(spiteParts(face, b).spite, 1 / 30);
  return { peak: +s.peak.toFixed(2), held: +s.heldShare.toFixed(2), points: s.points };
};
console.log('7s neutral', run(neutral, 7));
console.log('7s smile  ', run(smileOnly, 7));
console.log('7s weak   ', run(weakGrin, 7));
console.log('7s spite  ', run(spiteGrin, 7));
console.log('titles', [0, 1999, 2000, 3499, 3500, 5000].map((n) => `${n}:${titleFor(n)}`).join(' '));
