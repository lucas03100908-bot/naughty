'use client';
import { useEffect, useState } from 'react';
import { useLoadProgress, useSceneShown } from '@/src/game/firstScreen';
import styles from './ui.module.css';

/** How long the screen takes to dissolve into the globe once it is up. */
const FADE_MS = 900;

/**
 * Covers the first seconds while the globe's models and sky load, then dissolves into the scene.
 * Humbug is on his way: the line is his entrance, the thin bar is the honest part.
 */
export function LoadingScreen() {
  const shown = useSceneShown();
  const progress = useLoadProgress();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(t);
  }, [shown]);

  if (gone) return null;
  return (
    <div className={`${styles.loading} ${shown ? styles.loadingDone : ''}`} style={{ transitionDuration: `${FADE_MS}ms` }} role="status" aria-live="polite">
      <p className={styles.loadingLine}>그가 오고있어</p>
      <div className={styles.loadingBar} aria-hidden>
        <span style={{ transform: `scaleX(${shown ? 1 : Math.max(0.04, progress)})` }} />
      </div>
    </div>
  );
}
