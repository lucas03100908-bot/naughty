'use client';
import { useGLTF } from '@react-three/drei';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useFirstScreenLoaded } from '@/src/game/firstScreen';
import { useApp } from '@/src/game/store';
import { requestWarmup } from '@/src/scene/warmup';

/**
 * Two levels of detail for the props inside the globe. The first screen loads the light versions
 * (from outside each prop is a few dozen pixels tall); the full ones are fetched once that screen
 * has loaded, and swapped in while nobody is playing (the swap rebuilds the prop, so a prank in
 * progress would be lost). If someone dives in before they arrive, the light ones stay a round.
 */
const ready = new Set<string>();
const watchers = new Set<() => void>();
const watch = (cb: () => void) => {
  watchers.add(cb);
  return () => watchers.delete(cb);
};

/** Suspends on the full models; mounted (in its own Suspense) once the first screen has loaded. */
function Fetch({ urls }: { urls: string[] }) {
  for (const u of urls) useGLTF(u); // eslint-disable-line react-hooks/rules-of-hooks -- fixed list
  useEffect(() => {
    for (const u of urls) ready.add(u);
    watchers.forEach((f) => f());
  }, [urls]);
  return null;
}

export function FetchFullDetail({ urls }: { urls: string[] }) {
  const go = useFirstScreenLoaded();
  return go ? <Fetch urls={urls} /> : null;
}

/** The url to draw: `far` until `near` has loaded and it is safe to swap, then `near` for good. */
export function useDetailUrl(near: string, far: string) {
  const loaded = useSyncExternalStore(watch, () => ready.has(near), () => false);
  const safe = useApp((s) => s.phase === 'intro' || s.phase === 'start');
  // Sticky: once swapped it never goes back (adjusting state while rendering, React's pattern).
  const [swapped, setSwapped] = useState(false);
  if (!swapped && loaded && safe) setSwapped(true);
  const url = swapped ? near : far;
  useEffect(() => {
    if (url === near) requestWarmup();
  }, [url, near]);
  return url;
}
