'use client';
 
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { LIGHTS, VIEW } from '@/src/game/constants';
import { live } from '@/src/game/store';
import { MODEL_URLS, useProp } from '@/src/props/useProp';
import { StreetLamp } from '@/src/props/StreetLamp';
import { groundLift } from './groundSample';
import { FOOTPRINT, LAYOUT, type Placement } from './layout';

function Prop({ url, emissive, at, footprint }: { url: string; emissive: number; at: Placement; footprint: number }) {
  const object = useProp(url, emissive, true, at.tint);
  const sx = at.mirror ? -at.scale : at.scale;
  const [x, y, z] = at.position;
  // Stand on the street, not in it.
  const lift = groundLift(x, z, footprint * at.scale);
  return <primitive object={object} position={[x, y + lift, z]} rotation-y={at.rotationY} scale={[sx, at.scale, at.scale]} />;
}

/** The distant version of each shop, shown while the globe is seen from outside. */
const FAR = { shopA: 'shopAFar', shopB: 'shopBFar' } as const;

/**
 * A shop in two levels of detail. From outside each is a few dozen pixels tall behind the glass,
 * yet the full model costs its triangles three times a frame (main, glass refraction, shadow).
 */
function Shop({ shop }: { shop: (typeof LAYOUT.shops)[number] }) {
  const near = useRef<THREE.Group>(null);
  const far = useRef<THREE.Group>(null);
  useFrame(() => {
    const close = live.viewBlend > VIEW.nearDetailFrom;
    if (near.current) near.current.visible = close;
    if (far.current) far.current.visible = !close;
  });
  const footprint = FOOTPRINT[shop.url];
  return (
    <>
      <group ref={near}>
        <Prop url={MODEL_URLS[shop.url]} emissive={LIGHTS.shopEmissive} at={shop} footprint={footprint} />
      </group>
      <group ref={far}>
        <Prop url={MODEL_URLS[FAR[shop.url]]} emissive={LIGHTS.shopEmissive} at={shop} footprint={footprint} />
      </group>
    </>
  );
}

/** Shops, lamps and corner trees, placed from layout.ts. */
export function Village() {
  return (
    <group>
      {LAYOUT.shops.map((shop, i) => (
        <Shop key={i} shop={shop} />
      ))}

      <StreetLamp position={LAYOUT.lampLeft.position} rotationY={LAYOUT.lampLeft.rotationY} scale={LAYOUT.lampLeft.scale} prank />
      <StreetLamp position={LAYOUT.lampRight.position} rotationY={LAYOUT.lampRight.rotationY} scale={LAYOUT.lampRight.scale} />
      {LAYOUT.lampsSmall.map((l, i) => (
        <StreetLamp key={i} position={l.position} rotationY={l.rotationY} scale={l.scale} shadows={false} />
      ))}

      {LAYOUT.cornerTrees.map((t, i) => (
        <Prop key={i} url={MODEL_URLS.pine} emissive={0} at={t} footprint={FOOTPRINT.pine} />
      ))}
    </group>
  );
}
