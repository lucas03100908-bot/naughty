// Bake the top surface of a Tripo snow-terrain tile into a height map and a colour map, so the
// diorama's snow ground can take its drifts and rocky mounds while staying one seamless mesh
// (flat where the globe stands and the train runs).
//
//   node scripts/bake-snowfield.mjs            → writes the maps
//   node scripts/bake-snowfield.mjs --preview  → also writes full-tile previews to assets/reference
//
// Outputs:
//   src/scene/diorama/snowfield.gen.ts  — the height map (8-bit, base64) and the region it covers
//   public/models/snowfield_color.jpg   — the colour map, feathered to white at its edges
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'assets/source/diorama/range.glb';
/** The part of the tile to bake, in its own units: the snowfield with mounds in front of the ridge. */
const REGION = { x0: -0.41, x1: 0.41, z0: 0.03, z1: 0.38 };
const W = 288;
const H = Math.round((W * (REGION.z1 - REGION.z0)) / (REGION.x1 - REGION.x0));
const COLOR_W = 1024;
const preview = process.argv.includes('--preview');

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
const uv = prim.getAttribute('TEXCOORD_0').getArray();
const idx = prim.getIndices().getArray();
const tex = prim.getMaterial().getBaseColorTexture();
const { data: img, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });

/** Rasterize the top surface over a region into a w×h grid of height and uv (max y wins). */
function raster(region, w, h) {
  const height = new Float32Array(w * h).fill(-Infinity);
  const tu = new Float32Array(w * h);
  const tv = new Float32Array(w * h);
  const sx = w / (region.x1 - region.x0);
  const sz = h / (region.z1 - region.z0);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    // Grid coordinates of the corners.
    const ax = (pos[a] - region.x0) * sx, az = (pos[a + 2] - region.z0) * sz;
    const bx = (pos[b] - region.x0) * sx, bz = (pos[b + 2] - region.z0) * sz;
    const cx = (pos[c] - region.x0) * sx, cz = (pos[c + 2] - region.z0) * sz;
    const minX = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5));
    const maxX = Math.min(w - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
    const minZ = Math.max(0, Math.ceil(Math.min(az, bz, cz) - 0.5));
    const maxZ = Math.min(h - 1, Math.floor(Math.max(az, bz, cz) - 0.5));
    if (minX > maxX || minZ > maxZ) continue;
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-12) continue;
    for (let j = minZ; j <= maxZ; j++)
      for (let i = minX; i <= maxX; i++) {
        const px = i + 0.5, pz = j + 0.5;
        const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den;
        const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
        const y = l1 * pos[a + 1] + l2 * pos[b + 1] + l3 * pos[c + 1];
        const k = j * w + i;
        if (y <= height[k]) continue;
        height[k] = y;
        const ua = (a / 3) * 2, ub = (b / 3) * 2, uc = (c / 3) * 2;
        tu[k] = l1 * uv[ua] + l2 * uv[ub] + l3 * uv[uc];
        tv[k] = l1 * uv[ua + 1] + l2 * uv[ub + 1] + l3 * uv[uc + 1];
      }
  }
  // Fill any holes from neighbours.
  for (let pass = 0; pass < 6; pass++)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (height[k] > -Infinity) continue;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
          const kk = jj * w + ii;
          if (height[kk] > -Infinity) {
            height[k] = height[kk];
            tu[k] = tu[kk];
            tv[k] = tv[kk];
            break;
          }
        }
      }
  return { height, tu, tv };
}

/** Separable box blur, three passes (≈ gaussian), clamped at the edges. */
function boxBlur(src, w, h, radius) {
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let sum = 0;
        for (let d = -radius; d <= radius; d++) sum += a[j * w + Math.min(w - 1, Math.max(0, i + d))];
        b[j * w + i] = sum / (radius * 2 + 1);
      }
    [a, b] = [b, a];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let sum = 0;
        for (let d = -radius; d <= radius; d++) sum += a[Math.min(h - 1, Math.max(0, j + d)) * w + i];
        b[j * w + i] = sum / (radius * 2 + 1);
      }
    [a, b] = [b, a];
  }
  return a;
}

function colourAt(u, v) {
  const x = Math.min(info.width - 1, Math.max(0, Math.round(u * (info.width - 1))));
  const y = Math.min(info.height - 1, Math.max(0, Math.round(v * (info.height - 1))));
  const o = (y * info.width + x) * 3;
  return [img[o], img[o + 1], img[o + 2]];
}

