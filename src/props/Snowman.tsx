'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useApp } from '@/src/game/store';
import { groundLift } from '@/src/scene/groundSample';
import { FOOTPRINT, type Placement } from '@/src/scene/layout';
import { MODEL_URLS, useProp } from './useProp';
import { usePrankTarget } from './usePrankCursor';

// Parts of snowman.glb (Tripo node names).
const HEAD_PARTS = ['tripo_part_1', 'tripo_part_2', 'tripo_part_4']; // head, hat, eye
const NOSE_PART = 'tripo_part_6'; // carrot

interface Rig {
  head: THREE.Group;
  nose: THREE.Group;
  headRadius: number;
}

interface Body {
  p: THREE.Vector3;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  radius: number;
}

/**
 * Snowman (눈사람 무너뜨리기). On click during play the head (with its hat) rolls off and the
 * carrot nose pops out on its own. Physics runs in the model's own units (≈1 tall).
 */
export function Snowman({ at }: { at: Placement }) {
  const model = useProp(MODEL_URLS.snowman, 0, false);
  // The scan's roughness/metal map and strong normals make the snow read as crumpled foil under
  // the moon: make it matte, packed snow.
  useMemo(() => {
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m) return;
      m.metalness = 0;
      m.metalnessMap = null;
      m.roughnessMap = null;
      m.roughness = 0.95;
      m.normalScale.set(0.45, 0.45);
      m.envMapIntensity = 0.3;
      m.needsUpdate = true;
    });
  }, [model]);

  // Regroup the head parts under one pivot so they can fly together; the nose gets its own.
  // Built once per model clone: React may run this memo twice (StrictMode), and moving the parts a
  // second time would leave the animation driving an empty group.
  const rig = useMemo(() => {
    if (model.userData.rig) return model.userData.rig as Rig;
    const head = new THREE.Group();
    const nose = new THREE.Group();
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const n of HEAD_PARTS) {
      const o = model.getObjectByName(n);
      if (o) box.expandByObject(o);
    }
    const headCenter = box.isEmpty() ? new THREE.Vector3(0, 0.66, 0) : box.getCenter(new THREE.Vector3());
    head.position.copy(headCenter);
    model.add(head);
    head.updateMatrixWorld(true);
    for (const n of HEAD_PARTS) {
      const o = model.getObjectByName(n);
      if (o) head.attach(o);
    }
    const noseObj = model.getObjectByName(NOSE_PART);
    const noseCenter = noseObj ? new THREE.Box3().setFromObject(noseObj).getCenter(new THREE.Vector3()) : headCenter.clone();
    nose.position.copy(noseCenter);
    model.add(nose);
    nose.updateMatrixWorld(true);
    if (noseObj) nose.attach(noseObj);
    const headRadius = box.isEmpty() ? 0.15 : box.getSize(new THREE.Vector3()).y / 2;
    const built: Rig = { head, nose, headRadius };
    model.userData.rig = built;
    return built;
  }, [model]);

  const sim = useRef<null | { head: Body; nose: Body }>(null);

  const handlers = usePrankTarget(() => {
    if (sim.current) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    sim.current = {
      head: { p: rig.head.position.clone(), v: new THREE.Vector3(0.9 * side, 0.6, 0.5), spin: new THREE.Vector3(3, 0, -8 * side), radius: rig.headRadius * 0.8 },
      nose: { p: rig.nose.position.clone(), v: new THREE.Vector3(-0.5 * side, 1.4, 1.1), spin: new THREE.Vector3(14, 4, 0), radius: 0.03 },
    };
    useApp.getState().completePrank('snowman');
  });

  useFrame((_, rawDt) => {
    const s = sim.current;
    if (!s) return;
    const dt = Math.min(rawDt, 1 / 30);
    for (const [b, obj] of [
      [s.head, rig.head],
      [s.nose, rig.nose],
    ] as const) {
      step(b, dt);
      obj.position.copy(b.p);
      obj.rotation.x += b.spin.x * dt;
      obj.rotation.y += b.spin.y * dt;
      obj.rotation.z += b.spin.z * dt;
    }
  });

  return (
    <group
      position={[at.position[0], at.position[1] + groundLift(at.position[0], at.position[2], FOOTPRINT.snowman * at.scale), at.position[2]]}
      rotation-y={at.rotationY}
      scale={at.scale}
      {...handlers}
    >
      <primitive object={model} />
    </group>
  );
}

/** Ballistic step in model units: falls onto the snow (y = radius), bounces a little, rolls out. */
function step(b: Body, dt: number) {
  b.v.y += -9 * dt;
  b.p.addScaledVector(b.v, dt);
  if (b.p.y <= b.radius) {
    b.p.y = b.radius;
    b.v.y = Math.abs(b.v.y) > 0.4 ? -b.v.y * 0.3 : 0;
    const k = 1 - 2.5 * dt;
    b.v.x *= k;
    b.v.z *= k;
    b.spin.multiplyScalar(k);
  }
}
