'use client';
import { LIGHTS } from '@/src/game/constants';
import { MODEL_URLS, useProp } from './useProp';

type Vec3 = [number, number, number];

/**
 * Street lamp prop. Owns its glow (emissive) and its point light so M2's "가로등 끄기" can
 * switch both from one place.
 */
export function StreetLamp({ position, rotationY = 0, scale = 0.15 }: { position: Vec3; rotationY?: number; scale?: number }) {
  const object = useProp(MODEL_URLS.lamp, LIGHTS.lampEmissive);
  return (
    <group position={position} rotation-y={rotationY}>
      <primitive object={object} scale={scale} />
      <pointLight position={[0, scale * 0.85, 0]} color="#ffb867" intensity={LIGHTS.lampPointIntensity} distance={0.35} decay={2} />
    </group>
  );
}
