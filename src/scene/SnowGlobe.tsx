'use client';
import { Suspense } from 'react';
import { GLOBE } from '@/src/game/constants';
import { useApp } from '@/src/game/store';
import { Pranks } from './Pranks';
import { VillageLightDriver } from './VillageLightDriver';
import { Base } from './Base';
import { Glass } from './Glass';
import { Plaque } from './Plaque';
import { GlobeLights } from './GlobeLights';
import { Ground } from './Ground';
import { InnerSky } from './InnerSky';
import { Snow } from './Snow';
import { Village } from './Village';

/** The one object: base, village, snow, glass. Globe-local units, scaled into the world. */
export function SnowGlobe() {
  // Restarting remounts the props so the snowman, lamp and tree come back untouched.
  const round = useApp((s) => s.round);
  return (
    <group position={GLOBE.position} scale={GLOBE.scale}>
      <Base />
      <Plaque />
      <GlobeLights />
      <Suspense fallback={null}>
        <group name="village-floor" position-y={GLOBE.floorY} key={round}>
          <Ground />
          <Village />
          <Pranks />
        </group>
      </Suspense>
      <VillageLightDriver />
      <Snow />
      <InnerSky />
      <Glass />
    </group>
  );
}
