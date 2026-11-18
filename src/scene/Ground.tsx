'use client';
import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { MODEL_URLS } from '@/src/props/useProp';
import { LOOK } from '@/src/game/constants';
import { GROUND } from './layout';

/**
 * The cobbled street the village stands on. The model is square-ish and would poke through the
 * glass, so its material discards fragments farther than GROUND.clipRadius from the globe axis.
 * The test maps the mesh's own (quantized) coordinates to floor space with a fixed matrix:
 * GROUND placement × the mesh's transform inside the model. Independent of where the globe sits.
 */
export function Ground() {
  const { scene } = useGLTF(MODEL_URLS.ground);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.userData.isGround = true; // the layout overlap check skips it
    clone.updateMatrixWorld(true);
    const placement = new THREE.Matrix4().compose(
      new THREE.Vector3(...GROUND.position),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), GROUND.rotationY),
      new THREE.Vector3(GROUND.scale, GROUND.scale, GROUND.scale),
    );
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const toFloor = placement.clone().multiply(mesh.matrixWorld);
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      m.envMapIntensity = 0.35;
      m.color.multiply(new THREE.Color(LOOK.groundTint));
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uToFloor = { value: toFloor };
        shader.uniforms.uClipRadius = { value: GROUND.clipRadius };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform mat4 uToFloor;\nvarying vec2 vFloorXZ;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorXZ = (uToFloor * vec4(transformed, 1.0)).xz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vFloorXZ;\nuniform float uClipRadius;')
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (length(vFloorXZ) > uClipRadius) discard;');
      };
      mesh.material = m;
      mesh.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  return <primitive object={object} position={GROUND.position} rotation-y={GROUND.rotationY} scale={GROUND.scale} />;
}
