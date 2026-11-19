'use client';
import { useEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useApp } from '@/src/game/store';

/**
 * Pointer handlers for a prank target: hand cursor while hovering during play, and a click that
 * only counts during play. Clicks pass through the glass (the glass has no handlers).
 * `onHover` hears hover start/end (during play only), so a target can react: giggle, glow, chime.
 */
export function usePrankTarget(onPrank: () => void, enabled = true, onHover?: (on: boolean) => void) {
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
      if (!hovering.current) onHover?.(true);
      hovering.current = true;
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      if (!hovering.current) return;
      hovering.current = false;
      document.body.style.cursor = '';
      onHover?.(false);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!active()) return;
      e.stopPropagation();
      if (hovering.current) onHover?.(false);
      hovering.current = false;
      document.body.style.cursor = '';
      onPrank();
    },
  };
}
