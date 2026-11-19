'use client';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { registerGlow } from '@/src/scene/villageLights';
import * as THREE from 'three';

/**
 * Loads a prop GLB (Meshopt-compressed) and returns an independent clone with its own
 * materials, so each instance can change emissive/lights on its own (M2 pranks).
 */
export function useProp(url: string, emissiveIntensity: number, joinVillageLight = true, tint?: string) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      m.emissiveIntensity = emissiveIntensity;
      m.envMapIntensity = 0.6;
      if (tint) m.color.multiply(new THREE.Color(tint));
      mesh.material = m;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return clone;
  }, [scene, emissiveIntensity, tint]);

  // Let the judge's storm dim this prop's glow along with the rest of the village.
  useEffect(() => {
    if (!joinVillageLight) return;
    const off: (() => void)[] = [];
    object.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m) off.push(registerGlow(m, emissiveIntensity));
    });
    return () => off.forEach((f) => f());
  }, [object, emissiveIntensity, joinVillageLight]);

  return object;
}

export const MODEL_URLS = {
  shopA: '/models/shop_a.glb',
  shopB: '/models/shop_b.glb',
  shopAFar: '/models/shop_a_far.glb',
  shopBFar: '/models/shop_b_far.glb',
  lamp: '/models/street_lamp.glb',
  christmasTree: '/models/christmas_tree.glb',
  christmasTreeFar: '/models/christmas_tree_far.glb',
  snowman: '/models/snowman.glb',
  snowmanFar: '/models/snowman_far.glb',
  lampFar: '/models/street_lamp_far.glb',
  ground: '/models/ground.glb',
  groundFar: '/models/ground_far.glb',
  // The diorama's snowy pine (already loaded for the outside), not tree.glb: that one wore wizard hats.
  pine: '/models/dio_pine.glb',
};

/** Loaded only after the first screen (firstScreen.ts, detail.tsx): seen up close from inside only. */
export const NEAR_ONLY = new Set<string>([MODEL_URLS.shopA, MODEL_URLS.shopB, MODEL_URLS.christmasTree, MODEL_URLS.snowman, MODEL_URLS.lamp, MODEL_URLS.ground]);

Object.values(MODEL_URLS).forEach((u) => {
  if (!NEAR_ONLY.has(u)) useGLTF.preload(u);
});
