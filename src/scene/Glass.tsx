'use client';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { live } from '@/src/game/store';
import { GLOBE } from '@/src/game/constants';
import { updateGlobeOutline } from './transmissionCull';

/**
 * Code-built glass dome (replaces the Tripo glass mesh). MeshPhysicalMaterial transmission
 * is cheaper than drei's MeshTransmissionMaterial and holds 60fps on integrated GPUs.
 * Double-sided once inside, so the dome still reads as glass from inside the village.
 */
export function Glass() {
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ camera, size }) => {
    // From inside, the dome's transmission re-draws the street blurred and refracted over itself:
    // a ghost copy that trails everything when the head moves (and a grey column of reflection).
    // Once the camera is all the way in, don't draw the glass at all.
    if (mesh.current) mesh.current.visible = live.viewBlend < GLASS_HIDE_INSIDE;
    if (mat.current) {
      mat.current.envMapIntensity = THREE.MathUtils.lerp(0.8, 0.12, live.viewBlend);
      // From outside only the near face shows, and the far face is a second full layer of
      // refraction over the whole globe; draw both sides only once the camera goes in.
      const side = live.viewBlend > 0.5 ? THREE.DoubleSide : THREE.FrontSide;
      if (mat.current.side !== side) {
        mat.current.side = side;
        mat.current.needsUpdate = true;
      }
    }
    // Where the globe is on screen, so the diorama can skip the transmission pass outside it.
    if (mesh.current) {
      mesh.current.updateWorldMatrix(true, false);
      updateGlobeOutline(mesh.current, camera, size.width / size.height);
    }
  });
  return (
    <mesh ref={mesh} position-y={GLOBE.centerY} renderOrder={2}>
      <sphereGeometry args={[GLOBE.radius, 96, 64]} />
      <meshPhysicalMaterial
        ref={mat}
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
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

/** viewBlend above which the glass is hidden (camera inside the globe). */
const GLASS_HIDE_INSIDE = 0.97;
