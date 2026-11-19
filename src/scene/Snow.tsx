'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOBE, SNOW, STORM, VIEW } from '@/src/game/constants';
import { live } from '@/src/game/store';
import { flakeSprite } from './proceduralTextures';
import { GROUND_HEIGHTS } from './groundHeights';
import { createSnowSim, type SnowSim } from './snowSim';

/** Snow = falling flakes (Points) + a floor heightfield. The simulation lives in snowSim.ts. */
export function Snow() {
  const sim = useMemo(() => createSnowSim(), []);
  const sprite = useMemo(() => flakeSprite(), []);
  // A flake right in front of the eye would fill the screen as a blurry disc: cap its size.
  const capFlakes = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <logdepthbuf_vertex>',
        `#include <logdepthbuf_vertex>\ngl_PointSize = min(gl_PointSize, ${SNOW.maxFlakePx.toFixed(1)});`,
      );
    },
    [],
  );
  const lastShakeSeen = useRef(0);
  const flakeMat = useRef<THREE.PointsMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const lastBlockAt = useRef(0);
  const blockSig = useRef('');

  // Dev only: inspect the heightfield from the console (window.__snow.inspect()).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as unknown as { __snow: typeof sim }).__snow = sim;
  }, [sim]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const now = performance.now();
    if (live.lastShakeAt !== lastShakeSeen.current) {
      lastShakeSeen.current = live.lastShakeAt;
      sim.shake(now);
    }
    sim.step(dt, now, state.clock.elapsedTime, live.flow, live.storm * STORM.maxStir);
    // Keep the snow out from under the props. Models stream in (and the village remounts each
    // round), so re-check every second and rebuild only when the set of props changed.
    if (group.current && now - lastBlockAt.current > 1000) {
      lastBlockAt.current = now;
      const village = group.current.parent?.getObjectByName('village-floor');
      if (village) {
        let meshes = 0;
        village.traverse((o) => void ((o as THREE.Mesh).isMesh && meshes++));
        const sig = `${village.uuid}:${meshes}`;
        if (sig !== blockSig.current) {
          blockSig.current = sig;
          sim.setBlocked(blockedCells(sim, group.current, village));
        }
      }
    }
    // Flakes are drawn at a fixed world size; inside the village they would be snowballs.
    if (flakeMat.current) flakeMat.current.size = SNOW.flakeSize * THREE.MathUtils.lerp(1, VIEW.insideFlakeScale, live.viewBlend);
  });

  return (
    <group ref={group}>
      <mesh geometry={sim.fieldGeometry} renderOrder={1} receiveShadow>
        <meshStandardMaterial vertexColors transparent roughness={0.95} color="#cdd6e4" emissive="#6d7c96" emissiveIntensity={0.06} />
      </mesh>
      <points geometry={sim.flakeGeometry} frustumCulled={false} renderOrder={3}>
        <pointsMaterial
          ref={flakeMat}
          map={sprite}
          size={SNOW.flakeSize}
          sizeAttenuation
          transparent
          depthWrite={false}
          color="#ffffff"
          opacity={0.85}
          onBeforeCompile={capFlakes}
        />
      </points>
    </group>
  );
}

/** How far above the street a prop's vertex still counts as "standing here" (globe units). */
const FOOT_HEIGHT = 0.035;

/**
 * Floor cells covered by the props: every vertex near the ground marks its cell, then each prop's
 * marked cells are filled row by row (its inside has no vertices near the ground) and grown by
 * one cell so the snow edge tucks under the wall instead of stopping short of it.
 */
function blockedCells(sim: SnowSim, snowSpace: THREE.Object3D, village: THREE.Object3D) {
  const { N } = sim.inspect();
  const blocked = new Uint8Array(N * N);
  snowSpace.updateWorldMatrix(true, false);
  village.updateMatrixWorld(true);
  const toSnow = snowSpace.matrixWorld.clone().invert();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();

  // Group meshes by prop: the ancestor two levels below the village group.
  const props = new Map<THREE.Object3D, THREE.Mesh[]>();
  village.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    let a: THREE.Object3D = mesh;
    while (a.parent && a.parent.parent && a.parent.parent !== village) a = a.parent;
    if (a.userData.isGround || a.parent?.userData.isGround) return;
    const list = props.get(a) ?? [];
    list.push(mesh);
    props.set(a, list);
  });

  for (const meshes of props.values()) {
    const rowMin = new Int32Array(N).fill(N);
    const rowMax = new Int32Array(N).fill(-1);
    for (const mesh of meshes) {
      const material = mesh.material as THREE.Material;
      if (material.transparent && (material as THREE.MeshBasicMaterial).opacity === 0) continue; // hit targets
      const pos = mesh.geometry.getAttribute('position');
      m.multiplyMatrices(toSnow, mesh.matrixWorld);
      const stride = Math.max(1, Math.floor(pos.count / 40000));
      for (let i = 0; i < pos.count; i += stride) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        const k = sim.cellAt(v.x, v.z);
        if (k < 0) continue;
        const g = GROUND_HEIGHTS.n === N ? Math.max(0, GROUND_HEIGHTS.heights[k]) : 0;
        if (v.y - GLOBE.floorY - g > FOOT_HEIGHT) continue;
        const row = Math.floor(k / N);
        const col = k % N;
        rowMin[row] = Math.min(rowMin[row], col);
        rowMax[row] = Math.max(rowMax[row], col);
      }
    }
    for (let row = 0; row < N; row++) for (let col = rowMin[row]; col <= rowMax[row]; col++) blocked[row * N + col] = 1;
  }

  // Grow by one cell.
  const grown = blocked.slice();
  for (let row = 0; row < N; row++)
    for (let col = 0; col < N; col++) {
      if (!blocked[row * N + col]) continue;
      if (col > 0) grown[row * N + col - 1] = 1;
      if (col < N - 1) grown[row * N + col + 1] = 1;
      if (row > 0) grown[(row - 1) * N + col] = 1;
      if (row < N - 1) grown[(row + 1) * N + col] = 1;
    }
  return grown;
}
