/**
 * The village plan, in one place. Globe-local units, y = 0 on the floor, the viewer enters from
 * +z and looks toward −z. The floor is a disc of radius 0.368.
 *
 *            back shop (faces the lane)
 *      tree ·  [ village tree + switch ]  · tree
 *   ┌──────┐        ( square )        ┌──────┐
 *   │ shop │      snowman ·           │ shop │
 *   │  A   │   ║   cobbled lane   ║   ├──────┤
 *   └──────┘   ║                  ║   │ shop │
 *          lamp ·                · lamp
 *                    (viewer)
 *
 * Footprints come from each model's bounding box × its scale, and nothing overlaps:
 * `npm run dev` → console `__checkLayout()` lists any intersecting props.
 * Every model faces +z at rotation 0.
 */
type Vec3 = [number, number, number];

export interface Placement {
  position: Vec3;
  rotationY: number;
  scale: number;
  /** Multiplies the model's colours (variety between repeats of the same shop). */
  tint?: string;
  /** Mirror left-right (another way to stop repeats reading as copies). */
  mirror?: boolean;
}


/**
 * The cobbled street (ground.glb): a curving, gently rising street piece with raised pavements,
 * running from the viewer (+z) back and to the right. Scaled to fill the floor and clipped to the
 * glass in the shader.
 */
export const GROUND = {
  position: [0, 0, 0] as Vec3,
  rotationY: 0,
  scale: 0.46,
  /** Anything of the ground beyond this radius from the globe axis is not drawn. */
  clipRadius: 0.366,
};

/**
 * Footprint radius of each model at scale 1 (about half its base). Props are lifted to the highest
 * street point inside this radius (groundSample.ts) so their bases sit on the cobbles.
 */
export const FOOTPRINT = {
  shopA: 0.42,
  shopB: 0.3,
  lamp: 0.2,
  christmasTree: 0.25,
  snowman: 0.25,
  pine: 0.27,
};

export const LAYOUT = {
  /**
   * Shops lining the curved street, both sides, shoulder to shoulder, fronts turned to the street
   * (the reference: a winding lane of tall shopfronts closing in toward a house at the far end).
   * The street enters at the front centre and bends back and to the right.
   */
  shops: [
    // Left side, front → back: fronts turned to the street, shoulder to shoulder.
    { url: 'shopB', position: [-0.2, 0, 0.14], rotationY: 1.5, scale: 0.28, tint: '#ffd7b0' },
    { url: 'shopA', position: [-0.215, 0, -0.075], rotationY: 1.4, scale: 0.23 },
    { url: 'shopB', position: [-0.04, 0, -0.26], rotationY: 0.45, scale: 0.2, tint: '#c9e3cf', mirror: true },
    // Far end: the street bends into it.
    { url: 'shopB', position: [0.125, 0, -0.26], rotationY: -0.5, scale: 0.19, tint: '#d8d2ef' },
    // Right side, back → front.
    { url: 'shopB', position: [0.225, 0, -0.1], rotationY: -1.3, scale: 0.26, tint: '#bfd4ee' },
    { url: 'shopA', position: [0.2, 0, 0.106], rotationY: -1.6, scale: 0.24, tint: '#ffc9a6', mirror: true },
    // Back corners: smaller houses fill the gaps between the rows and the far end.
    { url: 'shopB', position: [-0.175, 0, -0.245], rotationY: 0.75, scale: 0.15, tint: '#f0c9a8' },
    { url: 'shopB', position: [0.245, 0, -0.232], rotationY: -0.85, scale: 0.13, tint: '#c7d9c0', mirror: true },
  ] as (Placement & { url: 'shopA' | 'shopB' })[],

  /** Extra height for the lamps on top of the street lift (their bases read as sunk otherwise). */
  lampRaise: 0.003,
  /** Lamps along the street; the left one is the prank lamp. */
  lampLeft: { position: [-0.085, 0, 0.03], rotationY: 0.2, scale: 0.12 } as Placement,
  lampRight: { position: [0.12, 0, -0.16], rotationY: Math.PI - 0.4, scale: 0.12 } as Placement,
  /** Smaller lamps further along the street, for depth (no shadows, softer light). */
  lampsSmall: [
    { position: [-0.1, 0, -0.06], rotationY: 0.5, scale: 0.085 },
    { position: [0.135, 0, -0.06], rotationY: Math.PI - 0.3, scale: 0.085 },
    { position: [0.05, 0, -0.215], rotationY: 0.2, scale: 0.075 },
  ] as Placement[],

  /** The village tree where the street widens at the back; its star is the prank target. */
  villageTree: { position: [0, 0, -0.098], rotationY: 0, scale: 0.29 } as Placement,
  /** Snowman at the right edge of the street. */
  snowman: { position: [0.085, 0, 0.015], rotationY: -0.5, scale: 0.045 } as Placement,

  /** Small snowy pines (dio_pine.glb) tucked into the gaps between the houses. */
  cornerTrees: [
    { position: [-0.26, 0, -0.235], rotationY: 0.4, scale: 0.1 },
    { position: [0.0435, 0, -0.31], rotationY: 2.6, scale: 0.07 },
  ] as Placement[],
};
