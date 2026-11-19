/**
 * Where things stand on the diorama's table, shared by the terrain (which levels a pad under each
 * one) and the scenery (which places them). Table units, +z toward the viewer.
 */
export type PropName = 'chalet' | 'rental' | 'houseA' | 'houseB' | 'signpost' | 'logs' | 'fence' | 'bridge' | 'rock' | 'snowPile';

/** The models standing on the table: [model, x, z, height, rotY, keep-clear radius]. */
export const PROPS: [PropName, number, number, number, number, number][] = [
  ['chalet', -0.64, -0.68, 0.14, 0.5, 0.13],
  ['rental', 0.55, -0.84, 0.085, -0.45, 0.09],
  ['houseA', -0.98, -1.2, 0.1, 0.75, 0.1],
  ['houseB', 1.02, -1.22, 0.1, -0.7, 0.1],
  ['signpost', 0.45, -0.74, 0.05, -0.3, 0.03],
  ['logs', -0.5, -0.6, 0.022, 0.2, 0.03],
  ['fence', -0.72, -0.55, 0.024, 0.5, 0.04],
  ['bridge', -0.3, -0.66, 0.03, 0.15, 0.06],
  ['rock', 0.74, -0.52, 0.05, 0.9, 0.05],
  ['rock', -0.86, -0.58, 0.045, -0.6, 0.05],
  ['snowPile', -0.22, -0.82, 0.022, 0.4, 0.04],
  ['snowPile', 0.28, -0.72, 0.02, 1.7, 0.04],
  ['snowPile', 0.7, -0.14, 0.018, 2.6, 0.03],
];

/** Where the train goes into a hill, as angles round its loop (from DIORAMA.tunnels). */
export const TUNNEL_PAD = 0.17;
