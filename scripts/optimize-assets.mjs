// Source GLBs (Tripo, ~1.9M tris, 3×4K textures each) → web-ready GLBs in public/models.
//
//   npm run assets
//
// Per model: cover IP text/emblems in the base color texture, derive an emissive
// mask from the warm window pixels, simplify the mesh, resize textures to WebP,
// and compress geometry with Meshopt. Prints a before/after table.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, meshopt, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets/source';
const OUT = 'public/models';

// Rectangles [x, y, w, h] in 4096² base color texture pixels. Found by OCR + visual
// inspection of each atlas. Each is replaced by a heavy blur of itself, which keeps
// the surface color but makes lettering and emblems unreadable (CLAUDE.md: IP).
const only = process.argv.slice(2); // optional: names to (re)build, e.g. `npm run assets -- snowman`
const ALL_MODELS = [
  {
    name: 'shop_a',
    // Eight houses stand in the globe and each is ~150px tall on screen: 100k was invisible
    // detail drawn several times a frame (main pass, shadow map, glass).
    triangles: 36_000,
    error: 0.01,
    baseSize: 2048,
    emissive: true,
    cover: [
      [720, 990, 140, 150], // "VAND…"
      [3330, 2160, 140, 420], // shop name sign (well-known IP name)
      [2650, 3330, 230, 100], // "OUTEHO"
    ],
  },
  {
    name: 'shop_b',
    triangles: 36_000,
    error: 0.01,
    baseSize: 2048,
    emissive: true,
    cover: [
      [660, 520, 210, 160],
      [540, 890, 200, 130],
      [190, 1010, 180, 180],
      [2600, 330, 120, 200],
      [3220, 380, 150, 230],
      [3040, 1170, 120, 180],
      [150, 3330, 210, 180],
      [450, 3440, 210, 100],
      [2540, 3560, 140, 110],
      [3300, 3610, 120, 110],
    ],
  },
  {
    name: 'tree',
    triangles: 16_000,
    error: 0.01,
    baseSize: 1024,
    emissive: true,
    cover: [
      [440, 120, 180, 230], // red/gold crest
      [850, 90, 230, 200],
      [500, 2080, 260, 170], // red/gold crest
      [3400, 1610, 200, 260], // blue crest
      [910, 1170, 170, 230],
      [1850, 1380, 220, 170],
      [2290, 940, 220, 200],
    ],
  },
  { name: 'street_lamp', triangles: 9_000, error: 0.01, baseSize: 1024, emissive: true, cover: [] },
  // Multi-part props: every part keeps its own node (the snowman's head and nose come off,
  // the tree's ornaments are its lights), every material is processed.
  { name: 'christmas_tree', triangles: 80_000, baseSize: 1024, emissive: true, cover: [] },
  { name: 'snowman', triangles: 50_000, baseSize: 1024, emissive: false, cover: [] },
  // Snowy cobbled street with curbs: the village ground.
  { name: 'ground', triangles: 60_000, baseSize: 2048, emissive: false, cover: [] },
  // The ski diorama outside the globe (split from multi-part sheets by split-diorama.mjs). Seen
  // from outside only, each a few dozen to ~150px tall: small budgets, small textures.
  ...[
    ['dio_chalet', 9_000, 1024, true],
    ['dio_house_a', 6_000, 512, true],
    ['dio_house_b', 6_000, 512, true],
    ['dio_rental', 6_000, 512, true],
    ['dio_locomotive', 6_000, 512, true],
    ['dio_coach_green', 3_500, 512, true],
    ['dio_coach_red', 3_500, 512, true],
    ['dio_lift_tower', 1_500, 256, false],
    ['dio_gondola_red', 1_500, 256, false],
    ['dio_skier_red', 1_500, 256, false],
    ['dio_skier_green', 1_500, 256, false],
    ['dio_snowboarder', 1_500, 256, false],
    ['dio_ski_family', 2_500, 256, false],
    // Instanced dozens of times.
    ['dio_pine', 1_200, 512, false, 0.2],
    ['dio_pine_l', 1_200, 256, false, 0.2],
    ['dio_pine_m', 1_000, 256, false, 0.2],
    ['dio_pine_s', 800, 256, false, 0.2],
    ['dio_logs', 1_200, 256, false],
    ['dio_mountain', 4_000, 512, false],
    // The range behind the globe: big on screen, so a real budget.
    ['dio_range', 40_000, 2048, false, 0.005],
    ['dio_rock', 2_000, 512, false],
    ['dio_tunnel', 12_000, 1024, true],
    ['dio_snow_pile', 1_200, 256, false],
    ['dio_signpost', 1_200, 256, false],
    ['dio_fence', 1_000, 256, false],
    ['dio_bridge', 2_000, 512, false],
  ].map(([name, triangles, baseSize, emissive, error = 0.02]) => ({ name, triangles, baseSize, emissive, error, cover: [] })),
];

