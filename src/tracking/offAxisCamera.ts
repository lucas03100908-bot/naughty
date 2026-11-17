import * as THREE from 'three';
import { CAMERA, HEAD, SCREEN } from '@/src/game/constants';

/**
 * Fish Tank VR: the screen is a window. World units are "screen heights"; the screen
 * rectangle sits at z = 0, centred on the origin. The camera sits at the viewer's eye and
 * looks straight down -z; an asymmetric frustum through the screen edges does the rest.
 */
export function eyeFromHeadCm(head: { x: number; y: number; z: number }, out = new THREE.Vector3()) {
  const nominal = HEAD.nominalDistanceCm;
  const z = nominal + (head.z - nominal) * HEAD.gainZ;
  return out.set(
    (head.x * HEAD.gainXY) / SCREEN.heightCm,
    (head.y * HEAD.gainXY) / SCREEN.heightCm,
    z / SCREEN.heightCm,
  );
}

export function applyOffAxis(camera: THREE.PerspectiveCamera, eye: THREE.Vector3, aspect: number) {
  const halfH = 0.5;
  const halfW = 0.5 * aspect;
  const n = CAMERA.near;
  const f = CAMERA.far;
  const ez = Math.max(eye.z, 0.05);
  const left = ((-halfW - eye.x) * n) / ez;
  const right = ((halfW - eye.x) * n) / ez;
  const bottom = ((-halfH - eye.y) * n) / ez;
  const top = ((halfH - eye.y) * n) / ez;

  camera.position.copy(eye);
  camera.quaternion.identity();
  camera.updateMatrixWorld();
  camera.near = n;
  camera.far = f;
  camera.projectionMatrix.makePerspective(left, right, top, bottom, n, f);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
