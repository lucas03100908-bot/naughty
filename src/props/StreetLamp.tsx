'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LIGHTS, LOOK, PRANK } from '@/src/game/constants';
import { live, useApp } from '@/src/game/store';
import { groundLift } from '@/src/scene/groundSample';
import { FOOTPRINT, LAYOUT } from '@/src/scene/layout';
import { MODEL_URLS, useProp } from './useProp';
import { usePrankTarget } from './usePrankCursor';

type Vec3 = [number, number, number];

/**
 * Street lamp. Owns its glow (emissive) and point light. With `prank`, clicking it during play
 * makes it flicker and go out, and the lane around it darkens (가로등 끄기).
 */
export function StreetLamp({ position, rotationY = 0, scale = 0.15, prank = false }: { position: Vec3; rotationY?: number; scale?: number; prank?: boolean }) {
  const object = useProp(MODEL_URLS.lamp, LIGHTS.lampEmissive, false);
  const light = useRef<THREE.PointLight>(null);
  const state = useRef<{ mode: 'on' | 'flicker' | 'off'; since: number }>({ mode: 'on', since: 0 });
  const materials = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = [];
    object.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m) list.push(m);
    });
    return list;
  }, [object]);
  // The lit glass is baked into the base colour, so "off" also has to darken the albedo.
  const offColor = useMemo(() => new THREE.Color(0.32, 0.32, 0.36), []);
  const onColor = useMemo(() => new THREE.Color(1, 1, 1), []);

  const handlers = usePrankTarget(() => {
    if (state.current.mode !== 'on') return;
    state.current = { mode: 'flicker', since: performance.now() };
  }, prank);

  useFrame(() => {
    const s = state.current;
    let k = 1;
    if (s.mode === 'flicker') {
      const t = (performance.now() - s.since) / 1000;
      if (t >= PRANK.lampFlickerSec) {
        state.current = { mode: 'off', since: performance.now() };
        useApp.getState().completePrank('lamp');
        k = 0;
      } else {
        // Irregular stutter that gets weaker toward the end.
        const on = Math.sin(t * 47) + Math.sin(t * 29 + 1.3) > 0.2 - t;
        k = on ? 1 - (t / PRANK.lampFlickerSec) * 0.6 : 0.05;
      }
    } else if (s.mode === 'off') k = 0;
    k *= live.villageLight;
    for (const m of materials) {
      m.emissiveIntensity = LIGHTS.lampEmissive * k;
      m.color.lerpColors(offColor, onColor, Math.max(k, 0));
    }
    if (light.current) light.current.intensity = LIGHTS.lampPointIntensity * k;
  });

  // Stand on the street, not in it.
  const lift = groundLift(position[0], position[2], FOOTPRINT.lamp * scale) + LAYOUT.lampRaise;
  return (
    <group position={[position[0], position[1] + lift, position[2]]} rotation-y={rotationY} {...handlers}>
      <primitive object={object} scale={scale} />
      <pointLight
        ref={light}
        position={[0, scale * 0.85, 0]}
        color="#ffb867"
        intensity={LIGHTS.lampPointIntensity}
        distance={0.35}
        decay={2}
        castShadow
        shadow-mapSize={[LOOK.lampShadowMapSize, LOOK.lampShadowMapSize]}
        shadow-bias={-0.002}
        shadow-camera-near={0.005}
        shadow-camera-far={0.4}
      />
    </group>
  );
}
