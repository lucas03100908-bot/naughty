import * as THREE from 'three';
import { GLOBE, SNOW } from '../game/constants.ts';
import { GROUND_HEIGHTS } from './groundHeights.ts';

/**
 * Snow simulation, free of React and the DOM so it can be checked headless
 * (scripts/check-snow.mts).
 * - Flakes land on the heightfield and add to it.
 * - Roll (flow) pushes heightfield snow sideways; an angle-of-repose pass keeps piles soft.
 * - A shake lifts the floor snow into the air (teleports flakes to the floor and throws them up),
 *   stirs everything for a while, then the lifted snow settles back in its old pattern.
 * All in globe-local units.
 */
export type SnowSim = ReturnType<typeof createSnowSim>;

export function createSnowSim() {
  const N = SNOW.grid;
  const Rf = GLOBE.floorRadius;
  const cell = (2 * Rf) / N;
  const floorY = GLOBE.floorY;
  const c = new THREE.Vector3(0, GLOBE.centerY, 0);
  const Rin = GLOBE.radius - 0.012;

  // ---------- heightfield ----------
  const h = new Float32Array(N * N);
  const tmp = new Float32Array(N * N);
  const before = new Float32Array(N * N); // where lifted snow lands again
  let beforeSum = 1;
  const mask = new Uint8Array(N * N);
  const insideMask = new Uint8Array(N * N); // inside the glass; mask = inside and not under a prop
  // Snow lies on the cobbled ground where there is ground (baked heights), on the floor elsewhere.
  const base = new Float32Array(N * N);
  const onGround = new Uint8Array(N * N);
  if (GROUND_HEIGHTS.n === N)
    for (let k = 0; k < N * N; k++) {
      const g = GROUND_HEIGHTS.heights[k];
      if (g >= 0) {
        base[k] = g;
        onGround[k] = 1;
      }
    }
  // Curbs and the street's edge are sharp steps the grid can't follow: one triangle would
  // stretch from the street up to the curb top, a white smear seen from low in the village.
  // Snow doesn't hold on a curb face anyway, so the sheet fades out across steps bigger than
  // the cobbles' own bumps — unless the snow there is deep enough to bury the step.
  const stepSize = new Float32Array(N * N);
  const stepFade = new Float32Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      let step = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          step = Math.max(step, Math.abs(base[nj * N + ni] - base[k]));
        }
      stepSize[k] = step;
      stepFade[k] = THREE.MathUtils.smoothstep(step, SNOW.curbStep[0], SNOW.curbStep[1]);
    }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = -Rf + (i + 0.5) * cell;
      const z = -Rf + (j + 0.5) * cell;
      const inside = Math.hypot(x, z) < Rf - cell * 0.6;
      mask[j * N + i] = inside ? 1 : 0;
      insideMask[j * N + i] = mask[j * N + i];
      if (inside) h[j * N + i] = restingDepth(x, z, Rf) * (onGround[j * N + i] ? SNOW.onGroundShare : 1);
    }

  // One vertex per cell centre. PlaneGeometry rows map to +z after rotateX(-π/2).
  const span = 2 * Rf - cell;
  const fieldGeometry = new THREE.PlaneGeometry(span, span, N - 1, N - 1);
  fieldGeometry.rotateX(-Math.PI / 2);
  const fpos = fieldGeometry.attributes.position as THREE.BufferAttribute;
  const fcol = new THREE.BufferAttribute(new Float32Array(N * N * 4), 4);
  fieldGeometry.setAttribute('color', fcol);

  const cellIndex = (x: number, z: number) => {
    const i = Math.floor((x + Rf) / cell);
    const j = Math.floor((z + Rf) / cell);
    if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return j * N + i;
  };

  const surface = (k: number) => floorY + base[k] + 0.0012 + (mask[k] ? h[k] : 0);
  const writeField = () => {
    for (let k = 0; k < N * N; k++) {
      let y = surface(k);
      // Under a prop: no snow, but keep the (invisible) sheet at the neighbours' height, so the
      // edge fades out level against the wall instead of dropping into a white cliff.
      if (insideMask[k] && !mask[k]) {
        const i = k % N;
        const j = (k - i) / N;
        let best = -Infinity;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const q = nj * N + ni;
            if (mask[q]) best = Math.max(best, surface(q));
          }
        if (best > -Infinity) y = best;
      }
      fpos.setY(k, y);
      const buried = THREE.MathUtils.smoothstep(h[k], stepSize[k] * 2, stepSize[k] * 4);
      const a = mask[k] ? THREE.MathUtils.smoothstep(h[k], 0.0015, 0.009) * (1 - stepFade[k] * (1 - buried)) : 0;
      fcol.setXYZW(k, 0.94, 0.96, 1.0, a);
    }
    fpos.needsUpdate = true;
    fcol.needsUpdate = true;
    fieldGeometry.computeVertexNormals();
  };
  writeField();

  // ---------- flakes ----------
  const n = SNOW.count;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const p = new THREE.Vector3();

  const spawn = (k: number, top: boolean) => {
    for (;;) {
      const x = (Math.random() * 2 - 1) * Rin;
      const z = (Math.random() * 2 - 1) * Rin;
      const y = top ? c.y + 0.1 + Math.random() * (Rin - 0.1) : floorY + Math.random() * (c.y + Rin - floorY);
      p.set(x, y, z);
      if (p.distanceTo(c) < Rin - 0.01) break;
    }
    pos[k * 3] = p.x;
    pos[k * 3 + 1] = p.y;
    pos[k * 3 + 2] = p.z;
    vel[k * 3] = vel[k * 3 + 2] = 0;
    vel[k * 3 + 1] = -SNOW.fallSpeed;
  };
  for (let k = 0; k < n; k++) {
    seed[k] = Math.random();
    spawn(k, false);
  }
  const flakeGeometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  flakeGeometry.setAttribute('position', posAttr);

  // ---------- shake state ----------
  let stirStart = -1e9;
  let pool = 0; // snow volume lifted by the last shake, waiting to settle back
  let poolTotal = 0;

  const shake = (now: number) => {
    // Everything on the floor goes up; it comes back down in the resting shape (even, banked at
    // the glass, a little noise), the way a real globe resets when you shake it.
    let sum = 0;
    beforeSum = 0;
    for (let k = 0; k < N * N; k++) {
      if (!mask[k]) continue;
      sum += h[k];
      h[k] = 0;
      const x = -Rf + ((k % N) + 0.5) * cell;
      const z = -Rf + (Math.floor(k / N) + 0.5) * cell;
      before[k] = restingDepth(x, z, Rf) * (onGround[k] ? SNOW.onGroundShare : 1) * (0.85 + 0.3 * Math.random());
      beforeSum += before[k];
    }
    pool += sum;
    poolTotal = pool;
    stirStart = now;
    // Throw a share of the flakes up from the floor: that's the lifted snow.
    const lifted = Math.floor(n * SNOW.shakeLiftShare);
    for (let m = 0; m < lifted; m++) {
      const k = Math.floor(Math.random() * n);
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (Rf - 0.02);
      pos[k * 3] = Math.cos(a) * r;
      pos[k * 3 + 1] = floorY + 0.01;
      pos[k * 3 + 2] = Math.sin(a) * r;
      vel[k * 3] = (Math.random() - 0.5) * 0.6;
      vel[k * 3 + 1] = 0.35 + Math.random() * 0.7;
      vel[k * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    writeField();
  };

  /** @param storm extra stir (0..1) held for as long as it is passed, e.g. the judge's blizzard */
  const step = (dt: number, now: number, t: number, flow: number, storm = 0) => {
    const sinceShake = (now - stirStart) / 1000;
    const stir = Math.max(Math.max(0, 1 - sinceShake / SNOW.shakeStirSec) ** 1.5, storm);
    let fieldDirty = false;

    // Flakes.
    for (let k = 0; k < n; k++) {
      const ix = k * 3;
      const s = seed[k];
      let x = pos[ix], y = pos[ix + 1], z = pos[ix + 2];
      let vx = vel[ix], vy = vel[ix + 1], vz = vel[ix + 2];

      const tvx = SNOW.drift * Math.sin(t * 0.7 + s * 40 + y * 4) + flow * 0.04;
      const tvz = SNOW.drift * Math.cos(t * 0.6 + s * 31 + x * 4);
      const tvy = -SNOW.fallSpeed * (0.6 + 0.8 * s) * (1 - stir * 0.9);
      const relax = Math.min(1, (1.6 - stir * 1.3) * dt);
      vx += (tvx - vx) * relax;
      vy += (tvy - vy) * relax;
      vz += (tvz - vz) * relax;
      if (stir > 0) {
        const kick = SNOW.shakeKick * stir * dt;
        vx += (Math.random() - 0.5) * kick - (z - c.z) * 1.2 * stir * dt;
        vy += (Math.random() - 0.45) * kick;
        vz += (Math.random() - 0.5) * kick + (x - c.x) * 1.2 * stir * dt;
      }
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      // Stay inside the glass.
      const dx = x - c.x, dy = y - c.y, dz = z - c.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > Rin) {
        const nx = dx / d, ny = dy / d, nz = dz / d;
        x = c.x + nx * Rin;
        y = c.y + ny * Rin;
        z = c.z + nz * Rin;
        const vn = vx * nx + vy * ny + vz * nz;
        if (vn > 0) {
          vx -= 1.4 * vn * nx;
          vy -= 1.4 * vn * ny;
          vz -= 1.4 * vn * nz;
        }
      }

      // Floor.
      const ci = cellIndex(x, z);
      const ground = floorY + (ci >= 0 ? base[ci] + (mask[ci] ? h[ci] : 0) : 0);
      if (y <= ground) {
        if (stir > 0.15) {
          y = ground;
          vy = Math.abs(vy) * 0.5 + stir * 0.25;
        } else {
          if (ci >= 0 && mask[ci]) {
            h[ci] = Math.min(SNOW.maxDepth, h[ci] + SNOW.depositPerFlake);
            fieldDirty = true;
          }
          vel[ix] = vx; vel[ix + 1] = vy; vel[ix + 2] = vz;
          spawn(k, true);
          continue;
        }
      }
      pos[ix] = x; pos[ix + 1] = y; pos[ix + 2] = z;
      vel[ix] = vx; vel[ix + 1] = vy; vel[ix + 2] = vz;
    }
    posAttr.needsUpdate = true;

    // Lifted snow settles back in its old pattern once the stir dies down.
    if (pool > 0 && stir < 0.2) {
      const rate = (poolTotal / SNOW.returnSec) * dt;
      const give = Math.min(pool, rate);
      const k = give / beforeSum;
      for (let q = 0; q < N * N; q++) if (mask[q]) h[q] += before[q] * k;
      pool -= give;
      if (pool <= 1e-6) pool = 0;
      fieldDirty = true;
    }

    // Roll: shift snow toward the low side.
    if (flow !== 0) {
      const dir = flow > 0 ? 1 : -1;
      const f = Math.min(0.5, Math.abs(flow) * SNOW.flowRate * dt);
      tmp.set(h);
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const a = j * N + i;
          const ti = i + dir;
          if (!mask[a] || ti < 0 || ti >= N) continue;
          const b = j * N + ti;
          if (!mask[b]) continue;
          // A full cell takes no more, so snow piles up behind it instead of vanishing.
          const moved = Math.min(h[a] * f, Math.max(0, SNOW.maxDepth - tmp[b]));
          tmp[a] -= moved;
          tmp[b] += moved;
        }
      h.set(tmp);
      fieldDirty = true;
    }

    // Angle of repose: soften steep steps between neighbours.
    if (fieldDirty) {
      relaxRepose(h, mask, N, SNOW.reposeStep);
      writeField();
    }
  };

  /**
   * Cells a prop stands on (1 = blocked). Snow never lies there, so the sheet stops at walls and
   * bases instead of rising through them; flakes landing there simply vanish.
   */
  const setBlocked = (blocked: Uint8Array) => {
    for (let k = 0; k < N * N; k++) {
      const m = insideMask[k] && !blocked[k] ? 1 : 0;
      if (!m) h[k] = 0;
      mask[k] = m;
    }
    writeField();
  };

  /** Cell index of a globe-local x/z, or -1 off the grid. */
  const cellAt = cellIndex;

  const inspect = () => ({ h, mask, N, cell, Rf, pool });
  return { fieldGeometry, flakeGeometry, step, shake, setBlocked, cellAt, inspect };
}

