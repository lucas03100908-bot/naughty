import { HEAD, MOUSE } from '@/src/game/constants';
import { emitShake, live } from '@/src/game/store';
import { rollToFlow, ShakeDetector } from './gestures';

/**
 * Camera-free fallback.
 * - Mouse position → viewpoint (head x/y), distance fixed at nominal.
 * - Hold Shift and move left/right → roll (tilt). The viewpoint freezes while Shift is held.
 * - Shake the mouse quickly left-right → shake (same detector as the head, fed a pseudo-yaw).
 */
export function startMouseInput() {
  const shake = new ShakeDetector();
  let nx = 0;
  let ny = 0;
  let shift = false;

  live.head.z = HEAD.nominalDistanceCm;
  live.faceDetected = false;

  const onMove = (e: PointerEvent) => {
    nx = (e.clientX / window.innerWidth) * 2 - 1;
    ny = (e.clientY / window.innerHeight) * 2 - 1;
    if (shift || e.shiftKey) {
      live.rollDeg = nx * MOUSE.rollMaxDeg;
    } else {
      live.head.x = nx * MOUSE.rangeXCm;
      live.head.y = -ny * MOUSE.rangeYCm;
    }
    live.yawDeg = nx * MOUSE.shakeYawScaleDeg;
    live.flow = rollToFlow(live.rollDeg);
    if (shake.update(performance.now(), live.yawDeg)) emitShake('mouse');
  };
  const onKey = (e: KeyboardEvent) => {
    shift = e.shiftKey;
    if (!shift && e.type === 'keyup') {
      live.rollDeg = 0;
      live.flow = 0;
    }
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  };
}
