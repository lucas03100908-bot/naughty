'use client';
import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Loads a prop GLB (Meshopt-compressed) and returns an independent clone with its own
 * materials, so each instance can change emissive/lights on its own (M2 pranks).
 */
export function useProp(url: string, emissiveIntensity: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      m.emissiveIntensity = emissiveIntensity;
      m.envMapIntensity = 0.6;
      mesh.material = m;
    });
    return clone;
  }, [scene, emissiveIntensity]);
}

export const MODEL_URLS = {
  shopA: '/models/shop_a.glb',
  shopB: '/models/shop_b.glb',
  tree: '/models/tree.glb',
  lamp: '/models/street_lamp.glb',
};

Object.values(MODEL_URLS).forEach((u) => useGLTF.preload(u));
