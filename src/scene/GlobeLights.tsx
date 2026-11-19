'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOBE, LOOK } from '@/src/game/constants';
import { live, useApp } from '@/src/game/store';

/**
 * Light that lives inside the globe (globe-local, so its shadow frustum hugs the village however
 * the globe sits in the world): a cool moonlight from upper left that casts the shadows, and a
 * night haze that only thickens once the camera is inside (depth like the reference street).
 */
export function GlobeLights() {
  const moon = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const frame = useRef(0);
  const hotUntil = useRef(0);

  // The moon's shadow map is the biggest per-frame cost after the scene itself (every caster
  // drawn again), and almost nothing in the village moves. Redraw it a few times a second, and
  // every frame for a while after a prank, when the snowman falls apart or the star drops.
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    const unsub = useApp.subscribe((s, prev) => {
      if (s.pranks !== prev.pranks || s.phase !== prev.phase) hotUntil.current = performance.now() + LOOK.shadowHotSec * 1000;
    });
    return () => {
      unsub();
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useEffect(() => {
    if (moon.current) moon.current.target = target;
  }, [target]);

  useFrame(() => {
    frame.current++;
    if (performance.now() < hotUntil.current || frame.current % LOOK.shadowEveryFrames === 0) gl.shadowMap.needsUpdate = true;
    // Haze: world-scale fog outside, street-scale fog inside.
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      const b = live.viewBlend;
      fog.near = THREE.MathUtils.lerp(LOOK.fogOutside[0], LOOK.fogInside[0], b);
      fog.far = THREE.MathUtils.lerp(LOOK.fogOutside[1], LOOK.fogInside[1], b);
      fog.color.lerpColors(OUTSIDE_FOG, INSIDE_FOG, b);
    }
  });

  return (
    <>
      <primitive object={target} position={[0, GLOBE.floorY, 0]} />
      <directionalLight
        ref={moon}
        position={[LOOK.moonPosition[0], GLOBE.floorY + LOOK.moonPosition[1], LOOK.moonPosition[2]]}
        intensity={LOOK.moonIntensity}
        color="#c4d2ff"
        castShadow
        shadow-mapSize={[LOOK.shadowMapSize, LOOK.shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.015}
        shadow-camera-left={-0.42}
        shadow-camera-right={0.42}
        shadow-camera-top={0.42}
        shadow-camera-bottom={-0.42}
        shadow-camera-near={0.2}
        shadow-camera-far={2}
        shadow-radius={3}
      />
    </>
  );
}

const OUTSIDE_FOG = new THREE.Color(LOOK.fogColor);
const INSIDE_FOG = new THREE.Color('#0d1424');
