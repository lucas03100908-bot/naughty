'use client';
import { Suspense } from 'react';
import { GLOBE } from '@/src/game/constants';
import { Base } from './Base';
import { Glass } from './Glass';
import { Snow } from './Snow';
import { Village } from './Village';

/** The one object: base, village, snow, glass. Globe-local units, scaled into the world. */
export function SnowGlobe() {
  return (
    <group position={GLOBE.position} scale={GLOBE.scale}>
      <Base />
      <Suspense fallback={null}>
        <group position-y={GLOBE.floorY}>
          <Village />
        </group>
      </Suspense>
      {/* Warm spill from the shop windows. */}
      <pointLight position={[0, GLOBE.floorY + 0.12, 0.02]} color="#ffae5e" intensity={0.02} distance={0.7} decay={2} />
      <Snow />
      <Glass />
    </group>
  );
}
