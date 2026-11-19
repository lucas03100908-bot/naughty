/**
 * Lets the UI grab a still of the 3D scene (for the share image) without reaching into the
 * canvas itself. The scene registers a capture function; the UI calls captureScene().
 */
export interface SceneShot {
  /** JPEG data URL of the canvas. */
  url: string;
  /** Where the globe (glass top to base bottom) sits in the frame, 0–1 of width/height. */
  globe: { cx: number; top: number; bottom: number };
}

let capture: (() => SceneShot | null) | null = null;

export function setSceneCapture(fn: (() => SceneShot | null) | null) {
  capture = fn;
}

export function captureScene() {
  return capture ? capture() : null;
}
