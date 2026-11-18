'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { live, useApp } from '@/src/game/store';
import { DebugPanel } from './DebugPanel';
import { HUD, ResultCard, Subtitle } from './GameUI';
import { JudgePanel } from './JudgePanel';
import { VideoTransition } from './VideoTransition';
import { SpiteFilter } from './spiteFilter';
import { IntroOverlay } from './IntroOverlay';
import { useInput } from './useInput';

const Experience = dynamic(() => import('@/src/scene/Experience'), { ssr: false });

export function ClientRoot() {
  const { video, startCamera, startMouse } = useInput();
  // Dev only: drive the head and the game from the console for layout checks.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    Object.assign(window, { __live: live, __app: useApp, __SpiteFilter: SpiteFilter });
  }, []);
  return (
    <>
      <Experience />
      <VideoTransition />
      <IntroOverlay onCamera={startCamera} onMouse={startMouse} />
      <HUD />
      <Subtitle />
      <JudgePanel video={video} />
      <ResultCard />
      <DebugPanel video={video} />
    </>
  );
}