const MODELS = only.length ? ALL_MODELS.filter((m) => only.includes(m.name)) : ALL_MODELS;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

async function coverRects(buf, rects) {
  if (!rects.length) return buf;
  const img = sharp(buf);
  const { width, height } = await img.metadata();
  const layers = [];
  for (const [x, y, w, h] of rects) {
    const pad = 16;
    const left = Math.max(0, x - pad);
    const top = Math.max(0, y - pad);
    const ww = Math.min(width - left, w + pad * 2);
    const hh = Math.min(height - top, h + pad * 2);
    const patch = await sharp(buf)
      .extract({ left, top, width: ww, height: hh })
      .blur(Math.max(12, Math.min(ww, hh) / 3))
      .toBuffer();
    layers.push({ input: patch, left, top });
  }
  return img.composite(layers).jpeg({ quality: 92 }).toBuffer();
}

// Warm, bright pixels (lit windows, lamp glass) → emissive map. Everything else black.
async function emissiveFrom(buf, size) {
  const { data, info } = await sharp(buf).resize(size, size).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b);
    const warm = r >= g && g > b && r - b > 70;
    const bright = max > 170;
    if (warm && bright) {
      const k = Math.min(1, (max - 170) / 60);
      out[i] = r * k;
      out[i + 1] = g * k;
      out[i + 2] = b * k * 0.8;
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}

function countTriangles(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      n += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
  return Math.round(n);
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
fs.mkdirSync(OUT, { recursive: true });
const rows = [];

for (const m of MODELS) {
  const srcPath = path.join(SRC, `${m.name}.glb`);
  const doc = await io.read(srcPath);
  const before = { size: fs.statSync(srcPath).size, tris: countTriangles(doc) };

  // Tripo writes KHR_materials_volume (meant for glass) on opaque props; drop it.
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === 'KHR_materials_volume') ext.dispose();

  const materials = doc.getRoot().listMaterials();
  for (const [mi, material] of materials.entries()) {
    const base = material.getBaseColorTexture();
    if (!base) continue;
    // Cover rectangles are in the (single) main atlas's pixels.
    const covered = mi === 0 ? await coverRects(Buffer.from(base.getImage()), m.cover) : Buffer.from(base.getImage());
    base.setImage(new Uint8Array(covered)).setMimeType('image/jpeg');
    if (m.emissive) {
      const size = Math.min(1024, base.getSize()?.[0] ?? 1024);
      const em = doc.createTexture(`${m.name}_${mi}_emissive`).setImage(new Uint8Array(await emissiveFrom(covered, size))).setMimeType('image/png');
      material.setEmissiveTexture(em).setEmissiveFactor([1, 1, 1]);
    }
  }

  const ratio = Math.min(1, m.triangles / before.tris);
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: m.error ?? 0.002 }),
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColor/, resize: [m.baseSize, m.baseSize], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^emissive/, resize: [1024, 1024], quality: 80 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^normal/, resize: [1024, 1024], quality: 85 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^metallicRoughness/, resize: [512, 512], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );

  const outPath = path.join(OUT, `${m.name}.glb`);
  await io.write(outPath, doc);
  const after = { size: fs.statSync(outPath).size, tris: countTriangles(doc) };
  rows.push({ model: m.name, before, after });
  console.log(`✓ ${m.name}`);
}

console.log('\n| model | before | after | triangles before | triangles after |');
console.log('| --- | --- | --- | --- | --- |');
let tb = 0, ta = 0;
for (const r of rows) {
  tb += r.before.size;
  ta += r.after.size;
  console.log(`| ${r.model} | ${mb(r.before.size)} | ${mb(r.after.size)} | ${r.before.tris.toLocaleString()} | ${r.after.tris.toLocaleString()} |`);
}
console.log(`| **total** | ${mb(tb)} | ${mb(ta)} | | |`);
