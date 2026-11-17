'use client';
import { GLOBE } from '@/src/game/constants';

/**
 * Code-built glass dome (replaces the Tripo glass mesh). MeshPhysicalMaterial transmission
 * is cheaper than drei's MeshTransmissionMaterial and holds 60fps on integrated GPUs.
 */
export function Glass() {
  return (
    <mesh position-y={GLOBE.centerY} renderOrder={2}>
      <sphereGeometry args={[GLOBE.radius, 128, 96]} />
      <meshPhysicalMaterial
        transmission={1}
        thickness={0.04}
        roughness={0.03}
        ior={1.45}
        metalness={0}
        clearcoat={0.3}
        clearcoatRoughness={0.02}
        specularIntensity={0.7}
        envMapIntensity={0.8}
        color="#f4f8ff"
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
