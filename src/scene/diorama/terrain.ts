import * as THREE from 'three';
import { DIORAMA } from '../../game/constants.ts';
import { PROPS, TUNNEL_PAD } from './layout.ts';
import { SNOWFIELD } from './snowfield.gen.ts';

/**
 * The miniature ski world around the globe, in the table group's units (world scale; origin on
 * the table under the globe's centre, +z toward the viewer). One height function serves the snow
 * mesh and everything placed on it (pines, chalets, lift towers, skiers).
 */

/** Big snow mountains behind and beside the globe: [x, z, height, radius, swirl seed]. */
export const MOUNTAINS: [number, number, number, number, number][] = [
  // The camera sees a narrow band either side of the globe; behind it stands the range model
  // (Scenery's Range), not a piped mountain.
  [-0.8, -1.45, 0.3, 0.5, 1.3], // left: the ski runs
  [0.82, -1.5, 0.34, 0.5, 4.1], // right: the chair lift
  [-1.35, -1.1, 0.28, 0.5, 5.9],
  [1.35, -1.1, 0.26, 0.5, 3.3],
];

/** A bank of snow along the front of the range behind the globe, hiding where its tile was cut. */
const BERM = { z: -1.76, width: 0.14, height: 0.11 };

/** Past this the table falls away, so the mountains make a skyline against the dark. */
const BACK_EDGE = -2.15;
const SIDE_EDGE = 1.6;

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise, 0..1. */
export function noise(x: number, y: number) {
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
 * The snowfield in front of the range: drifts and rocky mounds baked from a Tripo terrain tile
 * (scripts/bake-snowfield.mjs), laid over the table in front of the globe.
 */
const FIELD = { cx: 0, cz: -0.25, width: 2.9, relief: 0.55 };
const FIELD_DEPTH = (FIELD.width * SNOWFIELD.depth) / SNOWFIELD.width;
const FIELD_SCALE = FIELD.width / SNOWFIELD.width;
const fieldGrid = (() => {
  const bytes = typeof atob === 'function' ? Uint8Array.from(atob(SNOWFIELD.data), (c) => c.charCodeAt(0)) : new Uint8Array(Buffer.from(SNOWFIELD.data, 'base64'));
  const out = new Float32Array(bytes.length);
  for (let k = 0; k < bytes.length; k++) out[k] = ((bytes[k] / 255) * SNOWFIELD.span + SNOWFIELD.min - SNOWFIELD.base) * FIELD_SCALE * FIELD.relief;
  return out;
})();

/** Where (x, z) falls on the snowfield's map, 0..1 each way (outside = beyond it). */
export function fieldUV(x: number, z: number) {
  return [(x - FIELD.cx) / FIELD.width + 0.5, (z - FIELD.cz) / FIELD_DEPTH + 0.5] as const;
}

/** The snowfield's relief at (x, z), faded out at its edges. */
function fieldHeight(x: number, z: number) {
  const [u, v] = fieldUV(x, z);
  if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0;
  const { w, h } = SNOWFIELD;
  const fx = u * w - 0.5;
  const fz = v * h - 0.5;
  const i = Math.max(0, Math.min(w - 2, Math.floor(fx)));
  const j = Math.max(0, Math.min(h - 2, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - i));
  const tz = Math.min(1, Math.max(0, fz - j));
  const a = fieldGrid[j * w + i];
  const b = fieldGrid[j * w + i + 1];
  const c = fieldGrid[(j + 1) * w + i];
  const d = fieldGrid[(j + 1) * w + i + 1];
  const y = (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  const edge = smooth(Math.min(u, 1 - u, v, 1 - v), 0, 0.08);
  return y * edge;
}

/** 1 in the open, 0 on the level pad under each prop and tunnel. */
function padMask(x: number, z: number) {
  let m = 1;
  for (const [, px, pz, , , pr] of PROPS) m *= smooth(Math.hypot(x - px, z - pz), pr * 0.7, pr * 1.6);
  for (const t of DIORAMA.tunnels) {
    const px = Math.cos(t) * DIORAMA.trackRadius;
    const pz = Math.sin(t) * DIORAMA.trackRadius;
    m *= smooth(Math.hypot(x - px, z - pz), TUNNEL_PAD * 0.8, TUNNEL_PAD * 1.3);
  }
  return m;
}

/**
 * Height of the snow at (x, z). Flat under the globe and along the train's track bed; the baked
 * snowfield's drifts and mounds in front, levelled under props and tunnels; soft mountains either
 * side, swirled a little like whipped cream; a berm hiding the range's cut edge behind.
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
  // The baked drifts and mounds, levelled where things stand.
  y += fieldHeight(x, z) * padMask(x, z);
  // Snow banked against each tunnel's rock, burying where its slab was cut (the track mask below
  // keeps the bed clear).
  for (const t of DIORAMA.tunnels) {
    const d = Math.hypot(x - Math.cos(t) * DIORAMA.trackRadius, z - Math.sin(t) * DIORAMA.trackRadius);
    y += 0.03 * Math.exp(-((d / (TUNNEL_PAD * 0.75)) ** 2)) * (0.85 + 0.3 * noise(x * 14, z * 14));
  }
  // The berm, lumpy along its length, fading out past the range's ends.
  const bermSide = 1 - smooth(Math.abs(x), 1.3, 1.6);
  y += BERM.height * Math.exp(-(((z - BERM.z) / BERM.width) ** 2)) * (0.8 + 0.4 * noise(x * 6, 3.1)) * bermSide;
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
