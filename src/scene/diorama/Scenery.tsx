'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are configured in place by design (R3F). */
import { useGLTF, useTexture } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DIORAMA } from '@/src/game/constants';
import { PROPS, TUNNEL_PAD } from './layout';
import { DIO, Prop, useBaked } from './props';
import { fieldUV, groundHeight, lightPool, noise, rand, trackPoint } from './terrain';

/** Snow, shared by the ground and the peaks: bright, a touch blue in the shade. */
export const SNOW_COLOR = '#c9d0de';
const snowMaterial = () => new THREE.MeshStandardMaterial({ color: SNOW_COLOR, roughness: 0.8, emissive: '#0c1222', emissiveIntensity: 0.5 });

/** Rock where the snow can't hold: steep faces and ridgelines of the mountains. */
const ROCK = new THREE.Color('#5d5047');

/**
 * The snow on the table: one mesh, shaped by groundHeight. Vertex colours carry the lamp's pool
 * of light, a little shade down in the grooves, and bare rock streaking the steep upper faces.
 */
function SnowGround() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.6, 3.3, 240, 220);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.95);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const snow = new THREE.Color(1, 1, 1);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ny = nrm.getY(i);
      // Shade the grooves and flanks a touch, so the piping reads.
      const shade = 0.78 + 0.22 * THREE.MathUtils.smoothstep(ny, 0.55, 0.98);
      // Streaks of rock: steep, high, and along a stretched noise so they run down the slope.
      const steep = THREE.MathUtils.smoothstep(ny, 0.86, 0.62);
      const high = THREE.MathUtils.smoothstep(y, 0.07, 0.16);
      const streak = THREE.MathUtils.smoothstep(noise(x * 9 + z * 3, y * 26) * 0.7 + noise(x * 31, z * 31) * 0.3, 0.5, 0.68);
      const rock = steep * high * streak * 0.85;
      c.copy(snow).lerp(ROCK, rock).multiplyScalar(lightPool(x, z) * shade);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // The snowfield's colour map (its rock and shadowed hollows), laid flat from above.
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const [u, v] = fieldUV(pos.getX(i), pos.getZ(i));
      uv.setXY(i, u, 1 - v);
    }
    return g;
  }, []);
  const field = useTexture('/models/snowfield_color.jpg');
  const material = useMemo(() => {
    field.colorSpace = THREE.SRGBColorSpace;
    field.wrapS = field.wrapT = THREE.ClampToEdgeWrapping;
    field.anisotropy = 4;
    const m = snowMaterial();
    m.vertexColors = true;
    m.map = field;
    return m;
  }, [field]);
  return <mesh geometry={geometry} material={material} />;
}

/**
 * Each tunnel is two tunnel-mouth models back to back across the track, one facing each way, their
 * closed backs meeting in the middle: a rocky snow-capped hill the train runs through.
 */
const TUNNEL_MODEL = {
  /** Model scale: its arch (≈0.385 tall in its own units) a good bit taller than the locomotive. */
  scale: 0.143,
  /** Where the arch face is, in its own units along +z (its back is at -0.48). */
  face: 0.27,
  /**
   * Height (its own units) where split-diorama cut off its slab and straight track: that edge goes
   * just under the snow, so only the diorama's own curved rails run into the arch.
   */
  cut: 0.125,
};
/**
 * How far round the loop (radians) each portal is from its tunnel's centre: one model's depth
 * from arch face to back. The train is clipped at the portals.
 */
export const TUNNEL_REACH = ((TUNNEL_MODEL.face + 0.48) * TUNNEL_MODEL.scale) / DIORAMA.trackRadius;

function TunnelMouth({ at, side }: { at: number; side: number }) {
  const { scene } = useGLTF(DIO.tunnel);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.scale.setScalar(TUNNEL_MODEL.scale);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.envMapIntensity = 0.5;
      // The lanterns inside the arch.
      if (m.emissiveMap) m.emissiveIntensity = 2.2;
    });
    return clone;
  }, [scene]);
  const { position, rotY } = useMemo(() => {
    const portal = at + side * TUNNEL_REACH;
    const p = trackPoint(portal);
    // Facing along the track, away from the tunnel's centre.
    const dir = new THREE.Vector3(-Math.sin(portal), 0, Math.cos(portal)).multiplyScalar(side);
    // Arch face on the portal: the model's origin sits a face-depth back from it.
    p.addScaledVector(dir, -TUNNEL_MODEL.face * TUNNEL_MODEL.scale);
    p.y = -(TUNNEL_MODEL.cut + 0.01) * TUNNEL_MODEL.scale;
    return { position: p, rotY: Math.atan2(dir.x, dir.z) };
  }, [at, side]);
  return <primitive object={object} position={position} rotation-y={rotY} />;
}

function Tunnels() {
  return (
    <>
      {DIORAMA.tunnels.map((a) => [-1, 1].map((side) => <TunnelMouth key={`${a}${side}`} at={a} side={side} />))}
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



/** Rocky peaks far behind, on the dark beyond the table's edge: [x, z, height, rotY]. */
const SKYLINE: [number, number, number, number][] = [
  [-1.45, -2.25, 0.42, 2.1],
  [1.6, -2.25, 0.4, -1.4],
];

/**
 * The mountain range behind the globe: a Tripo snow-terrain tile cut down to its rocky ridge,
 * stretched across the back of the table and squashed a little in height so it stays a model's
 * mountain, not a real one. The tile stands on a thick slab with its snowfield about halfway up,
 * so it is sunk by half its height; terrain's berm hides the cut edge in front.
 */
const RANGE = { width: 2.9, height: 0.9, front: -1.72, sinkFrac: 0.5 };

function Range() {
  const { scene } = useGLTF(DIO.range);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone, true);
    const size = box.getSize(new THREE.Vector3());
    const k = RANGE.width / size.x;
    clone.scale.set(k, RANGE.height / size.y, k);
    clone.position.set(0, -RANGE.height * RANGE.sinkFrac, RANGE.front - (size.z * k) / 2);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.envMapIntensity = 0.4;
      // Where the cut edge peeks over the berm, show the tile's inside rather than a hole.
      m.side = THREE.DoubleSide;
      mesh.receiveShadow = true;
    });
    return clone;
  }, [scene]);
  return <primitive object={object} />;
}

/** Is (x, z) somewhere a tree may stand: off the track, away from the globe, the peaks and the props. */
export function freeSpot(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r < DIORAMA.clearRadius + 0.05) return false;
  // Not up on the range behind.
  if (z < RANGE.front + 0.04) return false;
  if (Math.abs(r - DIORAMA.trackRadius) < 0.05) return false;
  for (const t of DIORAMA.tunnels) {
    const p = trackPoint(t);
    if (Math.hypot(x - p.x, z - p.z) < TUNNEL_PAD) return false;
  }
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
      <Tunnels />
      <Track />
      <Pines />
      {PROPS.map(([model, x, z, height, rotY], i) => (
        <Prop key={i} url={DIO[model]} at={[x, z]} height={height} rotY={rotY} />
      ))}
      <Range />
      {SKYLINE.map(([x, z, height, rotY], i) => (
        <Prop key={`sky${i}`} url={DIO.mountain} at={[x, z]} height={height} rotY={rotY} base={-0.06} />
      ))}
    </>
  );
}
