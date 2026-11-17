'use client';
import { Environment, Lightformer } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CAMERA, GLOBE, SCENE_TILT } from '@/src/game/constants';
import { live } from '@/src/game/store';
import { applyOffAxis, eyeFromHeadCm } from '@/src/tracking/offAxisCamera';
import { KnitCloth } from './KnitCloth';
import { PostFX } from './PostFX';
import { SnowGlobe } from './SnowGlobe';

/** Rebuilds the asymmetric frustum from the head position every rendered frame. */
function OffAxisRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const frames = useRef({ n: 0, start: 0 });
  useFrame(() => {
    eyeFromHeadCm(live.head, eye);
    applyOffAxis(camera, eye, size.width / size.height);

    const f = frames.current;
    const now = performance.now();
    if (!f.start) f.start = now;
    f.n++;
    if (now - f.start >= 500) {
      live.renderFps = (f.n * 1000) / (now - f.start);
      f.n = 0;
      f.start = now;
    }
  }, -1);
  return null;
}

function Lights() {
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(GLOBE.position[0], GLOBE.position[1] + 0.5, GLOBE.position[2]);
    return o;
  }, []);
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={['#5a6a8c', '#0c0b0c', 0.6]} />
      {/* Broad, low warm fill from the viewer's side so the knit and the wood read. */}
      <directionalLight position={[0.6, 1.2, 2.5]} intensity={0.9} color="#ffe2c4" />
      {/* Moonlight from upper left behind. */}
      <directionalLight position={[-1.5, 2.5, -1]} intensity={0.7} color="#b9c8ff" />
      {/* Soft key from the front, gives the glass its highlight and the knit its texture. */}
      <spotLight position={[0.9, 1.6, 1.4]} target={target} angle={0.55} penumbra={1} intensity={9} color="#fff1df" decay={2} distance={6} />
      {/* Rim from behind to separate the globe from the dark. */}
      <spotLight position={[-0.6, 0.9, -2.2]} target={target} angle={0.6} penumbra={1} intensity={6} color="#9fb4ff" decay={2} distance={6} />
    </>
  );
}

export default function Experience() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 3], near: CAMERA.near, far: CAMERA.far, manual: true } as never}
      style={{ position: 'fixed', inset: 0 }}
    >
      <color attach="background" args={['#030305']} />
      <fog attach="fog" args={['#030305', 3.8, 8]} />
      <OffAxisRig />
      <Lights />
      {/* Generated environment (no HDR download): soft panels for reflections on the glass. */}
      <Environment resolution={256} frames={1}>
        {/* A long soft strip on the right: the classic product-shot glass highlight. */}
        <Lightformer form="rect" intensity={2.6} position={[2.2, 0.6, 1.2]} rotation-y={-Math.PI / 3} scale={[0.5, 3.5, 1]} color="#fff3e6" />
      </Environment>
      <group rotation-x={SCENE_TILT}>
        <group position={[0, GLOBE.position[1], GLOBE.position[2]]}>
          <KnitCloth />
        </group>
        <SnowGlobe />
      </group>
      <PostFX />
    </Canvas>
  );
}
