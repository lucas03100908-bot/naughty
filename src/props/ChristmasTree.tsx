'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PRANK, VIEW } from '@/src/game/constants';
import { useApp, live } from '@/src/game/store';
import { groundLift } from '@/src/scene/groundSample';
import { FOOTPRINT, type Placement } from '@/src/scene/layout';
import { starHaloSprite } from '@/src/scene/proceduralTextures';
import { MODEL_URLS, useProp } from './useProp';
import { usePrankTarget } from './usePrankCursor';
import { sound } from '@/src/audio/sound';

/** Glow of the ornaments and lights (emissive maps from the asset pipeline). */
const LIGHTS_ON = 1.6;
/** The star on top of christmas_tree.glb (Tripo node name). */
const STAR_PART = 'tripo_part_11';

interface StarRig {
  /** Pivot at the star's centre, sibling of the tree model (so only the star is clickable). */
  pivot: THREE.Group;
  /** Rest position of the pivot, model units. */
  rest: THREE.Vector3;
  radius: number;
  materials: THREE.MeshStandardMaterial[];
  halo: THREE.Sprite;
  light: THREE.PointLight;
}

/**
 * The village tree (christmas_tree.glb). Its lights are the emissive glow of every part.
 * Prank (별에 눈덩이 던지기): click the star on top; a snowball arcs from the viewer, knocks the star
 * off, it tumbles into the snow and the tree goes dark.
 */
