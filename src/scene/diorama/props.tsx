'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groundHeight } from './terrain';

/**
 * The diorama's models: split from multi-part Tripo sheets by scripts/split-diorama.mjs and
 * optimized by scripts/optimize-assets.mjs. Each stands on y = 0, centred, facing +z (the train's
 * cars face +x, their direction of travel).
 */
export const DIO = {
  chalet: '/models/dio_chalet.glb',
  houseA: '/models/dio_house_a.glb',
  houseB: '/models/dio_house_b.glb',
  rental: '/models/dio_rental.glb',
  locomotive: '/models/dio_locomotive.glb',
  coachGreen: '/models/dio_coach_green.glb',
  coachRed: '/models/dio_coach_red.glb',
  liftTower: '/models/dio_lift_tower.glb',
  gondola: '/models/dio_gondola_red.glb',
  skierRed: '/models/dio_skier_red.glb',
  skierGreen: '/models/dio_skier_green.glb',
  snowboarder: '/models/dio_snowboarder.glb',
  skiFamily: '/models/dio_ski_family.glb',
  pine: '/models/dio_pine.glb',
  pineL: '/models/dio_pine_l.glb',
  pineM: '/models/dio_pine_m.glb',
  pineS: '/models/dio_pine_s.glb',
  logs: '/models/dio_logs.glb',
  rock: '/models/dio_rock.glb',
  snowPile: '/models/dio_snow_pile.glb',
  signpost: '/models/dio_signpost.glb',
  fence: '/models/dio_fence.glb',
  bridge: '/models/dio_bridge.glb',
};

/** Lit windows (the emissive map the asset script derives from warm pixels). */
const WINDOW_GLOW = 1.6;

function tune(material: THREE.Material) {
  const m = material as THREE.MeshStandardMaterial;
  m.envMapIntensity = 0.5;
  if (m.emissiveMap) m.emissiveIntensity = WINDOW_GLOW;
  return m;
}

/**
 * A prop's meshes baked into its own space and merged into one geometry and one material, for
 * instancing. `height` is the size it is scaled to (unit = its own height when 1).
 */
export function useBaked(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    let material: THREE.Material | null = null;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      parts.push(g);
      material ??= mesh.material as THREE.Material;
    });
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts)!;
    geometry.computeBoundingBox();
    const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
    // Normalise to unit height so instance scales read as heights in table units.
    geometry.scale(1 / height, 1 / height, 1 / height);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, material: tune(material!) };
  }, [scene]);
}

/** A clone of a prop, scaled so it is `height` tall. Materials are shared between clones. */
export function useModel(url: string, height: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone, true);
    clone.scale.setScalar(height / (box.max.y - box.min.y));
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) tune(mesh.material as THREE.Material);
    });
    return clone;
  }, [scene, height]);
}

/** A prop standing on the snow at (x, z). */
export function Prop({ url, at, height, rotY = 0, sink = 0.004 }: { url: string; at: [number, number]; height: number; rotY?: number; sink?: number }) {
  const object = useModel(url, height);
  const [x, z] = at;
  return <primitive object={object} position={[x, groundHeight(x, z) - sink, z]} rotation-y={rotY} />;
}

Object.values(DIO).forEach((u) => useGLTF.preload(u));
