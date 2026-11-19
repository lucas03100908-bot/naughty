'use client';
 
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DIORAMA } from '@/src/game/constants';
import { DIO, useBaked, useModel } from './props';
import { groundHeight } from './terrain';

/** Bottom and top station on the right-hand mountain. */
const BOTTOM = new THREE.Vector2(0.64, -1.0);
const TOP = new THREE.Vector2(0.86, -1.62);
const TOWERS = [0, 0.34, 0.67, 1];
const TOWER_H = 0.075;
/** The up and down cables, either side of the towers. */
const SPREAD = 0.022;
const SAG = 0.01;
/** A cabin from the grip on the cable down to its floor. */
const CABIN_H = 0.036;

/** Tower tops along the line, bottom to top. */
function towerTops() {
  return TOWERS.map((f) => {
    const x = BOTTOM.x + (TOP.x - BOTTOM.x) * f;
    const z = BOTTOM.y + (TOP.y - BOTTOM.y) * f;
    return new THREE.Vector3(x, groundHeight(x, z) + TOWER_H, z);
  });
}

/** Point on one cable at fraction f (0 bottom .. 1 top), sagging between towers. */
function cablePoint(tops: THREE.Vector3[], side: number, f: number, out: THREE.Vector3) {
  const seg = Math.min(TOWERS.length - 2, Math.max(0, TOWERS.findIndex((t, i) => f >= t && f <= TOWERS[i + 1])));
  const f0 = TOWERS[seg];
  const f1 = TOWERS[seg + 1];
  const k = (f - f0) / (f1 - f0);
  out.lerpVectors(tops[seg], tops[seg + 1], k);
  out.y -= SAG * 4 * k * (1 - k);
  const dir = new THREE.Vector2(TOP.x - BOTTOM.x, TOP.y - BOTTOM.y).normalize();
  out.x += -dir.y * side * SPREAD;
  out.z += dir.x * side * SPREAD;
  return out;
}

/** A lift tower model, its sheaves at the cable height. */
function Tower({ top, yaw }: { top: THREE.Vector3; yaw: number }) {
  const object = useModel(DIO.liftTower, TOWER_H + 0.008);
  return <primitive object={object} position={[top.x, top.y - TOWER_H, top.z]} rotation-y={yaw} />;
}

/** A gondola lift: cabins ride up one cable and down the other, swinging a little. */
export function ChairLift() {
  const tops = useMemo(() => towerTops(), []);
  const cabins = useRef<THREE.InstancedMesh>(null);
  const s = useRef(0);
  const gondola = useBaked(DIO.gondola);

  const cable = useMemo(() => {
    const cables: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 60; i++) pts.push(cablePoint(tops, side, i / 60, new THREE.Vector3()));
      cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0009, 4));
    }
    return mergeGeometries(cables)!;
  }, [tops]);

  const tmp = useMemo(
    () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), m: new THREE.Matrix4(), hang: new THREE.Matrix4().makeTranslation(0, -CABIN_H, 0), size: new THREE.Matrix4().makeScale(CABIN_H, CABIN_H, CABIN_H) }),
    [],
  );
  const yaw = Math.atan2(TOP.x - BOTTOM.x, TOP.y - BOTTOM.y);

  useFrame((state, rawDt) => {
    const mesh = cabins.current;
    if (!mesh) return;
    s.current = (s.current + DIORAMA.liftSpeed * Math.min(rawDt, 0.1)) % 1;
    const t = state.clock.elapsedTime;
    const { p, q, e, m, hang, size } = tmp;
    for (let i = 0; i < DIORAMA.liftChairs; i++) {
      const u = (s.current + i / DIORAMA.liftChairs) % 1;
      // First half up the right-hand cable, second half down the left.
      const up = u < 0.5;
      const f = up ? u * 2 : 2 - u * 2;
      cablePoint(tops, up ? 1 : -1, f, p);
      // Hung from the grip on the cable, swinging about it.
      q.setFromEuler(e.set(Math.sin(t * 1.7 + i) * 0.06, yaw + (up ? 0 : Math.PI), 0));
      m.makeRotationFromQuaternion(q).setPosition(p).multiply(hang).multiply(size);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={cable}>
        <meshStandardMaterial color="#2b2b30" roughness={0.6} />
      </mesh>
      {tops.map((top, i) => (
        <Tower key={i} top={top} yaw={yaw} />
      ))}
      <instancedMesh ref={cabins} args={[gondola.geometry, gondola.material, DIORAMA.liftChairs]} frustumCulled={false} />
    </>
  );
}
