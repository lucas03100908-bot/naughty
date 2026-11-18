import * as THREE from 'three';
import { CAMERA, HEAD, SCREEN } from '@/src/game/constants';

/**
 * Fish Tank VR. The screen is a window: a rectangle 1 "window unit" tall. The camera sits at the
 * viewer's eye, looks straight through the window, and gets an asymmetric frustum through the
 * window's edges.
 *
 * The window itself can be placed anywhere in the world (centre, uniform scale, rotation). That
 * is how the dive works: outside, the window is the real screen at the origin; inside, it is a
 * small rectangle standing in the village lane, and the same head tracking looks through it.
 */
export interface ViewWindow {
  center: THREE.Vector3;
  /** World height of the window. */
  scale: number;
  quaternion: THREE.Quaternion;
}

/** Head position (cm, relative to screen centre) → eye in window units. */
export function eyeFromHeadCm(head: { x: number; y: number; z: number }, out = new THREE.Vector3()) {
  const nominal = HEAD.nominalDistanceCm;
  const z = nominal + (head.z - nominal) * HEAD.gainZ;
  return out.set(
    (head.x * HEAD.gainXY) / SCREEN.heightCm,
    (head.y * HEAD.gainXY) / SCREEN.heightCm,
    z / SCREEN.heightCm,
  );
}

const tmp = new THREE.Vector3();

/** @param eyeLocal eye in window units (from eyeFromHeadCm) */
export function applyOffAxis(camera: THREE.PerspectiveCamera, eyeLocal: THREE.Vector3, win: ViewWindow, aspect: number) {
  const halfH = 0.5;
  const halfW = 0.5 * aspect;
  const ez = Math.max(eyeLocal.z, 0.05);
  // Near plane in window units; scaled with the window so the inside view keeps its precision.
  const nLocal = CAMERA.near;
  const left = ((-halfW - eyeLocal.x) * nLocal) / ez;
  const right = ((halfW - eyeLocal.x) * nLocal) / ez;
  const bottom = ((-halfH - eyeLocal.y) * nLocal) / ez;
  const top = ((halfH - eyeLocal.y) * nLocal) / ez;

  const s = win.scale;
  tmp.copy(eyeLocal).multiplyScalar(s).applyQuaternion(win.quaternion).add(win.center);
  camera.position.copy(tmp);
  camera.quaternion.copy(win.quaternion);
  camera.updateMatrixWorld();

  const n = nLocal * s;
  const f = CAMERA.far;
  camera.near = n;
  camera.far = f;
  camera.projectionMatrix.makePerspective(left * s, right * s, top * s, bottom * s, n, f);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
