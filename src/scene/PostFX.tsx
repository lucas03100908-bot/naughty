'use client';
import { Bloom, EffectComposer, N8AO, Noise, Vignette } from '@react-three/postprocessing';
import { LOOK } from '@/src/game/constants';
import { BlendFunction } from 'postprocessing';

/** Ambient occlusion, bloom for the windows and lamps, film grain, vignette. */
export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={LOOK.aoRadius} intensity={LOOK.aoIntensity} distanceFalloff={0.5} quality="medium" />
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.85} radius={0.7} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.18} />
      <Vignette offset={0.25} darkness={0.85} />
    </EffectComposer>
  );
}
