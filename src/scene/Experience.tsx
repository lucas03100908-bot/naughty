'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CAMERA, GLOBE, LOOK, PLAY, SCENE_TILT, VIDEO, VIEW } from '@/src/game/constants';
import { live, useApp } from '@/src/game/store';
import { applyOffAxis, eyeFromHeadCm, type ViewWindow } from '@/src/tracking/offAxisCamera';
import { JudgeDirector } from './JudgeDirector';
import { setSceneCapture } from './capture';
import { Diorama } from './diorama/Diorama';
import { PostFX } from './PostFX';
import { SnowGlobe } from './SnowGlobe';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Window placement inside the village, in world space (accounts for globe transform + tilt). */
function insideWindow(): ViewWindow {
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), SCENE_TILT);
  const [cx, cy, cz] = VIEW.insideCenter;
  const local = new THREE.Vector3(cx, GLOBE.floorY + cy, cz);
  const center = local.multiplyScalar(GLOBE.scale).add(new THREE.Vector3(...GLOBE.position)).applyQuaternion(tilt);
  // Level with the globe, then tipped down a little to show the lane.
  const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -VIEW.insidePitch);
  return { center, scale: VIEW.insideScale, quaternion: tilt.clone().multiply(pitch) };
}

/**
 * Rebuilds the asymmetric frustum from the head position every rendered frame, and moves the
 * window between the real screen (outside) and the lane (inside) when the game asks for it.
 */
function OffAxisRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const outside = useMemo<ViewWindow>(() => ({ center: new THREE.Vector3(), scale: 1, quaternion: new THREE.Quaternion() }), []);
  const inside = useMemo(() => insideWindow(), []);
  const win = useMemo<ViewWindow>(() => ({ center: new THREE.Vector3(), scale: 1, quaternion: new THREE.Quaternion() }), []);
  const frames = useRef({ n: 0, start: 0 });
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    // __checkLayout(): lists props whose bounding boxes intersect (layout.ts promises none).
    const checkLayout = () => {
      const floor = scene.getObjectByName('village-floor');
      const tilted = scene.getObjectByName('tilted');
      if (!floor || !tilted) return 'no village';
      // Measure with the scene level: world AABBs of tipped objects would be inflated.
      const keep = tilted.rotation.x;
      tilted.rotation.x = 0;
      scene.updateMatrixWorld(true);
      const items: { name: string; box: THREE.Box3 }[] = [];
      for (const g of floor.children)
        if (!g.userData.isGround)
        for (const c of g.children)
          if (!(c as THREE.Light).isLight && !c.userData.isGround) items.push({ name: c.name || c.type, box: new THREE.Box3().setFromObject(c, true) });
      tilted.rotation.x = keep;
      scene.updateMatrixWorld(true);
      const hits: string[] = [];
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) if (items[i].box.intersectsBox(items[j].box)) hits.push(`${i}:${items[i].name} × ${j}:${items[j].name}`);
      return hits.length ? hits : 'no overlaps';
    };
    // __topView(px): renders the village floor from straight above into an <img> for layout work.
    const topView = (px = 700) => {
      const floor = scene.getObjectByName('village-floor');
      const tilted = scene.getObjectByName('tilted');
      if (!floor || !tilted) return 'no village';
      const keep = tilted.rotation.x;
      tilted.rotation.x = 0;
      scene.updateMatrixWorld(true);
      const c = new THREE.Vector3();
      floor.getWorldPosition(c);
      const half = 0.4 * GLOBE.scale;
      const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 10);
      cam.position.set(c.x, c.y + 2, c.z);
      cam.up.set(0, 0, -1);
      cam.lookAt(c);
      const rt = new THREE.WebGLRenderTarget(px, px);
      gl.setRenderTarget(rt);
      gl.render(scene, cam);
      const buf = new Uint8Array(px * px * 4);
      gl.readRenderTargetPixels(rt, 0, 0, px, px, buf);
      gl.setRenderTarget(null);
      rt.dispose();
      tilted.rotation.x = keep;
      scene.updateMatrixWorld(true);
      const cv = document.createElement('canvas');
      cv.width = cv.height = px;
      const ctx = cv.getContext('2d')!;
      const img = ctx.createImageData(px, px);
      for (let y = 0; y < px; y++) img.data.set(buf.subarray((px - 1 - y) * px * 4, (px - y) * px * 4), y * px * 4);
      ctx.putImageData(img, 0, 0);
      return cv.toDataURL('image/png');
    };
    Object.assign(window, { __scene: scene, __camera: camera, __gl: gl, __THREE: THREE, __checkLayout: checkLayout, __topView: topView });
  }, [scene, camera, gl]);

  useFrame(() => {
    const now = performance.now();
    const v = useApp.getState().view;
    const p = Math.min(1, Math.max(0, (now - v.startAt) / (v.durationSec * 1000)));
    const blend = v.from + (v.to - v.from) * ease(p);
    live.viewBlend = blend;

    win.center.lerpVectors(outside.center, inside.center, blend);
    // Scale interpolates geometrically so the zoom feels even all the way in.
    win.scale = Math.exp(THREE.MathUtils.lerp(Math.log(outside.scale), Math.log(inside.scale), blend));
    win.quaternion.slerpQuaternions(outside.quaternion, inside.quaternion, blend);

    eyeFromHeadCm(live.head, eye);
    // Pull the whole eye toward the window inside: wider field of view, same angular parallax.
    eye.multiplyScalar(THREE.MathUtils.lerp(1, VIEW.insideEyeDepth, blend));
    // …but let sideways/vertical head motion travel further inside, so leaning can peek round things.
    const peek = THREE.MathUtils.lerp(1, VIEW.insidePeekGain, blend);
    eye.x *= peek;
    eye.y *= peek;
    applyOffAxis(camera, eye, win, size.width / size.height);

    const f = frames.current;
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

/** Registers a still-capture of the scene for the share image (no post-processing, no UI). */
function SceneCapture() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    setSceneCapture(() => {
      gl.render(scene, camera);
      // Project the globe's top and the base's bottom so the share card can crop around it.
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), SCENE_TILT);
      const toScreen = (y: number) => {
        const p = new THREE.Vector3(0, y, 0).multiplyScalar(GLOBE.scale).add(new THREE.Vector3(...GLOBE.position)).applyQuaternion(tilt).project(camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      };
      const top = toScreen(GLOBE.centerY + GLOBE.radius);
      const bottom = toScreen(0);
      return { url: gl.domElement.toDataURL('image/jpeg', 0.9), globe: { cx: (top.x + bottom.x) / 2, top: top.y, bottom: bottom.y } };
    });
    return () => setSceneCapture(null);
  }, [gl, scene, camera]);
  return null;
}

/** Advances the state machine on time: start → play → judge. The judge runs in JudgeDirector. */
function Director() {
  useFrame(() => {
    const s = useApp.getState();
    const now = performance.now();
    const since = (now - s.phaseAt) / 1000;
    // The video normally ends the start phase (VideoTransition); this is the safety net.
    if (s.phase === 'start' && since >= VIDEO.maxSec) s.enterPlay();
    else if (s.phase === 'play') {
      const elapsed = (now - s.playStartAt) / 1000;
      const last = s.pranks.at(-1);
      const allDone = s.pranks.length === 3 && last && elapsed - last.elapsedSec >= PLAY.allDoneDelaySec;
      if (elapsed >= PLAY.durationSec || allDone) s.endPlay();
    }
  });
  return null;
}

/** Baked from a moonless-night HDRI by scripts/bake-sky.mjs: its starry sky only, no ground. */
const SKY_HDRI = '/hdri/sky.hdr';

/** The sky dims to near-black from inside the globe (night street), and sits low outside it. */
function SkyDimmer() {
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    scene.backgroundIntensity = THREE.MathUtils.lerp(LOOK.skyIntensity, 0.04, live.viewBlend);
    scene.environmentIntensity = THREE.MathUtils.lerp(LOOK.envIntensity, LOOK.envIntensity * 0.5, live.viewBlend);
  });
  return null;
}

