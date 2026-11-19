'use client';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { noise } from './terrain';

/**
 * Banks of mist lying in the valleys: between the range and the near mountains, round the
 * mountains' feet, and thin wisps low over the snow in front. Each is a flat card facing the
 * viewer with a soft cloud texture drifting slowly sideways through a fixed feathered outline,
 * so it reads as haze moving through, not a sheet sliding.
 */
type Bank = { x: number; y: number; z: number; w: number; h: number; opacity: number; drift: number };
const BANKS: Bank[] = [
  // Behind the near mountains, along the range's foot.
  { x: 0, y: 0.08, z: -1.62, w: 3.4, h: 0.26, opacity: 0.42, drift: 0.006 },
  { x: 0.2, y: 0.16, z: -1.95, w: 3.6, h: 0.36, opacity: 0.32, drift: -0.004 },
  // Round the feet of the mountains either side of the globe.
  { x: -0.95, y: 0.05, z: -1.12, w: 1.5, h: 0.17, opacity: 0.34, drift: 0.008 },
  { x: 0.98, y: 0.05, z: -1.18, w: 1.5, h: 0.17, opacity: 0.34, drift: -0.007 },
  // Thin wisps low over the snow nearer the viewer.
  { x: -1.05, y: 0.022, z: -0.42, w: 1.1, h: 0.07, opacity: 0.26, drift: 0.01 },
  { x: 1.05, y: 0.022, z: -0.5, w: 1.1, h: 0.07, opacity: 0.26, drift: -0.009 },
];
const MIST_COLOR = '#9aa6c2';

/** A tiling cloud texture: a few octaves of value noise in the alpha. */
function cloudTexture() {
  const w = 256, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  // Sample on a torus so the texture tiles sideways.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = (x / w) * Math.PI * 2;
      let v = 0, amp = 0.5, f = 1;
      for (let o = 0; o < 4; o++) {
        v += amp * noise(Math.cos(a) * 2.2 * f + 11, Math.sin(a) * 2.2 * f + (y / h) * 3 * f);
        amp *= 0.5;
        f *= 2;
      }
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.max(0, Math.min(255, (v - 0.28) * 2.2 * 255));
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** The bank's outline: soft all round, softest at the top. */
function featherTexture() {
  const w = 128, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1), v = y / (h - 1);
      const side = THREE.MathUtils.smoothstep(Math.min(u, 1 - u), 0, 0.3);
      // v = 0 is the top row of the canvas: fade up into nothing, firm-ish at the bottom.
      const vert = THREE.MathUtils.smoothstep(v, 0, 0.7) * (1 - THREE.MathUtils.smoothstep(v, 0.82, 1));
      const g = side * vert * 255;
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = g;
      img.data[k + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export function Mist() {
  const { banks, maps } = useMemo(() => {
    const cloud = cloudTexture();
    const feather = featherTexture();
    const maps: THREE.Texture[] = [];
    const banks = BANKS.map((b, i) => {
      const map = cloud.clone();
      map.repeat.set(b.w / 1.6, 1);
      map.offset.x = i * 0.37;
      map.needsUpdate = true;
      maps.push(map);
      const material = new THREE.MeshBasicMaterial({
        color: MIST_COLOR,
        map,
        alphaMap: feather,
        transparent: true,
        opacity: b.opacity,
        depthWrite: false,
        fog: false,
      });
      return { b, material };
    });
    return { banks, maps };
  }, []);

  useFrame((_, dt) => {
    maps.forEach((m, i) => (m.offset.x += BANKS[i].drift * Math.min(dt, 0.1)));
  });

  return (
    <>
      {banks.map(({ b, material }, i) => (
        <mesh key={i} position={[b.x, b.y + b.h / 2, b.z]} material={material} renderOrder={2}>
          <planeGeometry args={[b.w, b.h]} />
        </mesh>
      ))}
    </>
  );
}
