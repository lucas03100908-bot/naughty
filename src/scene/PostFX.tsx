'use client';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

/** Bloom for the windows and lamps, film grain, vignette. Depth of field is left for M4. */
export function PostFX() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.6} luminanceSmoothing={0.25} intensity={0.85} radius={0.7} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.18} />
      <Vignette offset={0.25} darkness={0.85} />
    </EffectComposer>
  );
}
