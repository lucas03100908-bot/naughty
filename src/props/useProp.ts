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
  lamp: '/models/street_lamp.glb',
  christmasTree: '/models/christmas_tree.glb',
  snowman: '/models/snowman.glb',
  ground: '/models/ground.glb',
  pine: '/models/tree.glb',
};

Object.values(MODEL_URLS).forEach((u) => useGLTF.preload(u));
