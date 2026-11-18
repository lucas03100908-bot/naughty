'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { GLOBE } from '@/src/game/constants';
import { cobbleTextures, woodTextures } from './proceduralTextures';

/** Turned walnut base + the cobbled floor disc that closes the globe. */
export function Base() {
  const { geometry, wood, cobble } = useMemo(() => {
    const top = GLOBE.floorY;
    // Lathe profile, bottom to top (radius, height).
    // Designed for a 0.32-tall base, scaled to the floor height.
    const k = top / 0.32;
    const profile = [
      [0.0, 0.0],
      [0.43, 0.0],
      [0.445, 0.012],
      [0.445, 0.035],
      [0.43, 0.05],
      [0.405, 0.06],
      [0.4, 0.075],
      [0.4, 0.22],
      [0.41, 0.235],
      [0.41, 0.26],
      [0.4, 0.275],
      [0.395, 0.308],
      [0.4, 0.32],
      [0.0, 0.32],
    ].map(([r, y]) => new THREE.Vector2(r, y * k));
    const g = new THREE.LatheGeometry(profile, 128);
    g.computeVertexNormals();
    return { geometry: g, wood: woodTextures(), cobble: cobbleTextures() };
  }, []);

  return (
    <group>
      <mesh geometry={geometry} rotation-y={Math.PI}>
        <meshPhysicalMaterial
          map={wood.map}
          roughnessMap={wood.roughness}
          roughness={0.55}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          color="#ffffff"
        />
      </mesh>
      {/* Floor disc inside the globe. The heightfield snow sits on top of it. */}
      <mesh rotation-x={-Math.PI / 2} position-y={GLOBE.floorY + 0.0005}>
        <circleGeometry args={[GLOBE.floorRadius, 96]} />
        <meshStandardMaterial map={cobble.map} bumpMap={cobble.bump} bumpScale={0.8} roughness={0.85} color="#8a8f9a" />
      </mesh>
    </group>
  );
}
