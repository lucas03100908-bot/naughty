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

type Skier = { run: number; t: number; speed: number; turns: number; amp: number; phase: number };

/** Tiny skiers carving down the runs; at the bottom they vanish and start again at the top. */
export function Skiers() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const skiers = useMemo(() => {
    const list: Skier[] = [];
    RUNS.forEach(([, , , , count], run) => {
      for (let k = 0; k < count; k++) {
        const i = list.length;
        const [lo, hi] = DIORAMA.skierSpeed;
        list.push({ run, t: (k / count + rand(i, 21) * 0.3) % 1, speed: lo + (hi - lo) * rand(i, 22), turns: 3 + Math.floor(rand(i, 23) * 3), amp: 0.035 + rand(i, 24) * 0.035, phase: rand(i, 25) * 6 });
      }
    });
    return list;
  }, []);

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), e: new THREE.Euler(0, 0, 0, 'YXZ') }), []);

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
    const { a, b, e } = tmp;
    skiers.forEach((sk, i) => {
      const g = groups.current[i];
      if (!g) return;
      sk.t += sk.speed * dt;
      if (sk.t >= 1) sk.t -= 1;
      at(sk, sk.t, a);
      at(sk, Math.min(1, sk.t + 0.01), b);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const horiz = Math.hypot(dx, dz) || 1e-6;
      // Facing down the line, pitched with the slope, leaning into each turn.
      const lean = Math.cos(sk.t * Math.PI * sk.turns + sk.phase) * 0.35;
      e.set(Math.atan2(-(b.y - a.y), horiz) * 0.8, Math.atan2(dx, dz), lean);
      g.position.copy(a);
      g.rotation.copy(e);
      // Appear at the top, vanish at the bottom.
      g.scale.setScalar(THREE.MathUtils.smoothstep(sk.t, 0, 0.05) * (1 - THREE.MathUtils.smoothstep(sk.t, 0.93, 1)) || 1e-4);
    });
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
    </>
  );
}