function relaxRepose(h: Float32Array, mask: Uint8Array, N: number, maxStep: number) {
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * N + i;
      if (!mask[a]) continue;
      if (i + 1 < N) slump(h, mask, a, a + 1, maxStep);
      if (j + 1 < N) slump(h, mask, a, a + N, maxStep);
    }
}

function slump(h: Float32Array, mask: Uint8Array, a: number, b: number, maxStep: number) {
  if (!mask[b]) return;
  const d = h[a] - h[b];
  if (Math.abs(d) <= maxStep) return;
  const move = (Math.abs(d) - maxStep) * 0.25 * Math.sign(d);
  h[a] -= move;
  h[b] += move;
}

/**
 * Snow depth of an undisturbed globe: thick and lumpy, drifted up against the glass. On the
 * cobbled street it is scaled down by SNOW.onGroundShare (the street model has its own snow).
 */
function restingDepth(x: number, z: number, Rf: number) {
  const lumps = 0.5 + 0.5 * Math.sin(x * 37 + z * 11) * Math.cos(z * 23 - x * 7);
  const swells = 0.5 + 0.5 * Math.sin(x * 9 - z * 6 + 1.7);
  const r = Math.hypot(x, z) / Rf;
  const bank = THREE.MathUtils.smoothstep(r, 0.55, 0.97);
  return SNOW.initialDepth * (0.75 + 0.3 * lumps + 0.2 * swells) + SNOW.edgeBank * bank;
}
