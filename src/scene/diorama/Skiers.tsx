'use client';
 
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DIORAMA } from '@/src/game/constants';
import { DIO, useModel } from './props';
import { groundHeight, rand } from './terrain';

/** Runs down the mountains: [startX, startZ, endX, endZ, how many skiers]. */
const RUNS: [number, number, number, number, number][] = [
  [-0.85, -1.8, -0.62, -1.05, 2],
  [-0.62, -1.75, -0.47, -1.12, 1],
  [-1.02, -1.75, -0.95, -1.0, 2],
  [1.02, -1.8, 1.06, -1.05, 1],
  [0.62, -1.78, 0.44, -1.15, 1],
  [-1.38, -1.45, -1.22, -0.75, 1],
  [1.38, -1.45, 1.26, -0.75, 1],
];
/** The figures, cycled over the skiers. */
const FIGURES = [DIO.skierRed, DIO.skierGreen, DIO.snowboarder, DIO.skiFamily];
const SKIER_H = 0.034;

/** One skier figure; its group is moved every frame by Skiers. */
function Figure({ url, groupRef }: { url: string; groupRef: (g: THREE.Group | null) => void }) {
  const object = useModel(url, SKIER_H);
  return (
    <group ref={groupRef}>
      <primitive object={object} />
    </group>
  );
}

type Skier = { run: number; t: number; speed: number; turns: number; amp: number; phase: number; sprayed: number };

/** Snow kicked up by the skis at the top of each turn. */
const SPRAY = 90;
type Grain = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number };

/**
 * Tiny skiers carving down the runs: quick across the fall line, slowing and sinking into the
 * knees at the top of each turn with the skis skidding and throwing snow, leaning into it. At the
 * bottom they glide to a stop and vanish, then start again at the top.
 */
export function Skiers() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const spray = useRef<THREE.InstancedMesh>(null);
  const skiers = useMemo(() => {
    const list: Skier[] = [];
    RUNS.forEach(([, , , , count], run) => {
      for (let k = 0; k < count; k++) {
        const i = list.length;
        const [lo, hi] = DIORAMA.skierSpeed;
        list.push({ run, t: (k / count + rand(i, 21) * 0.3) % 1, speed: lo + (hi - lo) * rand(i, 22), turns: 3 + Math.floor(rand(i, 23) * 3), amp: 0.035 + rand(i, 24) * 0.035, phase: rand(i, 25) * 6, sprayed: 0 });
      }
    });
    return list;
  }, []);
  const grains = useMemo<Grain[]>(() => Array.from({ length: SPRAY }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 1 })), []);
  const next = useRef(0);

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), e: new THREE.Euler(0, 0, 0, 'YXZ'), m: new THREE.Matrix4() }), []);

  /** Where a skier is at progress t: down the fall line, swinging across it. */
  const at = (sk: Skier, t: number, out: THREE.Vector3) => {
    const [sx, sz, ex, ez] = RUNS[sk.run];
    const dx = ex - sx;
    const dz = ez - sz;
    const len = Math.hypot(dx, dz);
    const swing = Math.sin(t * Math.PI * sk.turns + sk.phase) * sk.amp;
    const x = sx + dx * t + (-dz / len) * swing;
    const z = sz + dz * t + (dx / len) * swing;
    return out.set(x, groundHeight(x, z), z);
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { a, b, e, m } = tmp;
    skiers.forEach((sk, i) => {
      const g = groups.current[i];
      if (!g) return;
      const turn = sk.t * Math.PI * sk.turns + sk.phase;
      // How deep into a turn: 0 crossing the fall line, 1 at the top of the turn.
      const apex = Math.sin(turn) ** 2;
      // Fast across the fall line, slow at the top of each turn; glide to a stop at the bottom.
      const pace = (0.55 + 0.75 * (1 - apex)) * (1 - 0.85 * THREE.MathUtils.smoothstep(sk.t, 0.86, 0.97));
      sk.t += sk.speed * pace * dt;
      if (sk.t >= 1) {
        sk.t -= 1;
        sk.sprayed = 0;
      }
      at(sk, sk.t, a);
      at(sk, Math.min(1, sk.t + 0.01), b);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const horiz = Math.hypot(dx, dz) || 1e-6;
      // Lean toward the inside of the turn (the swing's curvature), skis skidding across the
      // line at the top of it.
      const inside = -Math.sin(turn);
      e.set(Math.atan2(-(b.y - a.y), horiz) * 0.8, Math.atan2(dx, dz) + inside * 0.35, inside * 0.5);
      g.position.copy(a);
      g.rotation.copy(e);
      // Sink into the knees through the turn; appear at the top, vanish at the bottom.
      const fade = THREE.MathUtils.smoothstep(sk.t, 0, 0.04) * (1 - THREE.MathUtils.smoothstep(sk.t, 0.96, 1)) || 1e-4;
      g.scale.set(fade * (1 + 0.05 * apex), fade * (1 - 0.13 * apex), fade * (1 + 0.05 * apex));

      // A burst of snow off the skis' outer edge at the top of each turn.
      const turnIndex = Math.floor((turn - Math.PI / 2) / Math.PI);
      if (apex > 0.92 && turnIndex !== sk.sprayed && sk.t > 0.04 && sk.t < 0.9) {
        sk.sprayed = turnIndex;
        // Outside of the turn, across the direction of travel.
        const ox = (dz / horiz) * inside;
        const oz = (-dx / horiz) * inside;
        for (let k = 0; k < 7; k++) {
          const gr = grains[next.current];
          next.current = (next.current + 1) % SPRAY;
          const r = rand(i * 31 + k, turnIndex + 40);
          gr.x = a.x;
          gr.y = a.y + 0.003;
          gr.z = a.z;
          gr.vx = ox * (0.05 + r * 0.05) + (dx / horiz) * 0.02 + (rand(k, i) - 0.5) * 0.02;
          gr.vz = oz * (0.05 + r * 0.05) + (dz / horiz) * 0.02 + (rand(k + 9, i) - 0.5) * 0.02;
          gr.vy = 0.05 + r * 0.05;
          gr.age = 0;
        }
      }
    });

    const mesh = spray.current;
    if (!mesh) return;
    grains.forEach((gr, i) => {
      if (gr.age < 1) {
        gr.age += dt / 0.7;
        gr.vy -= 0.25 * dt;
        gr.x += gr.vx * dt;
        gr.y += gr.vy * dt;
        gr.z += gr.vz * dt;
      }
      const size = gr.age < 1 ? 0.0022 * (1 - gr.age * 0.6) : 0;
      m.makeScale(size, size, size).setPosition(gr.x, gr.y, gr.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {skiers.map((_, i) => (
        <Figure
          key={i}
          url={FIGURES[i % FIGURES.length]}
          groupRef={(g) => {
            groups.current[i] = g;
          }}
        />
      ))}
      <instancedMesh ref={spray} args={[undefined, undefined, SPRAY]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#eef2f8" roughness={1} emissive="#1a2236" emissiveIntensity={0.6} />
      </instancedMesh>
    </>
  );
}
