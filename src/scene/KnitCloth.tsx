'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { knitTextures } from './proceduralTextures';

/**
 * Dark chunky knit the globe rests on. Not a room: just the cloth under the object, folding
 * away into darkness. Folds are flattened under the base so the globe sits level.
 */
export function KnitCloth() {
  const { geometry, tex } = useMemo(() => {
    const g = new THREE.PlaneGeometry(9, 6, 220, 150);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      // Big soft folds, a ridge behind the globe, rumpled rolls left and right.
      let y =
        0.09 * Math.sin(x * 1.6 + z * 0.5) +
        0.06 * Math.sin(z * 2.3 - x * 0.8 + 1.3) +
        0.035 * Math.sin(x * 4.1 + Math.sin(z * 2.0) * 1.5);
      y += 0.22 * Math.exp(-((z + 0.9) ** 2) * 3) * (0.6 + 0.4 * Math.sin(x * 2.2));
      y += 0.18 * Math.exp(-((Math.abs(x) - 1.3) ** 2) * 2.5) * Math.exp(-(z ** 2) * 0.6);
      const flat = THREE.MathUtils.smoothstep(r, 0.5, 1.1);
      pos.setY(i, y * flat - 0.012 * (1 - flat));
    }
    g.computeVertexNormals();
    return { geometry: g, tex: knitTextures([11, 7]) };
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={tex.map} bumpMap={tex.bump} bumpScale={6} roughness={0.92} color="#8d9099" />
    </mesh>
  );
}
