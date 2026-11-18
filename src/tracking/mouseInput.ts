import { HEAD, MOUSE } from '@/src/game/constants';
import { emitShake, live } from '@/src/game/store';
import { ShakeDetector } from './gestures';

/**
 * Camera-free fallback.
 * - Mouse position → viewpoint (head x/y), distance fixed at nominal.
 * - Shake the mouse quickly left-right → shake (same detector as the head, fed a pseudo-yaw).
 * (Tilting no longer moves the snow, so there is no tilt input.)
 */
export function startMouseInput() {
  const shake = new ShakeDetector();

  live.head.z = HEAD.nominalDistanceCm;
  live.faceDetected = false;
  live.rollDeg = 0;
  live.flow = 0;

  const onMove = (e: PointerEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    // Inside the globe the cursor also aims at pranks, so it can steer the view less.
    const k = 1 - (1 - MOUSE.insideViewScale) * live.viewBlend;
    live.head.x = nx * MOUSE.rangeXCm * k;
    live.head.y = -ny * MOUSE.rangeYCm * k;
    live.yawDeg = nx * MOUSE.shakeYawScaleDeg;
    if (shake.update(performance.now(), live.yawDeg)) emitShake('mouse');
  };

  window.addEventListener('pointermove', onMove);
  return () => {
    window.removeEventListener('pointermove', onMove);
  };
}
