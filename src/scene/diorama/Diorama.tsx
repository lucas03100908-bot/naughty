'use client';
 
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { live } from '@/src/game/store';
import { ChairLift } from './ChairLift';
import { Scenery } from './Scenery';
import { Skiers } from './Skiers';
import { Train } from './Train';

/**
 * The world the globe stands in: a miniature ski resort piped out of snow, at night. A toy train
 * circles the base through two hills, chairs ride up the right-hand mountain, skiers carve down
 * the slopes. Only seen from outside: once the camera is in the village it is not drawn (or
 * animated) at all.
 */
export function Diorama() {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = live.viewBlend < 0.9;
  });
  return (
    <group ref={group}>
      <Scenery />
      <Train />
      <ChairLift />
      <Skiers />
    </group>
  );
}
