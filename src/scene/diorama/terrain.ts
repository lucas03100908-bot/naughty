import * as THREE from 'three';
import { DIORAMA } from '../../game/constants.ts';

/**
 * The miniature ski world around the globe, in the table group's units (world scale; origin on
 * the table under the globe's centre, +z toward the viewer). One height function serves the snow
 * mesh and everything placed on it (pines, chalets, lift towers, skiers).
 */

/** Big snow mountains behind and beside the globe: [x, z, height, radius, swirl seed]. */
export const MOUNTAINS: [number, number, number, number, number][] = [
  // The camera sees a narrow band either side of the globe and a skyline over its shoulders.
  [-0.8, -1.45, 0.3, 0.5, 1.3], // left: the ski runs
  [0.82, -1.5, 0.34, 0.5, 4.1], // right: the chair lift
  [0.0, -2.05, 0.5, 0.8, 2.7], // behind the globe
  [-1.35, -1.1, 0.28, 0.5, 5.9],
  [1.35, -1.1, 0.26, 0.5, 3.3],
  [-0.45, -2.0, 0.3, 0.5, 0.4],
  [0.5, -2.05, 0.32, 0.5, 6.6],
];

/** Past this the table falls away, so the mountains make a skyline against the dark. */
const BACK_EDGE = -2.15;
const SIDE_EDGE = 1.6;

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise, 0..1. */
function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

const smooth = THREE.MathUtils.smoothstep;

/**
 * Height of the snow at (x, z). Flat under the globe and along the train's track bed; soft drifts
 * elsewhere; the mountains are piped like whipped cream (a spiral groove around each peak).
 */
export function groundHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  let y = 0.018 * Math.sin(x * 3.1 + z * 1.7) + 0.012 * Math.sin(x * 5.3 - z * 4.1 + 0.7) + 0.02 * noise(x * 2.2, z * 2.2);
  for (const [mx, mz, h, rad, seed] of MOUNTAINS) {
    const dx = x - mx;
    const dz = z - mz;
    const d = Math.hypot(dx, dz) / rad;
    if (d > 1.6) continue;
    const p = Math.exp(-d * d * 2.4);
    const angle = Math.atan2(dz, dx);
    // The piping: a groove spiralling up to the peak, strongest on the flanks.
    const swirl = Math.sin(angle * 4 + d * 11 + seed) * p * (1 - p) * 0.22;
    const lumps = (noise(x * 4 + seed, z * 4) - 0.5) * 0.12 * p;
    y += h * (p + swirl + lumps);
  }
  // Level ground under the globe and a snowy bed along the track.
  const globe = smooth(r, DIORAMA.clearRadius * 0.82, DIORAMA.clearRadius);
  const track = smooth(Math.abs(r - DIORAMA.trackRadius), DIORAMA.trackBed, DIORAMA.trackBed * 2.2);
  const fall = Math.max(0, BACK_EDGE - z) ** 2 * 1.5 + Math.max(0, Math.abs(x) - SIDE_EDGE) ** 2 * 1.5;
  return Math.max(y, 0) * globe * track + DIORAMA.bedHeight * (1 - track) * globe - 0.012 * (1 - globe) - fall;
}

/**
 * How lit the snow is at (x, z): a pool of light around the globe that dies away into the dark
 * room, the way a lamp lights a model on a table.
 */
export function lightPool(x: number, z: number) {
  const r = Math.hypot(x, z + 0.3);
  return 1 - 0.8 * smooth(r, 0.55, 1.7);
}

/** A point on the train's loop at angle `a` (0 = +x, turning toward +z). */
export function trackPoint(a: number, out = new THREE.Vector3()) {
  return out.set(Math.cos(a) * DIORAMA.trackRadius, DIORAMA.bedHeight, Math.sin(a) * DIORAMA.trackRadius);
}

/** Deterministic random in [0, 1) for placing things. */
export function rand(i: number, salt = 0) {
  return hash(i * 1.37 + salt * 7.1, salt * 3.3 + i * 0.71);
}
