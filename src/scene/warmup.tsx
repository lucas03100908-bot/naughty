'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Pays the cost of the inside view before anyone dives. Going in turns on the lamps' point lights
 * (every lit material's shader is rebuilt for the new light count) and shows the full models for
 * the first time (their textures go up to the GPU). Done on the spot, that is the stutter at the
 * glass. Instead, on request, everything hidden is shown for one compile (no draw, so nothing
 * flashes), every texture is uploaded, and all of it is hidden again. Requested behind the loading
 * screen and whenever a full model arrives (on the intro screen, where a dropped frame is unseen).
 */
let pending = false;

/** userData for the lights that only shine inside (shown by view blend): warmed up both ways. */
export const NEAR_LIGHT = { nearLight: true };

export function requestWarmup() {
  pending = true;
}

const MAPS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap'] as const;

export function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const target = useMemo(() => new THREE.WebGLRenderTarget(1, 1), []);
  useEffect(() => () => target.dispose(), [target]);
  useFrame(() => {
    if (!pending) return;
    pending = false;
    // Every hidden model shown; lights left as they are except the inside ones, compiled once off
    // and once on (shaders are built per light count, so other hidden lights would only make
    // programs nobody uses).
    const hidden: THREE.Object3D[] = [];
    const near: THREE.Light[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight) {
        if (o.userData.nearLight) near.push(o as THREE.Light);
        return;
      }
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const was = near.map((l) => l.visible);
    // The scene is drawn into the post-processing target (linear, no tone mapping), and that is
    // part of every shader's key: compile for a target too, or none of it is reused.
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    for (const on of [false, true]) {
      for (const l of near) l.visible = on;
      gl.compile(scene, camera);
    }
    gl.setRenderTarget(prev);
    near.forEach((l, i) => (l.visible = was[i]));
    scene.traverse((o) => {
      const material = (o as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        const props = m as unknown as Record<string, unknown>;
        for (const k of MAPS) {
          const t = props[k];
          if (t instanceof THREE.Texture) gl.initTexture(t);
        }
      }
    });
    for (const o of hidden) o.visible = false;
  });
  return null;
}

/** Mount next to a model that has just loaded: asks for a warm-up once it is in the scene. */
export function WarmupOnMount({ when = true }: { when?: unknown }) {
  useEffect(() => {
    requestWarmup();
  }, [when]);
  return null;
}
