import { GROUND_HEIGHTS } from './groundHeights.ts';

/**
 * Height of the cobbled street under a prop, so it stands on the street instead of sinking into
 * it. Returns the highest ground point within `radius` of (x, z) (globe-local, above the floor),
 * or 0 where there is no street. Uses the baked grid from scripts/ground-heights.mjs.
 */
export function groundLift(x: number, z: number, radius: number) {
  const { n, radius: R, heights } = GROUND_HEIGHTS;
  const cell = (2 * R) / n;
  const r = radius + cell * 0.5;
  let best = 0;
  const i0 = Math.max(0, Math.floor((x - r + R) / cell));
  const i1 = Math.min(n - 1, Math.floor((x + r + R) / cell));
  const j0 = Math.max(0, Math.floor((z - r + R) / cell));
  const j1 = Math.min(n - 1, Math.floor((z + r + R) / cell));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const cx = -R + (i + 0.5) * cell;
      const cz = -R + (j + 0.5) * cell;
      if (Math.hypot(cx - x, cz - z) > r) continue;
      best = Math.max(best, heights[j * n + i]);
    }
  return best;
}
