'use client';
/* eslint-disable react-hooks/immutability -- flakes are per-frame simulation state, moved in useFrame */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOBE } from '@/src/game/constants';
import { rand } from './terrain';

/** Flakes over the diorama, in the table's units. */
const COUNT = 1400;
const BOX = { x: 1.7, top: 1.15, back: -2.4, front: 0.7 };
/** The globe, which the outside snow keeps out of (its own snow falls in there). */
const GLOBE_C = new THREE.Vector3(0, GLOBE.centerY * GLOBE.scale, 0);
const GLOBE_R = GLOBE.radius * GLOBE.scale + 0.01;

/** A soft round flake, drawn once. */
function flakeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Slow snow over the whole model, the kind you'd see falling on a lit shop-window diorama:
 * flakes drift and sway down, settle out of sight and start again at the top.
 */
export function Snowfall() {
  const points = useRef<THREE.Points>(null);
  const { geometry, flakes } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const flakes = Array.from({ length: COUNT }, (_, i) => {
      const f = { x: (rand(i, 51) - 0.5) * 2 * BOX.x, y: rand(i, 52) * BOX.top, z: BOX.back + rand(i, 53) * (BOX.front - BOX.back), fall: 0.035 + rand(i, 54) * 0.04, sway: 0.01 + rand(i, 55) * 0.02, phase: rand(i, 56) * 6.28, rate: 0.5 + rand(i, 57) };
      pos.set([f.x, f.y, f.z], i * 3);
      return f;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, BOX.top / 2, (BOX.back + BOX.front) / 2), 3);
    return { geometry: g, flakes };
  }, []);
  const material = useMemo(
    () => new THREE.PointsMaterial({ size: 0.011, map: flakeTexture(), transparent: true, depthWrite: false, opacity: 0.85, color: '#e8eefa', sizeAttenuation: true }),
    [],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;
    const attr = geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    flakes.forEach((f, i) => {
      f.y -= f.fall * dt;
      if (f.y < -0.02) {
        f.y = BOX.top;
        f.x = (Math.random() - 0.5) * 2 * BOX.x;
        f.z = BOX.back + Math.random() * (BOX.front - BOX.back);
      }
      const x = f.x + Math.sin(t * f.rate + f.phase) * f.sway;
      const z = f.z + Math.cos(t * f.rate * 0.7 + f.phase) * f.sway * 0.6;
      // Inside the globe: park it out of sight.
      const inGlobe = (x - GLOBE_C.x) ** 2 + (f.y - GLOBE_C.y) ** 2 + (z - GLOBE_C.z) ** 2 < GLOBE_R * GLOBE_R;
      arr[i * 3] = x;
      arr[i * 3 + 1] = inGlobe ? -1 : f.y;
      arr[i * 3 + 2] = z;
    });
    attr.needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
