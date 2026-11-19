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
  /**
   * Distance from the neck pivot to the eyes, cm. Head roll swings the eyes sideways by
   * this × sin(roll); that swing is removed from the viewpoint so tilting only moves the snow.
   */
  rollPivotCm: 12,
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
  /** Mouse x is mapped to a pseudo-yaw of ±this for the shake detector, degrees. */
  shakeYawScaleDeg: 30,
  /**
   * Inside the globe the cursor also aims at pranks, so it moves the view a little less.
   * Not too little: the tree switch is found by looking past the tree.
   */
  insideViewScale: 1,
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

/**
 * The miniature ski world on the table around the globe (outside only). World units, from the
 * table point under the globe's centre.
 */
export const DIORAMA = {
  /** Nothing but level snow inside this radius (the globe's base is ~0.34). */
  clearRadius: 0.4,
  /** The toy train's loop around the base, and the half-width of its flat bed. */
  trackRadius: 0.47,
  trackBed: 0.032,
  bedHeight: 0.004,
  /** Track angles (radians, 0 = right, +π/2 = toward the viewer) where it runs through a hill. */
  tunnels: [-0.35, Math.PI + 0.35] as number[],
  /** Train speed around the loop, radians per second (a lap ≈ 30 s). */
  trainSpeed: 0.21,
  /** Chair lift: loop speed in loop-lengths per second, and how many chairs hang on it. */
  liftSpeed: 0.012,
  liftChairs: 14,
  /** Skier speed range down a run, runs per second. */
  skierSpeed: [0.05, 0.085] as [number, number],
  pines: 40,
};

export const SNOW = {
  count: 3000,
  /** Heightfield resolution (cells per side). */
  grid: 64,
  /** Terminal fall speed, globe units/s. */
  fallSpeed: 0.0275,
  /** Sideways drift amplitude, globe units/s. */
  drift: 0.025,
  /** Height added to a cell per landed flake. */
  depositPerFlake: 0.00012,
  /** Starting snow depth across the floor: thick, freshly fallen. */
  initialDepth: 0.03,
  /** Extra depth drifted up against the glass at the floor's edge. */
  edgeBank: 0.022,
  /**
   * On the cobbled street the snow layer is this share of the normal depth: patchy, so the
   * cobbles show through in places but do not dominate (they are large for the miniature).
   */
  onGroundShare: 0.19,
  /** Cells never grow above this. */
  maxDepth: 0.09,
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
  /** Largest a flake may be drawn, pixels (one passing right by the eye is otherwise a big blur). */
  maxFlakePx: 14,
  /** Ground height step (globe units) across which the floor snow fades out: cobbles bump about
   *  0.002, curbs step 0.007–0.015. */
  curbStep: [0.0045, 0.0085] as const,
};

export const LIGHTS = {
  shopEmissive: 2.2,
  lampEmissive: 3.0,
  treeEmissive: 0.25,
  lampPointIntensity: 0.02,
};

/**
 * The off-axis "window" (the screen rectangle) moves into the village for play.
 * Outside it is the real screen (centre at the origin, 1 unit tall). Inside it sits in the
 * lane, level with the globe, small enough that the viewer's eye stays inside the glass.
 */
export const VIEW = {
  /**
   * viewBlend past which the village is drawn in full: the full shop models and the lamps' point
   * lights. Below it (globe seen from outside, the village a small model behind glass) the shops
   * use their distant models and the windows' own glow stands in for the lamps' light, which
   * would otherwise cost every material in the scene.
   */
  nearDetailFrom: 0.3,
  /** Window centre inside, globe-local units (y measured from the floor). At the lane's mouth. */
  insideCenter: [0, 0.07, 0.1] as [number, number, number],
  /** Window height inside, world units. Smaller = the village feels bigger. */
  insideScale: 0.1,
  /**
   * Inside, the eye is pulled this much closer to the window (in window units), which widens the
   * field of view from the screen's real ~20° to ~75° (wide, like the reference street photo). Head x/y are scaled the same way, so
   * moving your head turns the view by the same angle as outside.
   */
  insideEyeDepth: 0.22,
  /**
   * Inside, the view turns with the head: radians per window unit of head offset (x → yaw,
   * y → pitch). Must beat the window's own skew (about 1/eye depth ≈ 1.5) or the view still turns
   * the wrong way; the margin above that is how far it follows.
   */
  insideLookYaw: 2.8,
  insideLookPitch: 2.2,
  /** Inside, the window tips down by this much (radians). Negative looks up: the tree's star has to be in view. */
  insidePitch: -0.26,
  diveSec: 2.6,
  pullSec: 2.4,
  /** Flake size multiplier at full inside view (flakes are huge up close otherwise). */
  insideFlakeScale: 0.08,
};

