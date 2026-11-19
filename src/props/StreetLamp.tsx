'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LIGHTS, LOOK, PRANK, VIEW } from '@/src/game/constants';
import { live, useApp } from '@/src/game/store';
import { groundLift } from '@/src/scene/groundSample';
import { FOOTPRINT, LAYOUT } from '@/src/scene/layout';
import { MODEL_URLS, useProp } from './useProp';
import { usePrankTarget } from './usePrankCursor';
import { starHaloSprite } from '@/src/scene/proceduralTextures';
import { sound } from '@/src/audio/sound';

type Vec3 = [number, number, number];

/**
 * street_lamp.glb holds two lamps: a plain one (one lantern) and a busier one (a top lantern plus a
 * side lantern on a bracket). Only the plain one is kept: every fragment nearer the other post's
 * axis than this one's is discarded. Post axes in model units (x, z), measured from the mesh.
 */
const KEEP_POST: [number, number] = [-0.146, 0.087];
const DROP_POST: [number, number] = [0.021, -0.064];

/**
 * Street lamp. Owns its glow (emissive) and point light. With `prank`, clicking it during play
 * makes it flicker and go out, and the lane around it darkens (가로등 끄기).
 */
export function StreetLamp({
  position,
  rotationY = 0,
  scale = 0.15,
  prank = false,
  shadows = false,
}: {
  position: Vec3;
  rotationY?: number;
  scale?: number;
  prank?: boolean;
  /** Cast a shadow from the lamp (off: a point light's shadow is six extra renders of the village a frame, for a barely visible result). */
  shadows?: boolean;
}) {
  const object = useProp(MODEL_URLS.lamp, LIGHTS.lampEmissive, false);
  const light = useRef<THREE.PointLight>(null);
  const state = useRef<{ mode: 'on' | 'flicker' | 'off'; since: number }>({ mode: 'on', since: 0 });
  const materials = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = [];
    object.updateMatrixWorld(true);
    const rootInv = object.matrixWorld.clone().invert();
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const m = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (!m) return;
      list.push(m);
      // Keep only the plain lamp of the pair (see KEEP_POST).
      const toModel = rootInv.clone().multiply(mesh.matrixWorld);
      cutSecondPost(m, toModel);
      // The shadow passes need the same cut, or the missing post still casts a shadow.
      mesh.customDepthMaterial = cutSecondPost(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), toModel);
      mesh.customDistanceMaterial = cutSecondPost(new THREE.MeshDistanceMaterial(), toModel);
    });
    return list;
  }, [object]);
  // The lit glass is baked into the base colour, so "off" also has to darken the albedo.
  const offColor = useMemo(() => new THREE.Color(0.32, 0.32, 0.36), []);
  const onColor = useMemo(() => new THREE.Color(1, 1, 1), []);

  const hovered = useRef(false);
  const handlers = usePrankTarget(
    () => {
      if (state.current.mode !== 'on') return;
      state.current = { mode: 'flicker', since: performance.now() };
      sound.prankStart('lamp');
    },
    prank,
    (on) => {
      hovered.current = on;
      if (on && state.current.mode === 'on') sound.buzz();
    },
  );

  // The prank lamp has to stand out from the others: a halo round its lantern.
  const halo = useMemo(() => {
    if (!prank) return null;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: starHaloSprite(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, color: '#ffc27a' }),
    );
    sprite.raycast = () => {};
    sprite.renderOrder = 4;
    return sprite;
  }, [prank]);
  const boost = useRef(prank ? PRANK.lampBoost : 1);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const s = state.current;
    let k = 1;
    // While it waits, the prank lamp teases: a quick double stutter every few seconds.
    if (prank && s.mode === 'on') {
      const t = clock.elapsedTime % PRANK.lampTeaseSec;
      if ((t > 0.0 && t < 0.06) || (t > 0.14 && t < 0.2)) k = 0.35;
    }
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
    // Brighter than the other lamps, brighter still under the cursor.
    const want = prank && s.mode === 'on' ? PRANK.lampBoost * (hovered.current ? 1.5 : 1) : 1;
    boost.current += (want - boost.current) * Math.min(1, dt * 8);
    if (halo) {
      const pulse = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 3);
      halo.material.opacity = Math.max(0, k) * pulse * (hovered.current ? 1 : 0.7);
      halo.scale.setScalar(scale * PRANK.lampHaloSize * (hovered.current ? 1.25 : 1));
      halo.visible = halo.material.opacity > 0.01;
    }
    for (const m of materials) {
      m.emissiveIntensity = LIGHTS.lampEmissive * k * boost.current;
      m.color.lerpColors(offColor, onColor, Math.max(k, 0));
    }
    if (light.current) {
      light.current.intensity = LIGHTS.lampPointIntensity * (scale / LAYOUT.lampLeft.scale) * k * boost.current;
      light.current.visible = live.viewBlend > VIEW.nearDetailFrom;
    }
  });

  // Stand on the street, not in it.
  const lift = groundLift(position[0], position[2], FOOTPRINT.lamp * scale) + LAYOUT.lampRaise;
  return (
    <group position={[position[0], position[1] + lift, position[2]]} rotation-y={rotationY} {...handlers}>
      {/* Re-centre on the kept post so the lamp stands where it is placed. */}
      <primitive object={object} scale={scale} position={[-KEEP_POST[0] * scale, 0, -KEEP_POST[1] * scale]} />
      {halo && <primitive object={halo} position={[0, scale * 0.85, 0]} />}
      <pointLight
        ref={light}
        position={[0, scale * 0.85, 0]}
        color="#ffb867"
        intensity={LIGHTS.lampPointIntensity}
        distance={0.35 * (scale / LAYOUT.lampLeft.scale)}
        decay={2}
        castShadow={shadows}
        shadow-mapSize={[LOOK.lampShadowMapSize, LOOK.lampShadowMapSize]}
        shadow-bias={-0.002}
        shadow-camera-near={0.005}
        shadow-camera-far={0.4}
      />
    </group>
  );
}

const vec2 = ([x, z]: [number, number]) => `vec2(${x.toFixed(3)}, ${z.toFixed(3)})`;

/** Discard every fragment nearer DROP_POST than KEEP_POST, in the lamp model's own space. */
function cutSecondPost<M extends THREE.Material>(m: M, toModel: THREE.Matrix4): M {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uToModel = { value: toModel };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uToModel;\nvarying vec2 vModelXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvModelXZ = (uToModel * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vModelXZ;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (distance(vModelXZ, ${vec2(KEEP_POST)}) > distance(vModelXZ, ${vec2(DROP_POST)})) discard;`);
  };
  m.customProgramCacheKey = () => `lamp-single-post-${m.type}`;
  m.needsUpdate = true;
  return m;
}
