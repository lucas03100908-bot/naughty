'use client';
import { useEffect, useState } from 'react';
import { sound } from '@/src/audio/sound';
import { live, useApp } from '@/src/game/store';
import styles from './ui.module.css';

const MUTE_KEY = 'naughty-list:muted';

/**
 * Drives the synthesized sound from the game state: the music box plays in the intro, during
 * play and through the judge (the dive video brings its own sound), pranks get their effects, the
 * result gets a fanfare, and a shake in the intro shimmers. Also the mute button.
 */
export function SoundDirector() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // storage blocked: start unmuted
    }
    sound.setMuted(saved);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a per-viewer preference once on mount
    setMuted(saved);

    const unlock = () => {
      sound.unlock();
      apply(useApp.getState().phase);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const apply = (phase: string) => {
      if (phase === 'start') sound.setMusic(false);
      else if (phase === 'judge') sound.setMusic(true, 0.55);
      else sound.setMusic(true);
    };

    let prev = useApp.getState();
    const unsub = useApp.subscribe((s) => {
      if (s.phase !== prev.phase) {
        apply(s.phase);
        if (s.phase === 'reward') sound.fanfare();
      }
      if (s.pranks.length > prev.pranks.length) sound.prankDone(s.pranks[s.pranks.length - 1].id);
      prev = s;
    });

    let lastShake = live.lastShakeAt;
    const poll = setInterval(() => {
      if (live.lastShakeAt !== lastShake) {
        lastShake = live.lastShakeAt;
        if (useApp.getState().phase === 'intro') sound.shimmer();
      }
    }, 100);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      unsub();
      clearInterval(poll);
    };
  }, []);

  const toggle = () => {
    const m = !muted;
    setMuted(m);
    sound.unlock();
    sound.setMuted(m);
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // storage blocked: the choice lasts this visit only
    }
  };

  return (
    <button className={styles.muteToggle} onClick={toggle} aria-label={muted ? '소리 켜기' : '소리 끄기'} aria-pressed={muted}>
      {muted ? '소리 꺼짐' : '소리 켜짐'}
    </button>
  );
}