export const PLAY = {
  durationSec: 60,
  /** Humbug's opening line stays up this long; the dive runs underneath. */
  startLineSec: 3.2,
  /** After the last prank, wait this long before ending play. */
  allDoneDelaySec: 1.5,
};

export const PRANK = {
  /** Points for a prank done at second 0. Falls linearly to minShare × this at the buzzer. */
  maxPoints: 1000,
  minShare: 0.2,
  lampFlickerSec: 0.9,
  /** Snowball flight time to the tree star, seconds. */
  snowballSec: 0.45,
  /** Pulsing glow of the star while it waits to be hit (well above the bloom threshold). */
  starGlow: 3.2,
  /** The star is scaled up from the model so it reads as the thing to hit. */
  starScale: 2.2,
  /** Halo sprite around the star, in star radii. */
  starHaloSize: 6,
  /** Small warm light from the star onto the treetop (world intensity). */
  starLight: 0.006,
  /** The prank lamp glows this much more than the other lamps (and ×1.5 under the cursor). */
  lampBoost: 1.6,
  /** Halo round the prank lamp's lantern, in lamp heights. */
  lampHaloSize: 0.75,
  /** The prank lamp stutters once every this many seconds, as a tease. */
  lampTeaseSec: 4.5,
  /** The snowman fidgets once every this many seconds while it waits. */
  snowmanFidgetSec: 3.2,
};

/** 심술 심사: baseline, then the spite grin. See docs/TUNING.md. */
export const JUDGE = {
  baselineSec: 2,
  grinSec: 7,
  /** Pause on the final face before the result card. */
  outroSec: 1.2,
  /**
   * Channel ranges: how far above your baseline counts as "full". Blendshape scores rarely reach
   * 1; brow and sneer move much less than a smile.
   */
  range: { smile: 0.4, brow: 0.15, squint: 0.3, sneer: 0.15 },
  /** jawOpen at which the mouth counts as fully open (penalised: the grin is closed-mouth). */
  jawOpenFull: 0.35,
  weights: { grin: 0.45, smile: 0.15, squint: 0.25, sneer: 0.15 },
  /** Spite ≥ this counts toward hold time. */
  threshold: 0.3,
  /** Score = maxPoints × (peakShare × peak + holdShare × held fraction). */
  maxPoints: 2000,
  peakShare: 0.6,
  holdShare: 0.4,
  /** Exponential smoothing of the spite signal per second (higher = snappier). */
  smoothing: 8,
  /** Mouse fallback: spite climbs this much per second while held, falls while released. */
  holdRise: 0.6,
  holdFall: 0.9,
};

/** Total score → title. */
export const TITLES = [
  { min: 0, name: '귀여운 말썽꾼' },
  { min: 2000, name: '얄미운 악동' },
  { min: 3500, name: '전설의 심술쟁이' },
];

