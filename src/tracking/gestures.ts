import { ROLL, SHAKE } from '@/src/game/constants';

/**
 * Roll (head tilt toward a shoulder) → signed flow strength in [-1, 1].
 * Positive = tilt toward the viewer's right = snow flows to screen right.
 */
export function rollToFlow(rollDeg: number) {
  const a = Math.abs(rollDeg);
  if (a <= ROLL.deadzoneDeg) return 0;
  const k = Math.min(1, (a - ROLL.deadzoneDeg) / (ROLL.fullDeg - ROLL.deadzoneDeg));
  return Math.sign(rollDeg) * k;
}

/**
 * Detects a head shake (도리도리) from a yaw signal: at least `minReversals` direction changes
 * within `windowMs`, each swing ≥ `minSwingDeg`. Only yaw is read, so roll can't trigger it.
 * The same detector runs on a pseudo-yaw built from mouse x in mouse mode.
 */
export class ShakeDetector {
  private dir: 0 | 1 | -1 = 0;
  private ref: number | null = null;
  private candidate = 0;
  private reversals: number[] = [];
  private cooldownUntil = 0;

  constructor(private p = SHAKE) {}

  /** @returns true on the sample where a shake is recognised. */
  update(tMs: number, yawDeg: number): boolean {
    const swing = this.p.minSwingDeg;
    if (this.ref === null) {
      this.ref = yawDeg;
      return false;
    }
    if (this.dir === 0) {
      // First half-swing only needs half the amplitude (starting from rest, not from an extreme).
      if (yawDeg - this.ref >= swing / 2) this.dir = 1;
      else if (this.ref - yawDeg >= swing / 2) this.dir = -1;
      else return false;
      this.candidate = yawDeg;
      return false;
    }

    let reversed = false;
    if (this.dir === 1) {
      if (yawDeg > this.candidate) this.candidate = yawDeg;
      else if (this.candidate - yawDeg >= swing) reversed = true;
    } else {
      if (yawDeg < this.candidate) this.candidate = yawDeg;
      else if (yawDeg - this.candidate >= swing) reversed = true;
    }
    if (!reversed) {
      // Drop stale state so a slow look-around never accumulates into a shake.
      this.reversals = this.reversals.filter((t) => tMs - t <= this.p.windowMs);
      return false;
    }

    this.dir = this.dir === 1 ? -1 : 1;
    this.candidate = yawDeg;
    this.reversals.push(tMs);
    this.reversals = this.reversals.filter((t) => tMs - t <= this.p.windowMs);

    if (tMs >= this.cooldownUntil && this.reversals.length >= this.p.minReversals) {
      this.reversals = [];
      this.cooldownUntil = tMs + this.p.cooldownMs;
      return true;
    }
    return false;
  }

  reset() {
    this.dir = 0;
    this.ref = null;
    this.reversals = [];
  }
}
