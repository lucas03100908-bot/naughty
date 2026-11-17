// Headless check of the snow simulation: roll moves snow sideways, shake lifts it and it returns.
//   node scripts/check-snow.mts
import { createSnowSim } from '../src/scene/snowSim.ts';
import { SNOW } from '../src/game/constants.ts';

const sim = createSnowSim();
const { h, mask, N } = sim.inspect();
const sideMass = () => {
  let l = 0, r = 0, total = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    if (!mask[k]) continue;
    total += h[k];
    if (i < N / 4) l += h[k]; else if (i >= (3 * N) / 4) r += h[k];
  }
  return { leftQuarter: +l.toFixed(3), rightQuarter: +r.toFixed(3), total: +total.toFixed(3) };
};
const dt = 1 / 60;
let now = 0, t = 0;
const run = (sec: number, flow: number) => { for (let s = 0; s < sec * 60; s++) { now += dt * 1000; t += dt; sim.step(dt, now, t, flow); } };

console.log('start          ', sideMass());
run(2, 0);
console.log('2s no tilt     ', sideMass());
run(1, 1);
console.log('1s tilt right  ', sideMass());
run(1.5, 1);
console.log('2.5s tilt right', sideMass());
run(2.5, -1);
console.log('2.5s tilt left ', sideMass());
sim.shake(now);
console.log('right after shake', sideMass(), 'pool', sim.inspect().pool.toFixed(3));
run(SNOW.shakeStirSec, 0);
console.log(`after stir (${SNOW.shakeStirSec}s)`, sideMass());
run(SNOW.returnSec + 1, 0);
console.log(`after return (+${SNOW.returnSec + 1}s)`, sideMass(), 'pool', sim.inspect().pool.toFixed(3));