/** 심술 필터 (face warp). Displacements are in eye-distance units. */
export const FILTER = {
  /** Filter strength follows spite through this curve: strength = minStrength + (1 − minStrength) × spite. */
  minStrength: 0.15,
  /**
   * The grin: corners lift by smileLift × half the mouth width (more toward the ends, none in the
   * middle) and the mouth stretches sideways by smileStretch. smileBand is how far above/below the
   * lips the effect reaches (in half mouth widths). Keep smileLift × 1.4 / smileBand under ~1 or
   * the warp folds over.
   */
  smileLift: 0.7,
  smileStretch: 0.75,
  smileBand: 1.0,
  /** Shape of the lift along the mouth: 2 = even curve, higher = flat middle, ends hook up. */
  smileCurl: 2.6,
  browInnerDown: 0.22,
  /** Inner brow ends also pull toward the nose by this share of browInnerDown. */
  browInnerIn: 0.45,
  browOuterUp: 0.2,
  browRadius: 0.3,
  eyeSquint: 0.085,
  /** Lower lids rise by this share of eyeSquint (the upper lid does most of the work). */
  lowerLidShare: 0.35,
  eyeRadius: 0.16,
  cheekPuff: 0.16,
  cheekRadius: 0.4,
  /** Landmark smoothing per frame (0..1, higher = steadier, laggier). */
  landmarkSmoothing: 0.55,
};

/** Scene reaction to spite during the judge. */
export const STORM = {
  /** Village window/lamp glow at full spite (1 = unchanged). */
  minLight: 0.12,
  /** Snow stir at full spite (same scale as a shake's stir). */
  maxStir: 0.85,
  /** How fast the storm and lights follow spite, per second. */
  follow: 3,
};

/** Look-dev: shadows, ambient occlusion, haze. */
export const LOOK = {
  /** Moonlight inside the globe: the main shadow caster. Low (~35°) so shadows stretch out. */
  moonIntensity: 5.5,
  /** Moon position relative to the floor centre, globe-local. */
  moonPosition: [-0.6, 0.42, 0.3] as [number, number, number],
  /** Street lamps also cast (small cube shadow maps), for shadows inside their warm pools. */
  lampShadowMapSize: 256,
  /** Canvas pixel ratio: the ceiling, and where it drops to when frames can't keep up. */
  dprMax: 1.5,
  dprMin: 1,
  /** Resolution of the scene seen through the glass, relative to the canvas. */
  transmissionScale: 0.5,
  shadowMapSize: 2048,
  /** Redraw the moon's shadow map every this many frames while nothing is happening… */
  shadowEveryFrames: 6,
  /** …and every frame for this long after a prank or a phase change. */
  shadowHotSec: 4,
  /** Fog [near, far] in world units: outside (the whole globe in view) and inside (street scale). */
  fogOutside: [2.6, 7.5] as [number, number],
  /**
   * Tilt-shift from outside, so the diorama reads as a model on a table: a band of focus through
   * the globe (screen height, 0 = bottom), blur growing above and below it. Off inside the globe.
   */
  tiltFocusY: 0.41,
  tiltTaper: 0.33,
  tiltBlur: 0.12,
  /** The miniature grade from outside: a little more saturation and contrast (0 = none). */
  miniSaturation: 0.22,
  miniContrast: 0.1,
  /** Film grade (CinemaGrade: split tone, soft shoulder, halation), 0..1. */
  gradeStrength: 1,
  /** Chromatic aberration toward the frame's corners, in screen UV. */
  lensFringe: 0.0012,
  /** The HDRI night sky: how bright behind the diorama, turned so its horizon glow sits behind the range. */
  skyIntensity: 0.45,
  skyRotation: 1.38,
  /** How much the HDRI lights the scene (props have their own envMapIntensity on top). */
  envIntensity: 0.45,
  /** Distant scenery fades into the sky's horizon (bake-sky's horizon colour at skyIntensity). */
  fogColor: '#2d2f3b',
  fogInside: [0.12, 0.75] as [number, number],
  /** Screen-space ambient occlusion (contact shading where walls meet the street). */
  /** Studio lights (hemisphere, fill, key) inside the globe, as a share of outside. */
  insideAmbient: 0.22,
  /** Cobbled street colour multiplier (the model's snow reads too white under the lamps). */
  groundTint: '#8f96a6',
  aoRadius: 0.03,
  aoIntensity: 2.2,
};

/** Brass plate on the front of the base (globe-local; y in the base's 0.32-tall design units). */
export const PLAQUE = {
  radius: 0.403,
  height: 0.075,
  /** Arc of the band around the base, radians. */
  arc: 1.15,
  /** Centre height on the base's waist (before the base is scaled to the floor height). */
  y: 0.148,
  /** Time to engrave the result, left to right. */
  engraveSec: 1.6,
};