function Lights() {
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(GLOBE.position[0], GLOBE.position[1] + 0.5, GLOBE.position[2]);
    return o;
  }, []);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const key = useRef<THREE.SpotLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  // Inside the globe the studio lights fade down: night street, lit by moon, lamps and windows.
  useFrame(() => {
    const k = THREE.MathUtils.lerp(1, LOOK.insideAmbient, live.viewBlend);
    if (hemi.current) hemi.current.intensity = 0.6 * k;
    if (fill.current) fill.current.intensity = 0.9 * k;
    if (key.current) key.current.intensity = 9 * k;
    if (moon.current) moon.current.intensity = 0.6 * k;
  });
  return (
    <>
      <primitive object={target} />
      <hemisphereLight ref={hemi} args={['#4f5f86', '#0c0b0c', 0.6]} />
      {/* Broad, low warm fill from the viewer's side so the knit and the wood read. */}
      <directionalLight ref={fill} position={[0.6, 1.2, 2.5]} intensity={0.9} color="#ffe2c4" />
      {/* Moonlight from upper left behind: rims the ridges and the snow's crests in cool blue. */}
      <directionalLight ref={moon} position={[-1.8, 2.2, -2.2]} intensity={0.6} color="#a9bcff" />
      {/* Soft key from the front, gives the glass its highlight and the knit its texture. */}
      <spotLight ref={key} position={[0.9, 1.6, 1.4]} target={target} angle={0.55} penumbra={1} intensity={9} color="#fff1df" decay={2} distance={6} />
      {/* Rim from behind to separate the globe from the dark. */}
      <spotLight position={[-0.6, 0.9, -2.2]} target={target} angle={0.6} penumbra={1} intensity={6} color="#9fb4ff" decay={2} distance={6} />
    </>
  );
}

export default function Experience() {
  // Pixel ratio ceiling: 1.5 on a retina screen is sharp enough under the film grain and costs
  // half of 2. If frames keep dropping, step down to 1; if they recover, step back up.
  const [dpr, setDpr] = useState<number>(LOOK.dprMax);
  return (
    <Canvas
      dpr={[1, dpr]}
      shadows="soft"
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        // The glass's refraction is soft; render what's behind it at half resolution.
        gl.transmissionResolutionScale = LOOK.transmissionScale;
        // The diorama's train is clipped where it goes into a tunnel.
        gl.localClippingEnabled = true;
      }}
      camera={{ position: [0, 0, 3], near: CAMERA.near, far: CAMERA.far, manual: true } as never}
      style={{ position: 'fixed', inset: 0 }}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => setDpr(LOOK.dprMin)}
        onIncline={() => setDpr(LOOK.dprMax)}
        onFallback={() => setDpr(LOOK.dprMin)}
      />
      <color attach="background" args={['#030305']} />
      <fog attach="fog" args={[LOOK.fogColor, 3.8, 9]} />
      <OffAxisRig />
      <Director />
      <SceneCapture />
      <JudgeDirector />
      <Lights />
      {/* Starry night sky behind everything; the same HDRI lights the scene, with a soft panel added
          for the glass's highlight. */}
      <Environment files={SKY_HDRI} background="only" backgroundRotation={[0, LOOK.skyRotation, 0]} />
      <SkyDimmer />
      <Environment files={SKY_HDRI} resolution={256} frames={1} environmentRotation={[0, LOOK.skyRotation, 0]}>
        {/* A long soft strip on the right: the classic product-shot glass highlight. */}
        <Lightformer form="rect" intensity={2.6} position={[2.2, 0.6, 1.2]} rotation-y={-Math.PI / 3} scale={[0.5, 3.5, 1]} color="#fff3e6" />
      </Environment>
      <group name="tilted" rotation-x={SCENE_TILT}>
        <group position={[0, GLOBE.position[1], GLOBE.position[2]]}>
          <Diorama />
        </group>
        <SnowGlobe />
      </group>
      <PostFX />
    </Canvas>
  );
}
