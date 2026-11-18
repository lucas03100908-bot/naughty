import type * as THREE from 'three';

/**
 * Glowing prop materials (shop windows, small trees) register here with their base emissive
 * intensity. The judge's storm dims them all at once through `applyVillageLight`.
 * Props that run their own glow (street lamps, tree bulbs) multiply by live.villageLight
 * themselves instead of registering.
 */
const registry = new Set<{ m: THREE.MeshStandardMaterial; base: number }>();

export function registerGlow(m: THREE.MeshStandardMaterial, base: number) {
  const entry = { m, base };
  registry.add(entry);
  return () => {
    registry.delete(entry);
  };
}

export function applyVillageLight(k: number) {
  for (const e of registry) e.m.emissiveIntensity = e.base * k;
}
