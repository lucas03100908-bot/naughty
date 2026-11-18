'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SNOW, STORM, VIEW } from '@/src/game/constants';
import { live } from '@/src/game/store';
import { flakeSprite } from './proceduralTextures';
import { createSnowSim } from './snowSim';

/** Snow = falling flakes (Points) + a floor heightfield. The simulation lives in snowSim.ts. */
export function Snow() {
  const sim = useMemo(() => createSnowSim(), []);
  const sprite = useMemo(() => flakeSprite(), []);
  const lastShakeSeen = useRef(0);
  const flakeMat = useRef<THREE.PointsMaterial>(null);

  // Dev only: inspect the heightfield from the console (window.__snow.inspect()).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as unknown as { __snow: typeof sim }).__snow = sim;
  }, [sim]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const now = performance.now();
    if (live.lastShakeAt !== lastShakeSeen.current) {
      lastShakeSeen.current = live.lastShakeAt;
      sim.shake(now);
    }
    sim.step(dt, now, state.clock.elapsedTime, live.flow, live.storm * STORM.maxStir);
    // Flakes are drawn at a fixed world size; inside the village they would be snowballs.
    if (flakeMat.current) flakeMat.current.size = SNOW.flakeSize * THREE.MathUtils.lerp(1, VIEW.insideFlakeScale, live.viewBlend);
  });

  return (
    <group>
      <mesh geometry={sim.fieldGeometry} renderOrder={1} receiveShadow>
        <meshStandardMaterial vertexColors transparent roughness={0.95} color="#cdd6e4" emissive="#6d7c96" emissiveIntensity={0.06} />
      </mesh>
      <points geometry={sim.flakeGeometry} frustumCulled={false} renderOrder={3}>
        <pointsMaterial
          ref={flakeMat}
          map={sprite}
          size={SNOW.flakeSize}
          sizeAttenuation
          transparent
          depthWrite={false}
          color="#ffffff"
          opacity={0.85}
        />
      </points>
    </group>
  );
}
