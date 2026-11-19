'use client';
 
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DIORAMA } from '@/src/game/constants';
import { DIO } from './props';
import { TUNNEL_REACH } from './Scenery';
import { trackPoint } from './terrain';

/** One scale for every car, so the coaches stay in proportion to the locomotive. */
const CAR_SCALE = 0.17;
const GAP = 0.006;
/** Wheels on the rail tops. */
const RIDE = DIORAMA.bedHeight + 0.006;
const PUFFS = 10;
const CARS = [DIO.locomotive, DIO.coachGreen, DIO.coachRed, DIO.coachRed];

/** Clips nothing: every point is far on its positive side. */
const OPEN = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e3);
/** Cars vanish this far inside a portal, behind its dark mouth. */
const MOUTH = 0.006;

/**
 * A car model, scaled, with its length along +x (the way it travels). Its materials are its own,
 * sharing one clipping plane that cuts it off where it goes into a tunnel.
 */
function useCar(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = scene.clone(true);
    clone.scale.setScalar(CAR_SCALE);
    const clip = OPEN.clone();
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      m.envMapIntensity = 0.5;
      if (m.emissiveMap) m.emissiveIntensity = 1.6;
      m.clippingPlanes = [clip];
      mesh.material = m;
    });
    // Precise: the split turned each car's parts, and a loose box of a turned mesh is too long.
    const box = new THREE.Box3().setFromObject(clone, true);
    return { object: clone, clip, length: box.max.x - box.min.x, height: box.max.y - box.min.y };
  }, [scene]);
}

/** An angle folded into (-π, π]. */
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

/** A toy steam train going round the globe's base, through two snow hills. */
export function Train() {
  const c0 = useCar(CARS[0]);
  const c1 = useCar(CARS[1]);
  const c2 = useCar(CARS[2]);
  const c3 = useCar(CARS[3]);
  const cars = useMemo(() => [c0, c1, c2, c3], [c0, c1, c2, c3]);
  const car0 = useRef<THREE.Group>(null);
  const car1 = useRef<THREE.Group>(null);
  const car2 = useRef<THREE.Group>(null);
  const car3 = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.InstancedMesh>(null);
  const angle = useRef(Math.PI * 0.85);
  const puffState = useMemo(() => Array.from({ length: PUFFS }, (_, i) => ({ age: i / PUFFS, x: 0, y: 0, z: 0 })), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  // Each car's angle behind the locomotive: half its own length, a gap, half the next one's.
  const lag = useMemo(() => {
    const out = [0];
    for (let i = 1; i < cars.length; i++) out.push(out[i - 1] + (cars[i - 1].length / 2 + GAP + cars[i].length / 2) / DIORAMA.trackRadius);
    return out;
  }, [cars]);
  // The chimney, in the locomotive's own space: near the front, at the top.
  const chimney = useMemo(() => new THREE.Vector3(cars[0].length * 0.28, cars[0].height, 0), [cars]);
  const smoke = useMemo(() => new THREE.Vector3(), []);
  const portal = useMemo(() => ({ p: new THREE.Vector3(), n: new THREE.Vector3() }), []);

  /**
   * Hide the part of a car that is inside a tunnel: a car is shorter than a tunnel, so it is at
   * most across one portal (one plane, keeping the outside) or wholly inside (hidden).
   */
  const clipAtTunnels = (a: number, car: (typeof cars)[number], g: THREE.Group) => {
    const half = car.length / 2 / DIORAMA.trackRadius;
    const reach = TUNNEL_REACH + MOUTH / DIORAMA.trackRadius;
    car.clip.copy(OPEN);
    g.visible = true;
    for (const t of DIORAMA.tunnels) {
      const d = wrap(a - t);
      if (d + half < -reach || d - half > reach) continue;
      if (d - half > -reach && d + half < reach) {
        g.visible = false;
        return;
      }
      // Across the portal on this side: keep what is beyond it, away from the hill.
      const side = d < 0 ? -1 : 1;
      const at = t + side * reach;
      trackPoint(at, portal.p);
      portal.n.set(-Math.sin(at), 0, Math.cos(at)).multiplyScalar(side);
      car.clip.setFromNormalAndCoplanarPoint(portal.n, portal.p);
      // Clipping planes are in world space; the diorama sits in the tilted table group.
      if (g.parent) car.clip.applyMatrix4(g.parent.matrixWorld);
      return;
    }
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    angle.current += DIORAMA.trainSpeed * dt;
    const a0 = angle.current;
    [car0.current, car1.current, car2.current, car3.current].forEach((g, i) => {
      if (!g) return;
      const a = a0 - lag[i];
      trackPoint(a, p);
      // A little rock on the rails.
      g.position.set(p.x, RIDE + Math.abs(Math.sin(a * 90 + i)) * 0.0006, p.z);
      // +x along the direction of travel (+angle).
      g.rotation.y = -a - Math.PI / 2;
      clipAtTunnels(a, cars[i], g);
    });
    // Steam: puffs leave the chimney, rise, swell and fade.
    const loco = car0.current;
    const mesh = puffs.current;
    if (!loco || !mesh) return;
    loco.updateMatrix();
    smoke.copy(chimney).applyMatrix4(loco.matrix);
    const inTunnel = DIORAMA.tunnels.some((t) => Math.abs(wrap(a0 + cars[0].length * 0.28 / DIORAMA.trackRadius - t)) < TUNNEL_REACH);
    puffState.forEach((s, i) => {
      s.age += dt / 1.6;
      if (s.age >= 1) {
        s.age -= 1;
        s.x = smoke.x;
        s.y = smoke.y;
        s.z = smoke.z;
      }
      const k = s.age;
      const size = inTunnel && k < 0.3 ? 0 : 0.003 + k * 0.011;
      m.makeScale(size, size, size).setPosition(s.x + k * 0.008, s.y + k * 0.06, s.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const refs = [car0, car1, car2, car3];
  return (
    <>
      {cars.map((c, i) => (
        <group key={i} ref={refs[i]}>
          <primitive object={c.object} />
        </group>
      ))}
      <instancedMesh ref={puffs} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#e9edf3" transparent opacity={0.35} roughness={1} depthWrite={false} />
      </instancedMesh>
    </>
  );
}
