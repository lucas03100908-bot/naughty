// Multi-part Tripo sheets (assets/source/diorama/*.glb) → one source GLB per prop in assets/source,
// named dio_*, ready for `npm run assets`.
//
//   node scripts/split-diorama.mjs
//
// Each prop keeps only its own parts (picked by part index after looking at the sheet with every
// part coloured), is turned so its long axis runs along +x when asked (the train), then moved so
// it stands on y = 0 centred on the origin.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets/source/diorama';
const OUT = 'assets/source';

/** sheet → prop → part indices (tripo_part_N); `rotY` turns the prop (radians) to face +z. */
const SHEETS = {
  houses: {
    dio_chalet: { parts: [0, 4] },
    dio_house_a: { parts: [3, 5] },
    dio_house_b: { parts: [1, 6] },
    dio_rental: { parts: [2, 7] },
  },
  people: {
    dio_lift_tower: { parts: [0] },
    dio_gondola_red: { parts: [3] },
    dio_skier_red: { parts: [4] },
    dio_skier_green: { parts: [11] },
    dio_snowboarder: { parts: [5] },
    dio_ski_family: { parts: [7, 8] },
  },
  trees: {
    dio_pine: { parts: 'all' },
  },
  // Generated with `tripo make sheet_misc.webp --model H3.1 -p generate_parts=true --then texture`
  // (50 credits). Its fronts face +x.
  misc: {
    dio_pine_l: { parts: [0], rotY: -Math.PI / 2 },
    dio_pine_m: { parts: [3], rotY: -Math.PI / 2 },
    dio_pine_s: { parts: [7], rotY: -Math.PI / 2 },
    dio_logs: { parts: [5], rotY: -Math.PI / 2 },
    dio_mountain: { parts: [1], rotY: -Math.PI / 2 },
    dio_rock: { parts: [2], rotY: -Math.PI / 2 },
    dio_snow_pile: { parts: [4], rotY: -Math.PI / 2 },
    dio_signpost: { parts: [8], rotY: -Math.PI / 2 },
    dio_fence: { parts: [6], rotY: -Math.PI / 2 },
    dio_bridge: { parts: [9], rotY: -Math.PI / 2 },
  },
  // The train sheet: car bodies 0 (locomotive), 1 (green coach), 2 and 3 (red coaches). Every
  // other small part joins the nearest body; the loose track pieces (4, 5), the stray tower (6)
  // and the rails under the train (11, 12) are dropped: the diorama lays its own loop.
  train: 'cars',
};
const TRAIN = { bodies: { dio_locomotive: 0, dio_coach_green: 1, dio_coach_red: 2, dio_coach_red_b: 3 }, drop: [4, 5, 6, 11, 12] };

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const partIndex = (node) => Number((node.getName().match(/_(\d+)$/) ?? [])[1]);
const centreXZ = (node) => {
  const b = getBounds(node);
  return [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
};

/** Direction of the longest horizontal spread of a node's vertices (2D PCA), as an angle. */
function longAxis(nodes) {
  let n = 0, mx = 0, mz = 0;
  const pts = [];
  for (const node of nodes) {
    const m = node.getWorldMatrix();
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i += 7) {
        pos.getElement(i, v);
        const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
        const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
        pts.push(x, z);
        mx += x;
        mz += z;
        n++;
      }
    }
  }
  mx /= n;
  mz /= n;
  let sxx = 0, szz = 0, sxz = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const dx = pts[i] - mx, dz = pts[i + 1] - mz;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
  }
  return 0.5 * Math.atan2(2 * sxz, sxx - szz);
}

async function writeProp(name, srcFile, keep, { forward, rotY } = {}) {
  const doc = await io.read(srcFile);
  const root = doc.getRoot();
  for (const ext of root.listExtensionsUsed()) if (ext.extensionName === 'KHR_materials_volume') ext.dispose();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const meshNodes = root.listNodes().filter((n) => n.getMesh());
  const kept = meshNodes.filter((n) => keep(n));
  for (const n of meshNodes) if (!kept.includes(n)) n.dispose();

  // One parent holds the kept parts; its transform does the turning and grounding.
  const pivot = doc.createNode(name);
  for (const n of kept) {
    for (const p of n.listParents()) if (p.propertyType === 'Node' || p.propertyType === 'Scene') p.removeChild(n);
    pivot.addChild(n);
  }
  for (const child of scene.listChildren()) if (child !== pivot) scene.removeChild(child);
  scene.addChild(pivot);

  if (forward) {
    // Long axis to +x, pointing the way `forward` (an xz point) lies from the prop.
    let a = longAxis(kept);
    const [cx, cz] = centreXZ(pivot);
    if (Math.cos(a) * (forward[0] - cx) + Math.sin(a) * (forward[1] - cz) < 0) a += Math.PI;
    // rotY(φ) takes (cos a, 0, sin a) to +x when φ = a.
    pivot.setRotation([0, Math.sin(a / 2), 0, Math.cos(a / 2)]);
  }
  if (rotY) pivot.setRotation([0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2)]);
  const b = getBounds(pivot);
  const t = pivot.getTranslation();
  pivot.setTranslation([t[0] - (b.min[0] + b.max[0]) / 2, t[1] - b.min[1], t[2] - (b.min[2] + b.max[2]) / 2]);

  await doc.transform(prune());
  const out = path.join(OUT, `${name}.glb`);
  await io.write(out, doc);
  const nb = getBounds(scene);
  const size = nb.max.map((v, i) => (v - nb.min[i]).toFixed(3)).join(' × ');
  console.log(`✓ ${name.padEnd(18)} ${String(kept.length).padStart(2)} parts  ${size}`);
}

const only = process.argv.slice(2);
for (const [sheet, props] of Object.entries(SHEETS)) {
  const file = path.join(SRC, `${sheet}.glb`);
  if (!fs.existsSync(file)) {
    console.log(`- ${sheet}.glb missing, skipped`);
    continue;
  }
  if (props === 'cars') {
    // Assign every part to its nearest car body.
    const doc = await io.read(file);
    const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
    const byIndex = new Map(nodes.map((n) => [partIndex(n), n]));
    const bodies = Object.entries(TRAIN.bodies).map(([name, i]) => ({ name, i, c: centreXZ(byIndex.get(i)) }));
    const owner = new Map();
    for (const n of nodes) {
      const i = partIndex(n);
      if (TRAIN.drop.includes(i)) continue;
      const c = centreXZ(n);
      const best = bodies.reduce((a, b) => (Math.hypot(b.c[0] - c[0], b.c[1] - c[1]) < Math.hypot(a.c[0] - c[0], a.c[1] - c[1]) ? b : a));
      owner.set(i, best.name);
    }
    const loco = bodies[0].c;
    for (const [k, body] of bodies.entries()) {
      // The last red coach carries a strip of rail; the clean red coach is used twice instead.
      if (body.name === 'dio_coach_red_b') continue;
      if (only.length && !only.includes(body.name)) continue;
      // Forward is toward the locomotive; for the locomotive, away from the first coach.
      const next = bodies[1].c;
      const forward = k === 0 ? [2 * loco[0] - next[0], 2 * loco[1] - next[1]] : loco;
      await writeProp(body.name, file, (n) => owner.get(partIndex(n)) === body.name, { forward });
    }
    continue;
  }
  for (const [name, { parts, rotY }] of Object.entries(props)) {
    if (only.length && !only.includes(name)) continue;
    await writeProp(name, file, (n) => parts === 'all' || parts.includes(partIndex(n)), { rotY });
  }
}
