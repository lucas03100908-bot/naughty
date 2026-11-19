import * as THREE from 'three';

/**
 * The glass's transmission pass re-draws every opaque object into a texture, to refract what is
 * behind the globe. Most of the diorama around the globe can't be seen through it, yet costs as
 * much there as in the main pass. Meshes registered here draw nothing in that pass unless their
 * bounds overlap the globe on screen.
 */

/** The globe's outline on screen this frame, in NDC with x scaled by the aspect ratio. */
const globe = { x: 0, y: 0, r: 0, aspect: 1, ready: false };
/** Refraction bends a little of the surroundings into the glass's edge: widen the outline. */
const MARGIN = 1.12;
const v = new THREE.Vector3();
const e = new THREE.Vector3();
const sphere = new THREE.Sphere();

/** Project a world sphere to a screen circle (aspect-corrected NDC). False if behind the camera. */
function projectSphere(center: THREE.Vector3, radius: number, camera: THREE.Camera, aspect: number, out: { x: number; y: number; r: number }) {
  v.copy(center).applyMatrix4(camera.matrixWorldInverse);
  if (v.z > -radius) return false; // touching or behind the camera: treat as overlapping
  // Edge point: offset sideways in view space by the radius.
  e.copy(v).setX(v.x + radius).applyMatrix4(camera.projectionMatrix);
  v.applyMatrix4(camera.projectionMatrix);
  out.x = v.x * aspect;
  out.y = v.y;
  out.r = Math.abs(e.x - v.x) * aspect;
  return true;
}

/** Call once a frame before rendering, with the glass mesh and the camera. */
export function updateGlobeOutline(glass: THREE.Mesh, camera: THREE.Camera, aspect: number) {
  const g = glass.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  sphere.copy(g.boundingSphere!).applyMatrix4(glass.matrixWorld);
  globe.aspect = aspect;
  globe.ready = glass.visible && projectSphere(sphere.center, sphere.radius, camera, aspect, globe);
  globe.r *= MARGIN;
}

const circle = { x: 0, y: 0, r: 0 };

function seenThroughGlass(mesh: THREE.Mesh, camera: THREE.Camera) {
  if (!globe.ready) return true;
  const bs = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).boundingSphere : mesh.geometry.boundingSphere;
  if (!bs) return true;
  sphere.copy(bs).applyMatrix4(mesh.matrixWorld);
  if (!projectSphere(sphere.center, sphere.radius, camera, globe.aspect, circle)) return true;
  return Math.hypot(circle.x - globe.x, circle.y - globe.y) < circle.r + globe.r;
}

function inTransmissionPass(renderer: THREE.WebGLRenderer) {
  const rt = renderer.getRenderTarget();
  return !!rt && rt.texture.generateMipmaps && rt.texture.minFilter === THREE.LinearMipmapLinearFilter;
}

/** Register every mesh under `root` not yet registered (cheap to call again as models load). */
export function cullFromTransmission(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!(mesh.isMesh || (o as THREE.Points).isPoints) || mesh.userData.transmissionCull) return;
    mesh.userData.transmissionCull = true;
    let saved = -1;
    mesh.onBeforeRender = (renderer, _scene, camera, geometry) => {
      if (!inTransmissionPass(renderer) || seenThroughGlass(mesh, camera)) return;
      saved = geometry.drawRange.count;
      geometry.drawRange.count = 0;
    };
    mesh.onAfterRender = (_renderer, _scene, _camera, geometry) => {
      if (saved === -1) return;
      geometry.drawRange.count = saved;
      saved = -1;
    };
  });
}
