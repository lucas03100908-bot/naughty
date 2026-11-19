'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { useFrame } from '@react-three/fiber';
import { Bloom, BrightnessContrast, ChromaticAberration, EffectComposer, HueSaturation, N8AO, Noise, TiltShift2, Vignette } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LOOK } from '@/src/game/constants';
import { live } from '@/src/game/store';
import { BlendFunction } from 'postprocessing';
import { CinemaGradeEffect } from './CinemaGrade';

type Tilt = { blur: number };
type Grade = { saturation: number; contrast: number };

/**
 * Ambient occlusion, bloom for the windows and lamps, tilt-shift from outside (two passes, across
 * and down, so the blur is round), film grain, vignette.
 */
export function PostFX() {
  const across = useRef<Tilt>(null);
  const down = useRef<Tilt>(null);
  const hue = useRef<Grade>(null);
  const contrast = useRef<Grade>(null);
  const grade = useMemo(() => new CinemaGradeEffect(), []);
  const lens = useMemo(() => new THREE.Vector2(LOOK.lensFringe, LOOK.lensFringe * 0.6), []);
  useFrame(() => {
    // Fade the miniature look (blur, punchy colour) out as the camera goes into the globe.
    const outside = 1 - THREE.MathUtils.smoothstep(live.viewBlend, 0.05, 0.6);
    const blur = LOOK.tiltBlur * outside;
    if (across.current) across.current.blur = blur;
    if (down.current) down.current.blur = blur;
    if (hue.current) hue.current.saturation = LOOK.miniSaturation * outside;
    if (contrast.current) contrast.current.contrast = LOOK.miniContrast * outside;
    // The film grade holds inside too, softer (the street has its own night colour).
    grade.strength = LOOK.gradeStrength * (0.55 + 0.45 * outside);
  });
  const band = { start: [0, LOOK.tiltFocusY] as [number, number], end: [1, LOOK.tiltFocusY] as [number, number], taper: LOOK.tiltTaper, samples: 8 };
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={LOOK.aoRadius} intensity={LOOK.aoIntensity} distanceFalloff={0.5} quality="medium" />
      <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.25} intensity={1.0} radius={0.75} />
      <TiltShift2 ref={across as never} {...band} blur={LOOK.tiltBlur} direction={[1, 0]} />
      <TiltShift2 ref={down as never} {...band} blur={LOOK.tiltBlur} direction={[0, 1]} />
      {/* Photos of models read saturated and contrasty: paint and plastic under a close lamp. */}
      <HueSaturation ref={hue as never} saturation={LOOK.miniSaturation} />
      <BrightnessContrast ref={contrast as never} contrast={LOOK.miniContrast} />
      <primitive object={grade} />
      {/* A lens's colour fringe, only toward the corners. */}
      <ChromaticAberration offset={lens} radialModulation modulationOffset={0.45} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.2} />
      <Vignette offset={0.22} darkness={0.95} />
    </EffectComposer>
  );
}
