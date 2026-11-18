'use client';
import { useEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useApp } from '@/src/game/store';

/**
 * Pointer handlers for a prank target: hand cursor while hovering during play, and a click that
 * only counts during play. Clicks pass through the glass (the glass has no handlers).
 */
export function usePrankTarget(onPrank: () => void, enabled = true) {
  const hovering = useRef(false);
  useEffect(
    () => () => {
      if (hovering.current) document.body.style.cursor = '';
    },
    [],
  );
  const active = () => enabled && useApp.getState().phase === 'play';
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (!active()) return;
      e.stopPropagation();
      hovering.current = true;
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      if (!hovering.current) return;
      hovering.current = false;
      document.body.style.cursor = '';
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!active()) return;
      e.stopPropagation();
      hovering.current = false;
      document.body.style.cursor = '';
      onPrank();
    },
  };
}
