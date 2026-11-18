'use client';
import { ChristmasTree } from '@/src/props/ChristmasTree';
import { Snowman } from '@/src/props/Snowman';
import { LAYOUT } from './layout';

/** The snowman and the village tree (hit its star with a snowball). The prank lamp lives in Village. */
export function Pranks() {
  return (
    <group>
      <Snowman at={LAYOUT.snowman} />
      <ChristmasTree at={LAYOUT.villageTree} />
    </group>
  );
}