export function ChristmasTree({ at }: { at: Placement }) {
  const tree = useProp(MODEL_URLS.christmasTree, LIGHTS_ON, false);
  const camera = useThree((s) => s.camera);
  const holder = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const ball = useRef<THREE.Mesh>(null);
  const on = useRef(true);
  const throwState = useRef<null | { from: THREE.Vector3; to: THREE.Vector3; startAt: number }>(null);
  const fall = useRef<null | { v: THREE.Vector3; spin: THREE.Vector3 }>(null);

  // Lift the star out of the model into its own pivot (built once per clone: React may run
  // this memo twice in development).
  const star = useMemo<StarRig | null>(() => {
    if (tree.userData.starRig) return tree.userData.starRig as StarRig;
    tree.updateMatrixWorld(true);
    const node = tree.getObjectByName(STAR_PART);
    if (!node) return null;
    const box = new THREE.Box3().setFromObject(node);
    const center = box.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    // Bigger than the model's star, and lifted by the growth so it still sits on the treetop.
    const radius0 = box.getSize(new THREE.Vector3()).y / 2;
    center.y += radius0 * (PRANK.starScale - 1) * 0.8;
    pivot.position.copy(center);
    pivot.updateMatrixWorld(true);
    const m = node.matrixWorld.clone().premultiply(pivot.matrixWorld.clone().invert());
    node.removeFromParent();
    m.decompose(node.position, node.quaternion, node.scale);
    pivot.add(node);
    pivot.scale.setScalar(PRANK.starScale);
    // A generous invisible hit target so the small star is easy to click.
    const hit = new THREE.Mesh(new THREE.SphereGeometry(box.getSize(new THREE.Vector3()).length() * 0.9, 12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    pivot.add(hit);
    const materials: THREE.MeshStandardMaterial[] = [];
    node.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat) {
        mat.color.set('#ffd77a');
        mat.emissive.set('#ffcc66');
        mat.toneMapped = false; // stays bright gold instead of being tone-mapped toward white-grey
        materials.push(mat);
      }
    });
    // A soft halo with rays that always faces the viewer, and a little light on the treetop.
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: starHaloSprite(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }),
    );
    halo.scale.setScalar(radius0 * PRANK.starHaloSize);
    halo.renderOrder = 4;
    halo.raycast = () => {}; // clicks go to the hit sphere
    pivot.add(halo);
    const light = new THREE.PointLight('#ffc870', PRANK.starLight, 0.12, 2);
    pivot.add(light);
    const rig: StarRig = { pivot, rest: center.clone(), radius: radius0 * PRANK.starScale, materials, halo, light };
    tree.userData.starRig = rig;
    return rig;
  }, [tree]);

  const treeMaterials = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = [];
    tree.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m) list.push(m);
    });
    return list;
  }, [tree]);

  const hovered = useRef(false);
  const handlers = usePrankTarget(
    () => {
      if (!on.current || throwState.current || !holder.current || !star) return;
      // Throw from just below the viewer's eye toward the star (both in the tree's local space).
      const from = holder.current.worldToLocal(camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.01, 0)));
      const to = holder.current.worldToLocal(star.pivot.getWorldPosition(new THREE.Vector3()));
      throwState.current = { from, to, startAt: performance.now() };
      sound.prankStart('tree');
    },
    true,
    (h) => {
      hovered.current = h;
      if (h && on.current) sound.twinkle();
    },
  );
  const swell = useRef(0);

  useFrame(({ clock }, rawDt) => {
    if (light.current) light.current.visible = live.viewBlend > VIEW.nearDetailFrom;
    const dt = Math.min(rawDt, 1 / 30);
    const twinkle = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 3.1);
    const k = on.current ? twinkle * live.villageLight : 0;
    for (const m of treeMaterials) m.emissiveIntensity = LIGHTS_ON * k;
    if (light.current) light.current.intensity = 0.008 * k;
    // The star pulses while it is up there, so it reads as something to hit.
    if (star) {
      // Under the cursor the star swells, beats faster and spins a little.
      swell.current += ((hovered.current && on.current ? 1 : 0) - swell.current) * Math.min(1, dt * 8);
      const beat = 0.5 + 0.5 * Math.sin(clock.elapsedTime * (3.5 + 4 * swell.current));
      if (on.current && !fall.current) {
        star.pivot.scale.setScalar(PRANK.starScale * (1 + 0.18 * swell.current));
        star.pivot.rotation.y += dt * 2.5 * swell.current;
      }
      const pulse = on.current ? PRANK.starGlow * (0.65 + 0.35 * beat) * live.villageLight : 0;
      for (const m of star.materials) m.emissiveIntensity = pulse;
      // Halo breathes with the pulse and turns slowly; once the star is hit it fades out.
      const haloMat = star.halo.material;
      const target = on.current ? (0.6 + 0.4 * beat) * (1 + 0.4 * swell.current) * live.villageLight : 0;
      haloMat.opacity += (target - haloMat.opacity) * Math.min(1, dt * (on.current ? 6 : 3));
      haloMat.rotation = clock.elapsedTime * 0.25;
      star.halo.visible = haloMat.opacity > 0.01;
      star.light.intensity = on.current ? PRANK.starLight * (0.7 + 0.3 * beat) * live.villageLight : 0;
    }

    // Snowball flight: straight line plus an arc, then the hit.
    const th = throwState.current;
    if (th && ball.current) {
      // Real time, not frame time: the hit lands on schedule even on a slow laptop.
      const t = Math.min(1, (performance.now() - th.startAt) / (PRANK.snowballSec * 1000));
      const p = new THREE.Vector3().lerpVectors(th.from, th.to, t);
      p.y += Math.sin(t * Math.PI) * th.from.distanceTo(th.to) * 0.18;
      ball.current.position.copy(p);
      ball.current.visible = t < 1;
      if (t >= 1) {
        throwState.current = null;
        on.current = false;
        fall.current = { v: new THREE.Vector3(0.6, 0.8, 1.2), spin: new THREE.Vector3(6, 2, -9) };
        useApp.getState().completePrank('tree');
      }
    }

    // The star tumbles off and lands in the snow (model units, ≈1 tall).
    const f = fall.current;
    if (f && star) {
      const piv = star.pivot;
      f.v.y += -9 * dt;
      piv.position.addScaledVector(f.v, dt);
      piv.rotation.x += f.spin.x * dt;
      piv.rotation.y += f.spin.y * dt;
      piv.rotation.z += f.spin.z * dt;
      if (piv.position.y <= star.radius) {
        piv.position.y = star.radius;
        f.v.y = Math.abs(f.v.y) > 0.5 ? -f.v.y * 0.3 : 0;
        const damp = 1 - 3 * dt;
        f.v.x *= damp;
        f.v.z *= damp;
        f.spin.multiplyScalar(damp);
      }
    }
  });

  const h = 0.98 * at.scale;
  return (
    <group
      ref={holder}
      position={[at.position[0], at.position[1] + groundLift(at.position[0], at.position[2], FOOTPRINT.christmasTree * at.scale), at.position[2]]}
      rotation-y={at.rotationY}
    >
      <group scale={at.scale}>
        <primitive object={tree} />
        {star && <primitive object={star.pivot} {...handlers} />}
      </group>
      <pointLight ref={light} position={[0, h * 0.45, 0.03]} color="#ffc480" intensity={0.008} distance={0.25} decay={2} />
      <mesh ref={ball} visible={false}>
        <sphereGeometry args={[0.009, 16, 12]} />
        <meshStandardMaterial color="#f6f8fc" roughness={0.9} />
      </mesh>
    </group>
  );
}
