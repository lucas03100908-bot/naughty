'use client';
 
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { live } from '@/src/game/store';
import { cullFromTransmission } from '../transmissionCull';
import { ChairLift } from './ChairLift';
import { Mist } from './Mist';
import { Scenery } from './Scenery';
import { Skiers } from './Skiers';
import { Snowfall } from './Snowfall';
import { Train } from './Train';

/**
 * The world the globe stands in: a miniature ski resort in the snow, at night. A toy train
 * circles the base through two hills, chairs ride up the right-hand mountain, skiers carve down
 * the slopes. Only seen from outside: once the camera is in the village it is not drawn (or
 * animated) at all.
 */
export function Diorama() {
  const group = useRef<THREE.Group>(null);
  const frames = useRef(0);
  useFrame(() => {
    if (!group.current) return;
    group.current.visible = live.viewBlend < 0.9;
    // Models stream in; pick up new meshes now and then.
    if (frames.current++ % 60 === 0) cullFromTransmission(group.current);
  });
  return (
    <group ref={group}>
      <Scenery />
      <Train />
      <ChairLift />
      <Skiers />
      <Snowfall />
      <Mist />
    </group>
  );
}
