'use client';
 
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DIORAMA } from '@/src/game/constants';
import { DIO, Prop, useBaked } from './props';
import { groundHeight, lightPool, rand, trackPoint } from './terrain';

/** Snow, shared by the ground and the peaks: bright, a touch blue in the shade. */
export const SNOW_COLOR = '#c9d0de';
const snowMaterial = () => new THREE.MeshStandardMaterial({ color: SNOW_COLOR, roughness: 0.8, emissive: '#0c1222', emissiveIntensity: 0.5 });

/** The snow on the table: one mesh, shaped by groundHeight. */
function SnowGround() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.6, 3.3, 240, 220);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.95);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, groundHeight(x, z));
      col.fill(lightPool(x, z), i * 3, i * 3 + 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const material = useMemo(() => {
    const m = snowMaterial();
    m.vertexColors = true;
    return m;
  }, []);
  return <mesh geometry={geometry} material={material} />;
}

/**
 * A dollop of piped cream: a soft cone whose radius ripples along a groove that spirals up to a
 * curled tip, bulging where it slumps onto the table. Unit radius and height.
 */
function pipedPeak(twist: number, ridges: number, seed: number) {
  const radial = 56;
  const rows = 44;
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const u = j / rows;
    for (let i = 0; i <= radial; i++) {
      const t = (i / radial) * Math.PI * 2;
      const groove = 1 + 0.13 * Math.sin(t * ridges + u * twist + seed) * (1 - u * 0.6);
      const slump = 1 + 0.22 * (1 - u) ** 5;
      const r = (1 - u) ** 0.9 * groove * slump;
      // The tip leans and curls over.
      const lean = u ** 3 * 0.18;
      pos.push(Math.cos(t) * r + lean * Math.cos(seed), u, Math.sin(t) * r + lean * Math.sin(seed));
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** [x, z, radius, height, variant] of the free-standing peaks. */
const PEAKS: [number, number, number, number, number][] = [
  [-0.6, 0.08, 0.09, 0.15, 0],
  [-0.76, -0.3, 0.12, 0.22, 1],
  [-0.96, 0.0, 0.1, 0.17, 0],
  [0.62, 0.06, 0.09, 0.15, 1],
  [0.78, -0.32, 0.12, 0.24, 0],
  [0.98, 0.02, 0.1, 0.16, 1],
  [-0.55, -0.95, 0.1, 0.16, 1],
  [0.47, -1.02, 0.09, 0.14, 0],
  [-1.15, -0.45, 0.13, 0.2, 1],
  [1.15, -0.45, 0.13, 0.2, 0],
]
/** Peaks the train runs through. */
const TUNNEL_RADIUS = 0.1;
const TUNNEL_HEIGHT = 0.16;

function Peaks() {
  const variants = useMemo(() => [pipedPeak(15, 5, 0.6), pipedPeak(11, 4, 2.4)], []);
  const material = useMemo(() => snowMaterial(), []);
  const meshA = useRef<THREE.InstancedMesh>(null);
  const meshB = useRef<THREE.InstancedMesh>(null);
  const placed = useMemo(() => {
    const list: { x: number; z: number; r: number; h: number; v: number; rot: number }[] = PEAKS.map(([x, z, r, h, v], i) => ({ x, z, r, h, v, rot: rand(i, 3) * Math.PI * 2 }));
    DIORAMA.tunnels.forEach((a, i) => {
      const p = trackPoint(a);
      list.push({ x: p.x, z: p.z, r: TUNNEL_RADIUS, h: TUNNEL_HEIGHT, v: i % 2, rot: rand(i, 9) * Math.PI * 2 });
    });
    return list;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const v of [0, 1]) {
      const mesh = (v === 0 ? meshA : meshB).current;
      if (!mesh) continue;
      let n = 0;
      for (const p of placed) {
        if (p.v !== v) continue;
        q.setFromAxisAngle(up, p.rot);
        m.compose(new THREE.Vector3(p.x, groundHeight(p.x, p.z) - 0.01, p.z), q, new THREE.Vector3(p.r, p.h, p.r));
        mesh.setMatrixAt(n++, m);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [placed]);

  return (
    <>
      {variants.map((g, v) => (
        <instancedMesh key={v} ref={v === 0 ? meshA : meshB} args={[g, material, placed.length]} />
      ))}
    </>
  );
}

/** Stone arches where the track goes into each tunnel peak, dark inside. */
function TunnelPortals() {
  const portals = useMemo(() => {
    const out: { pos: THREE.Vector3; rotY: number }[] = [];
    // How far round the loop the peak's foot reaches from its centre.
    // The peak slumps ~1.2× wider at its foot; the arch sits just inside that.
    const reach = (TUNNEL_RADIUS * 1.12) / DIORAMA.trackRadius;
    for (const a of DIORAMA.tunnels)
      for (const side of [-1, 1]) {
        const at = a + side * reach;
        const pos = trackPoint(at);
        // Facing along the track, out of the hill.
        const tangent = new THREE.Vector3(-Math.sin(at), 0, Math.cos(at)).multiplyScalar(side);
        out.push({ pos, rotY: Math.atan2(tangent.x, tangent.z) });
      }
    return out;
  }, []);
  const arch = useMemo(() => new THREE.TorusGeometry(0.028, 0.007, 8, 20, Math.PI), []);
  const hole = useMemo(() => new THREE.CircleGeometry(0.028, 20, 0, Math.PI), []);
  return (
    <>
      {portals.map((p, i) => (
        <group key={i} position={p.pos} rotation-y={p.rotY}>
          <mesh geometry={arch}>
            <meshStandardMaterial color="#6f6a66" roughness={0.9} />
          </mesh>
          <mesh geometry={hole} position-z={-0.004}>
            <meshBasicMaterial color="#050506" />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Two rails and the ties under them, all the way round. */
function Track() {
  const { rails, ties } = useMemo(() => {
    const R = DIORAMA.trackRadius;
    const gauge = 0.011;
    const railGeoms = [R - gauge, R + gauge].map((r) => {
      const g = new THREE.TorusGeometry(r, 0.0016, 4, 220);
      g.rotateX(Math.PI / 2);
      g.translate(0, DIORAMA.bedHeight + 0.005, 0);
      return g;
    });
    const tieCount = 180;
    const tie = new THREE.BoxGeometry(0.034, 0.003, 0.007);
    const tieList: THREE.BufferGeometry[] = [];
    for (let i = 0; i < tieCount; i++) {
      const a = (i / tieCount) * Math.PI * 2;
      const g = tie.clone();
      g.rotateY(-a);
      const p = trackPoint(a);
      g.translate(p.x, DIORAMA.bedHeight + 0.0015, p.z);
      tieList.push(g);
    }
    return { rails: mergeGeometries(railGeoms)!, ties: mergeGeometries(tieList)! };
  }, []);
  return (
    <>
      <mesh geometry={rails}>
        <meshStandardMaterial color="#8a8f99" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh geometry={ties}>
        <meshStandardMaterial color="#3b2a20" roughness={0.9} />
      </mesh>
    </>
  );
}

/** The models standing on the table: [model, x, z, height, rotY, keep-clear radius]. */
const PROPS: [keyof typeof DIO, number, number, number, number, number][] = [
  ['chalet', -0.64, -0.68, 0.14, 0.5, 0.13],
  ['rental', 0.55, -0.84, 0.085, -0.45, 0.09],
  ['houseA', -0.98, -1.2, 0.1, 0.75, 0.1],
  ['houseB', 1.02, -1.22, 0.1, -0.7, 0.1],
  ['signpost', 0.45, -0.74, 0.05, -0.3, 0.03],
  ['logs', -0.5, -0.6, 0.022, 0.2, 0.03],
  ['fence', -0.72, -0.55, 0.024, 0.5, 0.04],
  ['bridge', -0.3, -0.66, 0.03, 0.15, 0.06],
  ['rock', 0.74, -0.52, 0.05, 0.9, 0.05],
  ['rock', -0.86, -0.58, 0.045, -0.6, 0.05],
  ['snowPile', -0.22, -0.82, 0.022, 0.4, 0.04],
  ['snowPile', 0.28, -0.72, 0.02, 1.7, 0.04],
  ['snowPile', 0.7, -0.14, 0.018, 2.6, 0.03],
];

/** Is (x, z) somewhere a tree may stand: off the track, away from the globe, the peaks and the props. */
export function freeSpot(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r < DIORAMA.clearRadius + 0.05) return false;
  if (Math.abs(r - DIORAMA.trackRadius) < 0.05) return false;
  for (const [px, pz, pr] of PEAKS) if (Math.hypot(x - px, z - pz) < pr * 0.95) return false;
  for (const [, px, pz, , , pr] of PROPS) if (Math.hypot(x - px, z - pz) < pr) return false;
  return true;
}

/** Three generated sizes, plus the hand-made pine for the tallest few (it is heavier). */
const PINE_MODELS = [DIO.pineL, DIO.pineM, DIO.pineS, DIO.pine] as const;

/** One kind of snowy pine, instanced at its share of the spots. */
function PineKind({ url, spots }: { url: string; spots: [number, number, number, number][] }) {
  const { geometry, material } = useBaked(url);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    spots.forEach(([x, z, h, i], n) => {
      q.setFromAxisAngle(up, rand(i, 6) * Math.PI * 2);
      m.compose(new THREE.Vector3(x, groundHeight(x, z) - 0.004, z), q, new THREE.Vector3(h, h, h));
      mesh.setMatrixAt(n, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots]);
  return <instancedMesh ref={ref} args={[geometry, material, spots.length]} />;
}

/** Snowy pines in three sizes, thick at the mountains' feet and sparse on the open table. */
function Pines() {
  const kinds = useMemo(() => {
    const out: [number, number, number, number][][] = [[], [], [], []];
    let placed = 0;
    for (let i = 0; placed < DIORAMA.pines && i < 4000; i++) {
      const x = (rand(i, 1) - 0.5) * 2.6;
      const z = -rand(i, 2) * 2.3 + 0.35;
      if (!freeSpot(x, z)) continue;
      if (z > 0.0 && rand(i, 5) < 0.5) continue;
      const k = rand(i, 8);
      const h = 0.06 + rand(i, 4) * 0.07;
      const kind = h > 0.122 ? 3 : k < 0.3 ? 0 : k < 0.7 ? 1 : 2;
      out[kind].push([x, z, h, i]);
      placed++;
    }
    return out;
  }, []);
  return (
    <>
      {PINE_MODELS.map((url, k) => (
        <PineKind key={url} url={url} spots={kinds[k]} />
      ))}
    </>
  );
}

export function Scenery() {
  return (
    <>
      <SnowGround />
      <Peaks />
      <TunnelPortals />
      <Track />
      <Pines />
      {PROPS.map(([model, x, z, height, rotY], i) => (
        <Prop key={i} url={DIO[model]} at={[x, z]} height={height} rotY={rotY} />
      ))}
    </>
  );
}
