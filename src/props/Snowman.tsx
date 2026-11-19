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
import { sound } from '@/src/audio/sound';
import { PRANK } from '@/src/game/constants';

// Parts of snowman.glb (Tripo node names).
const HEAD_PARTS = ['tripo_part_1', 'tripo_part_2', 'tripo_part_4']; // head, hat, eye
const NOSE_PART = 'tripo_part_6'; // carrot
const BODY_PART = 'tripo_part_0';
/** How far the snow parts' normals are bent toward a round ball (0 = scan, 1 = smooth ball). */
const ROUNDING = 0.75;
/** Parts that are snow (body, head); the rest are hat, coal, carrot and twigs. */
const SNOW_PARTS = [BODY_PART, 'tripo_part_1'];
/** Albedo of the snow domes that seal the cut (close to the scan's average snow). */
const SNOW_DOME = '#d9dee8';
/** Colour of the inside of the cut snow (output colour, after lighting). */
const SNOW_CAP = '#8e97a8';

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
      // The body and head scan carry baked light and crinkles in their colour map: that is the
      // tin-foil look. On those parts keep only the dark bits (coal buttons, mouth) from the map
      // and paint everything else an even packed-snow white; the light does the shading.
      const snowPart = SNOW_PARTS.includes(o.name);
      m.metalness = 0;
      m.metalnessMap = null;
      m.roughnessMap = null;
      m.roughness = 0.95;
      m.normalScale.set(0.45, 0.45);
      if (snowPart) {
        m.normalMap = null;
        // Snow in shade goes cool blue, not the lamps' tan: a faint cool fill, like the floor snow.
        m.emissive.set('#7d8db0');
        m.emissiveIntensity = 0.16;
        roundNormals((o as THREE.Mesh).geometry);
      }
      m.envMapIntensity = 0.3;
      // The scan's parts are open shells (cut where the head sat on the body), so when the head
      // flies off you would see inside them. Draw the inside faces as flat packed snow: from any
      // angle the hole then reads as a solid cut surface, not a hollow.
      m.side = THREE.DoubleSide;
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uCap = { value: new THREE.Color(SNOW_CAP) };
        shader.uniforms.uSnow = { value: new THREE.Color(SNOW_DOME) };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uCap;\nuniform vec3 uSnow;')
          .replace(
            '#include <map_fragment>',
            snowPart
              ? `#include <map_fragment>
              float snowLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
              vec3 packed = uSnow * (0.92 + 0.08 * smoothstep(0.05, 0.6, snowLum));
              diffuseColor.rgb = mix(diffuseColor.rgb, packed, smoothstep(0.008, 0.03, snowLum));`
              : '#include <map_fragment>',
          )
          .replace('#include <dithering_fragment>', 'if (!gl_FrontFacing) gl_FragColor.rgb = uCap;\n#include <dithering_fragment>');
      };
      m.customProgramCacheKey = () => (snowPart ? 'snowman-snow' : 'snowman-cap');
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
    // Seal the cut where the head sat: a low snow dome over the body's top rim, and one under
    // the head (it rides along with the head pivot).
    const bodyMesh = model.getObjectByName(BODY_PART) as THREE.Mesh | undefined;
    const headMesh = model.getObjectByName(HEAD_PARTS[0]) as THREE.Mesh | undefined;
    if (bodyMesh?.isMesh) {
      const rim = openRim(model, bodyMesh, (y, c) => y > c);
      if (rim) model.add(snowCap(rim, 1, bodyMesh.material as THREE.MeshStandardMaterial));
    }
    if (headMesh?.isMesh) {
      const rim = openRim(model, headMesh, (y, c) => y < c);
      if (rim) {
        const cap = snowCap(rim, -1, headMesh.material as THREE.MeshStandardMaterial);
        head.attach(cap);
      }
    }
    const built: Rig = { head, nose, headRadius };
    model.userData.rig = built;
    return built;
  }, [model]);

  const sim = useRef<null | { head: Body; nose: Body }>(null);

  const hovered = useRef(false);
  const handlers = usePrankTarget(
    () => {
      if (sim.current) return;
      const side = Math.random() < 0.5 ? -1 : 1;
      sim.current = {
        head: { p: rig.head.position.clone(), v: new THREE.Vector3(0.9 * side, 0.6, 0.5), spin: new THREE.Vector3(3, 0, -8 * side), radius: rig.headRadius * 0.8 },
        nose: { p: rig.nose.position.clone(), v: new THREE.Vector3(-0.5 * side, 1.4, 1.1), spin: new THREE.Vector3(14, 4, 0), radius: 0.03 },
      };
      useApp.getState().completePrank('snowman');
      model.rotation.set(0, 0, 0);
    },
    true,
    (on) => {
      hovered.current = on;
      if (on && !sim.current) sound.giggle();
    },
  );
  const wobble = useRef(0);

  useFrame(({ clock }, rawDt) => {
    const s = sim.current;
    const dt = Math.min(rawDt, 1 / 30);
    if (!s) {
      // Waiting to be knocked over: it fidgets now and then, and squirms and giggles under the
      // cursor, so it reads as something alive you can mess with.
      const t = clock.elapsedTime;
      const f = t % PRANK.snowmanFidgetSec;
      const fidget = f < 0.6 ? Math.sin(f * 26) * 0.07 * (1 - f / 0.6) : 0;
      const want = hovered.current ? 1 : 0;
      wobble.current += (want - wobble.current) * Math.min(1, dt * 10);
      const squirm = Math.sin(t * 17) * 0.06 * wobble.current;
      model.rotation.z = fidget + squirm;
      model.rotation.x = Math.sin(t * 11) * 0.025 * wobble.current;
      rig.head.rotation.z = Math.sin(t * 21) * 0.18 * wobble.current + fidget * 1.5;
      rig.head.rotation.y = Math.sin(t * 9) * 0.25 * wobble.current;
      return;
    }
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

interface Rim {
  center: THREE.Vector3;
  radius: number;
}

/**
 * The open rim of a scanned part, in model space: the boundary edges (used by one triangle only)
 * on the chosen side of the part's centre. Returns its centre and mean radius, or null.
 */
function openRim(model: THREE.Object3D, mesh: THREE.Mesh, side: (y: number, centerY: number) => boolean): Rim | null {
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  const index = geo.getIndex();
  const toModel = model.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  // Weld by position: the scan splits vertices along UV seams.
  const ids = new Map<string, number>();
  const canon: number[] = [];
  const v = new THREE.Vector3();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    let id = ids.get(k);
    if (id === undefined) {
      id = ids.size;
      ids.set(k, id);
      points.push(v.clone().applyMatrix4(toModel));
    }
    canon[i] = id;
  }
  const count = index ? index.count : pos.count;
  const edges = new Map<string, number>();
  for (let t = 0; t < count; t += 3) {
    for (let j = 0; j < 3; j++) {
      const a = canon[index ? index.getX(t + j) : t + j];
      const b = canon[index ? index.getX(t + ((j + 1) % 3)) : t + ((j + 1) % 3)];
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  const box = new THREE.Box3().setFromPoints(points);
  const centerY = (box.min.y + box.max.y) / 2;
  const rimIds = new Set<number>();
  for (const [k, n] of edges) {
    if (n !== 1) continue;
    for (const id of k.split('_').map(Number)) if (side(points[id].y, centerY)) rimIds.add(id);
  }
  if (rimIds.size < 8) return null;
  const center = new THREE.Vector3();
  for (const id of rimIds) center.add(points[id]);
  center.divideScalar(rimIds.size);
  let radius = 0;
  for (const id of rimIds) radius += Math.hypot(points[id].x - center.x, points[id].z - center.z);
  radius /= rimIds.size;
  return { center, radius };
}

/** A low dome of snow over a rim, bulging up (dir 1) or down (dir -1), in the part's own material. */
function snowCap(rim: Rim, dir: 1 | -1, source: THREE.MeshStandardMaterial) {
  // Plain matte snow: the scan's texture atlas would wrap onto the dome as dark swirls.
  const material = new THREE.MeshStandardMaterial({ color: SNOW_DOME, roughness: 0.95, metalness: 0, envMapIntensity: source.envMapIntensity });
  const geo = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(geo, material);
  // Slightly wider than the rim so it tucks under the edge; sunk a little so it reads as packed.
  const r = rim.radius * 1.06;
  cap.scale.set(r, r * 0.32, r);
  if (dir < 0) cap.rotation.x = Math.PI; // flip by rotating: a negative scale would turn it inside out
  cap.position.copy(rim.center).add(new THREE.Vector3(0, -0.02 * r * dir, 0));
  cap.castShadow = true;
  cap.receiveShadow = true;
  return cap;
}

/**
 * Shade a lumpy scanned snowball as a round one: bend every vertex normal most of the way toward
 * the direction out from the part's centre. The outline keeps its lumps; the light stops catching
 * every crease. Runs once per geometry (it is shared with the cached glTF).
 */
function roundNormals(geo: THREE.BufferGeometry) {
  if (geo.userData.roundNormals) return;
  geo.userData.roundNormals = true;
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  if (!nrm) return;
  geo.computeBoundingBox();
  const center = geo.boundingBox!.getCenter(new THREE.Vector3());
  const size = geo.boundingBox!.getSize(new THREE.Vector3());
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const out = new THREE.Vector3();
  const normals = new Float32Array(nrm.count * 3);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(center).divide(size);
    out.copy(p).normalize();
    n.fromBufferAttribute(nrm, i).normalize();
    n.lerp(out, ROUNDING).normalize();
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;
  }
  // Replace the (possibly quantized) attribute with a plain float one.
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}
