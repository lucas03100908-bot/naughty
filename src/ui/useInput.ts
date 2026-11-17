'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/src/game/store';
import { startFaceTracker, type FaceTracker } from '@/src/tracking/faceTracker';
import { startMouseInput } from '@/src/tracking/mouseInput';

/** Owns the active input source. Camera denied or failing → falls back to the mouse. */
export function useInput() {
  const tracker = useRef<FaceTracker | null>(null);
  const stopMouse = useRef<(() => void) | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const { setMode, setStatus, pushEvent } = useApp.getState();

  const startMouse = useCallback(() => {
    tracker.current?.stop();
    tracker.current = null;
    setVideo(null);
    stopMouse.current?.();
    stopMouse.current = startMouseInput();
    setMode('mouse');
    pushEvent('마우스 대체 입력 사용');
  }, [setMode, pushEvent]);

  const startCamera = useCallback(async () => {
    setStatus('loading');
    try {
      const t = await startFaceTracker();
      stopMouse.current?.();
      stopMouse.current = null;
      tracker.current = t;
      setVideo(t.video);
      setMode('camera');
      setStatus('running');
      pushEvent('헤드 트래킹 시작');
    } catch (err) {
      const e = err as DOMException;
      const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError';
      setStatus(denied ? 'denied' : 'error', denied ? '카메라 권한이 거절됐어요' : `카메라를 열 수 없어요: ${e?.message ?? e}`);
      startMouse();
    }
  }, [setMode, setStatus, pushEvent, startMouse]);

  useEffect(
    () => () => {
      tracker.current?.stop();
      stopMouse.current?.();
    },
    [],
  );

  return { video, startCamera, startMouse };
}
