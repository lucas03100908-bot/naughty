'use client';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { GLOBE, VIEW } from '@/src/game/constants';
import { live } from '@/src/game/store';
import { applyVillageLight } from './villageLights';
import { NEAR_LIGHT } from './warmup';

/** Applies live.villageLight to the registered glows and the warm spill light inside the globe. */
export function VillageLightDriver() {
  const spill = useRef<THREE.PointLight>(null);
  useFrame(() => {
    applyVillageLight(live.villageLight);
    if (spill.current) {
      spill.current.intensity = 0.02 * live.villageLight;
      spill.current.visible = live.viewBlend > VIEW.nearDetailFrom;
    }
  });
  // Warm spill from the shop windows.
  return <pointLight ref={spill} userData={NEAR_LIGHT} position={[0, GLOBE.floorY + 0.12, 0.02]} color="#ffae5e" intensity={0.02} distance={0.7} decay={2} />;
}
