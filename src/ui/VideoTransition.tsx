'use client';
import { useEffect, useRef, useState } from 'react';
import { PLAY, VIDEO, VIEW } from '@/src/game/constants';
import { useApp } from '@/src/game/store';
import styles from './ui.module.css';

/**
 * The dive-in transition: a full-screen video played over the scene during `start`.
 * Fades in over the 3D globe, plays to the end, fades out onto the 3D street, then starts play.
 * The element is mounted (and preloading) from the first screen so it starts without a stall.
 * If it can't play, the real-time 3D dive runs instead.
 */
export function VideoTransition() {
  const phase = useApp((s) => s.phase);
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'hidden' | 'in' | 'out'>('hidden');

  useEffect(() => {
    const v = video.current;
    if (!v || phase !== 'start') return;
    let done = false;
    const timers: number[] = [];
    const finish = () => {
      if (done) return;
      done = true;
      setState('out');
      timers.push(window.setTimeout(() => {
        useApp.getState().enterPlay();
        setState('hidden');
      }, VIDEO.fadeOutSec * 1000));
    };
    const fallback = () => {
      if (done) return;
      done = true;
      setState('hidden');
      useApp.getState().fallbackDive();
      timers.push(window.setTimeout(() => useApp.getState().enterPlay(), Math.max(VIEW.diveSec, PLAY.startLineSec) * 1000));
    };
    v.currentTime = 0;
    v.volume = VIDEO.volume;
    v.muted = false;
    setState('in');
    v.play().catch(() => {
      // Sound blocked? Try muted before giving up on the video.
      v.muted = true;
      v.play().catch(fallback);
    });
    // Start fading out a little before the last frame so the fade ends on it.
    const onTime = () => {
      if (v.duration && v.currentTime >= v.duration - VIDEO.fadeOutSec) finish();
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', finish);
    v.addEventListener('error', fallback);
    timers.push(window.setTimeout(finish, VIDEO.maxSec * 1000 - VIDEO.fadeOutSec * 1000));
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', finish);
      v.removeEventListener('error', fallback);
      timers.forEach(clearTimeout);
    };
  }, [phase]);

  return (
    <video
      ref={video}
      className={`${styles.transition} ${state === 'in' ? styles.transitionIn : ''}`}
      style={{ transitionDuration: `${(state === 'out' ? VIDEO.fadeOutSec : VIDEO.fadeInSec) * 1000}ms` }}
      src={VIDEO.src}
      preload="auto"
      playsInline
      aria-hidden
    />
  );
}
