'use client';
import { LIGHTS } from '@/src/game/constants';
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

/** Shops, lamps and corner trees, placed from layout.ts. */
export function Village() {
  return (
    <group>
      {LAYOUT.shops.map((shop, i) => (
        <Prop key={i} url={MODEL_URLS[shop.url]} emissive={LIGHTS.shopEmissive} at={shop} footprint={FOOTPRINT[shop.url]} />
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
