// Every tuning value lives here. docs/TUNING.md explains what each one means.

/** Physical screen + webcam model used by the off-axis projection. */
export const SCREEN = {
  /** Visible screen height in cm. 13–14" laptops ≈ 18–20 cm. 1 world unit = this height. */
  heightCm: 19,
};

export const WEBCAM = {
  /** Horizontal field of view of the built-in webcam, degrees. Most laptops: 55–70. */
  hfovDeg: 60,
  /** Webcam lens distance above the top edge of the screen, cm. */
  aboveScreenCm: 1,
  width: 640,
  height: 480,
};

export const HEAD = {
  /** Average adult interpupillary distance, cm. Used to estimate z from eye spacing. */
  ipdCm: 6.3,
  /** Eye distance assumed when no face is tracked (mouse mode, startup), cm. */
  nominalDistanceCm: 55,
  minDistanceCm: 25,
  maxDistanceCm: 120,
  /** Multiplies measured x/y head motion. >1 exaggerates parallax. */
  gainXY: 1.0,
  /** Multiplies measured change in distance from nominal. */
  gainZ: 1.0,
};

export const TRACKING = {
  /** Face Landmarker inference rate. Rendering runs at display rate independently. */
  fps: 30,
  /** Seconds without a face before tracking is reported as lost. */
  lostAfterSec: 0.5,
};

/** One Euro Filter for head position (cm). Lower minCutoff = less jitter, more lag. */
export const ONE_EURO_POSITION = { minCutoff: 0.8, beta: 0.04, dCutoff: 1.0 };
/** One Euro Filter for roll/yaw (degrees). */
export const ONE_EURO_ANGLE = { minCutoff: 1.5, beta: 0.02, dCutoff: 1.0 };

export const ROLL = {
  /** |roll| below this does nothing, degrees. */
  deadzoneDeg: 5,
  /** |roll| at which flow reaches full speed, degrees. */
  fullDeg: 25,
};

export const SHAKE = {
  /** Reversals must all fall inside this window, ms. */
  windowMs: 1500,
  /** Yaw direction changes needed to count as a shake. */
  minReversals: 3,
  /** Each swing between two extremes must be at least this, degrees. */
  minSwingDeg: 12,
  /** Ignore new shakes for this long after one fires, ms. */
  cooldownMs: 1500,
};

export const MOUSE = {
  /** Head offset at the screen edge in mouse mode, cm. */
  rangeXCm: 18,
  rangeYCm: 10,
  /** Roll at the screen edge while Shift is held, degrees. */
  rollMaxDeg: 30,
  /** Mouse x is mapped to a pseudo-yaw of ±this for the shake detector, degrees. */
  shakeYawScaleDeg: 30,
};

/** Globe geometry in globe-local units (the whole object is ~1 unit tall). */
export const GLOBE = {
  radius: 0.45,
  centerY: 0.45,
  /** Top of the wooden base = snow floor height. */
  floorY: 0.2,
  /** Radius of the floor disc where the glass meets the base. */
  floorRadius: 0.368,
  /** Globe placement in world units (1 unit = screen height). Negative z = behind the screen. */
  scale: 0.76,
  position: [0, -0.5, -0.4] as [number, number, number],
};

export const CAMERA = { near: 0.05, far: 40 };

/**
 * The globe and cloth are tipped toward the viewer around the screen centre, so a viewer at
 * eye level looks slightly down onto the table (like the reference photo). Radians.
 */
export const SCENE_TILT = 0.2;

export const SNOW = {
  count: 3000,
  /** Heightfield resolution (cells per side). */
  grid: 64,
  /** Terminal fall speed, globe units/s. */
  fallSpeed: 0.055,
  /** Sideways drift amplitude, globe units/s. */
  drift: 0.025,
  /** Height added to a cell per landed flake. */
  depositPerFlake: 0.00006,
  /** Starting snow depth. */
  initialDepth: 0.009,
  /** Cells never grow above this. */
  maxDepth: 0.05,
  /** Heightfield cells the snow layer travels per second at full roll (64 cells = floor width). */
  flowRate: 24,
  /** Max height difference between neighbours before snow slumps (angle of repose). */
  reposeStep: 0.004,
  /** Shake: how long flakes stay stirred up before they settle, seconds. */
  shakeStirSec: 2.2,
  /** Shake: random acceleration at full stir, units/s². */
  shakeKick: 1.6,
  /** Shake: share of particles teleported to the floor and thrown up as the "lifted" snow. */
  shakeLiftShare: 0.6,
  /** After the stir dies down, lifted snow settles back over this many seconds. */
  returnSec: 5,
  flakeSize: 0.016,
};

export const LIGHTS = {
  shopEmissive: 1.4,
  lampEmissive: 3.0,
  treeEmissive: 0.25,
  lampPointIntensity: 0.012,
};
