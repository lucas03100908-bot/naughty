'use client';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';

/**
 * What only the inside needs (the near shops, the sound clips) waits until the first screen has
 * finished loading, so it doesn't compete with it (CLAUDE.md: first screen in 3 s).
 * "Finished" = the scene has drawn (markSceneShown, called from inside the canvas once everything
 * it suspends on has resolved) and three's loading manager has had nothing in flight for a beat.
 * A timeout lets the rest through even if something on the first screen never settles.
 */
const SETTLE_MS = 600;
const GIVE_UP_MS = 12_000;

let loaded = false;
let shown = false;
let inFlight = 0;
/** Items started and finished so far, for the loading screen's bar. */
let started = 0;
let finished = 0;
let timer = 0;
const listeners = new Set<() => void>();
/** Anything that shows load state (the loading screen): told on every change. */
const watchers = new Set<() => void>();
const notify = () => watchers.forEach((f) => f());

function fire() {
  if (loaded) return;
  loaded = true;
  listeners.forEach((f) => f());
  listeners.clear();
  notify();
}

/** Fire once the scene is up and no load has started for SETTLE_MS. */
function settle() {
  window.clearTimeout(timer);
  if (shown && inFlight === 0) timer = window.setTimeout(fire, SETTLE_MS);
}

if (typeof window !== 'undefined') {
  // three has no public in-flight counter; every loader brackets its request with these two.
  const manager = THREE.DefaultLoadingManager;
  const { itemStart, itemEnd } = manager;
  manager.itemStart = (url) => {
    inFlight++;
    started++;
    window.clearTimeout(timer);
    notify();
    itemStart.call(manager, url);
  };
  manager.itemEnd = (url) => {
    inFlight = Math.max(0, inFlight - 1);
    finished++;
    itemEnd.call(manager, url);
    settle();
    notify();
  };
  window.setTimeout(fire, GIVE_UP_MS);
}

/** Called from inside the canvas once the scene has drawn. */
export function markSceneShown() {
  if (shown) return;
  shown = true;
  settle();
  notify();
}

/** Runs `cb` once the first screen has loaded (at once if it already has). */
export function afterFirstScreen(cb: () => void) {
  if (loaded) cb();
  else listeners.add(cb);
}

const subscribe = (cb: () => void) => {
  if (loaded) return () => {};
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useFirstScreenLoaded() {
  return useSyncExternalStore(subscribe, () => loaded, () => false);
}

const watch = (cb: () => void) => {
  watchers.add(cb);
  return () => watchers.delete(cb);
};

/** True once the scene has drawn its first frames (the globe is on screen). */
export function useSceneShown() {
  return useSyncExternalStore(watch, () => shown, () => false);
}

/** Share of the first screen's files loaded so far, 0..1 (the total grows as loads start). */
export function useLoadProgress() {
  return useSyncExternalStore(watch, () => (started ? finished / started : 0), () => 0);
}
