// One Euro Filter (Casiez et al. 2012): adaptive low-pass, smooth when still, responsive when moving.

class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  get last() {
    return this.y;
  }
  reset() {
    this.y = null;
  }
}

const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export interface OneEuroParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export class OneEuroFilter {
  private x = new LowPass();
  private dx = new LowPass();
  private lastT: number | null = null;

  constructor(private p: OneEuroParams) {}

  /** @param t seconds */
  filter(value: number, t: number) {
    if (this.lastT === null || t <= this.lastT) {
      this.lastT = t;
      this.dx.filter(0, 1);
      return this.x.filter(value, 1);
    }
    const dt = t - this.lastT;
    this.lastT = t;
    const prev = this.x.last ?? value;
    const edx = this.dx.filter((value - prev) / dt, alpha(this.p.dCutoff, dt));
    const cutoff = this.p.minCutoff + this.p.beta * Math.abs(edx);
    return this.x.filter(value, alpha(cutoff, dt));
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastT = null;
  }
}
