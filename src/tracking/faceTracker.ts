import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { HEAD, ONE_EURO_ANGLE, ONE_EURO_POSITION, SCREEN, TRACKING, WEBCAM } from '@/src/game/constants';
import { emitShake, live } from '@/src/game/store';
import { OneEuroFilter } from './oneEuro';
import { ShakeDetector } from './gestures';
import { readBlendshapes } from './expression';

// Iris centres from the 478-point mesh. 468 = subject's right eye, 473 = subject's left eye.
const IRIS_A = 468;
const IRIS_B = 473;
const DEG = 180 / Math.PI;

export interface FaceTracker {
  video: HTMLVideoElement;
  stop: () => void;
}

/**
 * Starts the webcam and Face Landmarker. All processing stays in the browser; frames are
 * never uploaded or stored. Results are written into `live`.
 */
/**
 * MediaPipe's wasm prints informational lines (e.g. "INFO: Created TensorFlow Lite XNNPACK
 * delegate for CPU.") through console.error, which the Next.js dev overlay reports as errors.
 * Drop exactly those lines; every other console.error passes through untouched.
 */
let consoleFiltered = false;
function filterMediaPipeInfoLogs() {
  if (consoleFiltered) return;
  consoleFiltered = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && /^(INFO|W\d{4}|I\d{4}).*(TensorFlow Lite|XNNPACK|delegate|gl_context|landmark_projection)/.test(first)) return;
    if (typeof first === 'string' && first.startsWith('INFO: ')) return;
    original(...args);
  };
}

export async function startFaceTracker(): Promise<FaceTracker> {
  filterMediaPipeInfoLogs();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: WEBCAM.width, height: WEBCAM.height, facingMode: 'user' },
    audio: false,
  });

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  // Debug preview styling: mirrored so it reads like a mirror.
  video.style.cssText = 'width:100%;display:block;border-radius:6px;transform:scaleX(-1)';
  await video.play();

  const fileset = await FilesetResolver.forVisionTasks('/mediapipe');
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });

  const fx = new OneEuroFilter(ONE_EURO_POSITION);
  const fy = new OneEuroFilter(ONE_EURO_POSITION);
  const fz = new OneEuroFilter(ONE_EURO_POSITION);
  const fRoll = new OneEuroFilter(ONE_EURO_ANGLE);
  const fYaw = new OneEuroFilter(ONE_EURO_ANGLE);
  const shake = new ShakeDetector();

  const tanH = Math.tan((WEBCAM.hfovDeg / DEG) / 2);
  const interval = 1000 / TRACKING.fps;
  let lastRun = 0;
  let lastSeen = 0;
  let frames = 0;
  let fpsWindowStart = performance.now();
  let raf = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    if (now - lastRun < interval - 2 || video.readyState < 2) return;
    lastRun = now;

    const result = landmarker.detectForVideo(video, now);
    frames++;
    if (now - fpsWindowStart >= 1000) {
      live.trackFps = (frames * 1000) / (now - fpsWindowStart);
      frames = 0;
      fpsWindowStart = now;
    }

    const lm = result.faceLandmarks?.[0];
    if (!lm) {
      if (now - lastSeen > TRACKING.lostAfterSec * 1000) live.faceDetected = false;
      return;
    }
    lastSeen = now;
    live.faceDetected = true;

    const vw = video.videoWidth || WEBCAM.width;
    const vh = video.videoHeight || WEBCAM.height;
    const a = lm[IRIS_A];
    const b = lm[IRIS_B];

    // Distance from apparent eye spacing (pinhole model).
    const dxPx = (b.x - a.x) * vw;
    const dyPx = (b.y - a.y) * vh;
    const eyeDistNorm = Math.hypot(dxPx, dyPx) / vw;
    const zCm = clamp(HEAD.ipdCm / (eyeDistNorm * 2 * tanH), HEAD.minDistanceCm, HEAD.maxDistanceCm);

    // Eye midpoint → cm in front of the camera. The image is not mirrored, so moving to your
    // right moves you toward image-left.
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const halfW = zCm * tanH;
    const halfH = zCm * tanH * (vh / vw);
    const xCm = (0.5 - mx) * 2 * halfW;
    const yCm = (0.5 - my) * 2 * halfH + SCREEN.heightCm / 2 + WEBCAM.aboveScreenCm;

    // Roll: angle of the eye line in the image. Image-left eye minus image-right eye so a level
    // head is 0 regardless of landmark order; positive = tilt toward the viewer's right.
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    const rollDeg = -Math.atan2((r.y - l.y) * vh, (r.x - l.x) * vw) * DEG;

    // Yaw from the facial transformation matrix (column-major 4×4).
    const m = result.facialTransformationMatrixes?.[0]?.data;
    const yawDeg = m ? Math.atan2(m[8], m[10]) * DEG : live.yawDeg;

    const t = now / 1000;
    // Tilting the head toward a shoulder swings the eyes around the neck. That is a gesture for
    // the snow, not a change of viewpoint, so take the swing back out of the head position.
    const rollRad = rollDeg / DEG;
    const viewX = xCm - HEAD.rollPivotCm * Math.sin(rollRad);
    const viewY = yCm + HEAD.rollPivotCm * (1 - Math.cos(rollRad));
    live.head.x = fx.filter(viewX, t);
    live.head.y = fy.filter(viewY, t);
    live.head.z = fz.filter(zCm, t);
    live.rollDeg = fRoll.filter(rollDeg, t);
    live.yawDeg = fYaw.filter(yawDeg, t);
    // Tilting is tracked (and shown in the debug panel) but no longer moves the snow.
    live.flow = 0;
    readBlendshapes(result.faceBlendshapes?.[0], live.blend);
    for (let i = 0; i < Math.min(lm.length, 478); i++) {
      live.landmarks[i * 2] = lm[i].x;
      live.landmarks[i * 2 + 1] = lm[i].y;
    }
    live.landmarksAt = now;

    // Shake runs on unfiltered yaw: the filter would eat the quick reversals.
    if (shake.update(now, yawDeg)) emitShake('camera');
  };
  raf = requestAnimationFrame(tick);

  return {
    video,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      landmarker.close();
      stream.getTracks().forEach((tr) => tr.stop());
    },
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