async function writeColour(r, w, h, file, feather) {
  const out = Buffer.alloc(w * h * 3);
  // Mean brightness, so the map multiplies the snow by ~1 on average.
  let mean = 0;
  for (let k = 0; k < w * h; k++) {
    const [cr, cg, cb] = colourAt(r.tu[k], r.tv[k]);
    mean += 0.3 * cr + 0.59 * cg + 0.11 * cb;
  }
  mean /= w * h;
  const gain = feather ? 245 / mean : 1;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      let [cr, cg, cb] = colourAt(r.tu[k], r.tv[k]);
      if (feather) {
        // Take out most of the tile's blue cast (the diorama's snow has its own), keep the rock.
        const l = 0.3 * cr + 0.59 * cg + 0.11 * cb;
        cr = Math.min(255, (l + (cr - l) * 0.45) * gain);
        cg = Math.min(255, (l + (cg - l) * 0.45) * gain);
        cb = Math.min(255, (l + (cb - l) * 0.45) * gain);
        // Fade to white toward the edges so the map melts into the plain snow around it.
        const e = Math.min(i / w, 1 - i / w, j / h, 1 - j / h);
        const f = Math.min(1, e / 0.12);
        const s = f * f * (3 - 2 * f);
        cr = 255 + (cr - 255) * s;
        cg = 255 + (cg - 255) * s;
        cb = 255 + (cb - 255) * s;
      }
      out[k * 3] = cr;
      out[k * 3 + 1] = cg;
      out[k * 3 + 2] = cb;
    }
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 86 }).toFile(file);
}

if (preview) {
  const full = { x0: -0.49, x1: 0.49, z0: -0.457, z1: 0.457 };
  const r = raster(full, 512, 478);
  let lo = Infinity, hi = -Infinity;
  for (const y of r.height) {
    if (y === -Infinity) continue;
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  const g = Buffer.alloc(512 * 478);
  r.height.forEach((y, k) => (g[k] = y > -Infinity ? Math.round(((y - lo) / (hi - lo)) * 255) : 0));
  await sharp(g, { raw: { width: 512, height: 478, channels: 1 } }).png().toFile('assets/reference/snowfield_full_height.png');
  await writeColour(r, 512, 478, 'assets/reference/snowfield_full_color.jpg', false);
  console.log('previews written; height', lo.toFixed(3), '..', hi.toFixed(3));
}

// The baked region. The field climbs toward the ridge behind it; keep only the local relief
// (mounds, drifts) by taking away a wide blur of the surface.
const r = raster(REGION, W, H);
const wide = boxBlur(r.height, W, H, Math.round(W / 7));
for (let k = 0; k < r.height.length; k++) r.height[k] -= wide[k];
const ys = [...r.height].sort((a, b) => a - b);
// The snowfield's level: heights are stored relative to it (most of the field sits near 0).
const base = ys[Math.floor(ys.length * 0.35)];
const top = ys[ys.length - 1];
const span = top - ys[0];
const bytes = new Uint8Array(W * H);
r.height.forEach((y, k) => (bytes[k] = Math.round(((y - ys[0]) / span) * 255)));
const tile = { width: REGION.x1 - REGION.x0, depth: REGION.z1 - REGION.z0 };
fs.writeFileSync(
  'src/scene/diorama/snowfield.gen.ts',
  `// Generated by scripts/bake-snowfield.mjs from the Tripo snow-terrain tile. Do not edit.
/** Height grid, row-major from the tile's back edge (-z) to its front: byte / 255 * span + min. */
export const SNOWFIELD = {
  w: ${W},
  h: ${H},
  /** Tile units: the baked region's size, and its heights. */
  width: ${tile.width.toFixed(4)},
  depth: ${tile.depth.toFixed(4)},
  min: ${ys[0].toFixed(5)},
  span: ${span.toFixed(5)},
  /** Height of the open snowfield, which the diorama lays at its ground level. */
  base: ${base.toFixed(5)},
  data: '${Buffer.from(bytes).toString('base64')}',
};
`,
);
const colourH = Math.round((COLOR_W * H) / W);
await writeColour(raster(REGION, COLOR_W, colourH), COLOR_W, colourH, 'public/models/snowfield_color.jpg', true);
console.log(`baked ${W}×${H} heights (${(span * 1000).toFixed(1)} mm span in tile units, base ${(base - ys[0]).toFixed(4)} above min) and a ${COLOR_W}×${colourH} colour map`);
