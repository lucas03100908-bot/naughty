'use client';
import { LIGHTS } from '@/src/game/constants';
import { MODEL_URLS, useProp } from '@/src/props/useProp';
import { StreetLamp } from '@/src/props/StreetLamp';

type Vec3 = [number, number, number];

function Prop({ url, emissive, position, rotationY = 0, scale }: { url: string; emissive: number; position: Vec3; rotationY?: number; scale: number }) {
  const object = useProp(url, emissive);
  return <primitive object={object} position={position} rotation-y={rotationY} scale={scale} />;
}

/**
 * The street, laid out after the reference: shopfronts angled in on both sides of a cobbled
 * lane that runs away from the viewer, lamps at the mouth of the lane, small trees between.
 * Positions are in globe-local units with y = 0 on the floor.
 */
export function Village() {
  return (
    <group scale={1.12}>
      {/* Left row */}
      <Prop url={MODEL_URLS.shopA} emissive={LIGHTS.shopEmissive} position={[-0.165, 0, -0.05]} rotationY={0.75} scale={0.33} />
      {/* Right row */}
      <Prop url={MODEL_URLS.shopB} emissive={LIGHTS.shopEmissive} position={[0.17, 0, -0.04]} rotationY={-0.7} scale={0.36} />
      {/* Far end of the lane */}
      <Prop url={MODEL_URLS.shopB} emissive={LIGHTS.shopEmissive} position={[0.02, 0, -0.24]} rotationY={0.1} scale={0.27} />

      <StreetLamp position={[-0.075, 0, 0.13]} scale={0.16} />
      <StreetLamp position={[0.085, 0, 0.11]} scale={0.16} rotationY={Math.PI} />

      <Prop url={MODEL_URLS.tree} emissive={LIGHTS.treeEmissive} position={[-0.28, 0, 0.16]} scale={0.13} />
      <Prop url={MODEL_URLS.tree} emissive={LIGHTS.treeEmissive} position={[0.29, 0, 0.17]} rotationY={1.2} scale={0.12} />
      <Prop url={MODEL_URLS.tree} emissive={LIGHTS.treeEmissive} position={[-0.12, 0, -0.27]} rotationY={2.1} scale={0.1} />
    </group>
  );
}
