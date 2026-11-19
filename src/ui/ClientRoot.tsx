'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { live, useApp } from '@/src/game/store';
import { DebugPanel } from './DebugPanel';
import { HUD, ResultCard, Subtitle } from './GameUI';
import { GlyphPrimer } from './GlyphPrimer';
import { JudgePanel } from './JudgePanel';
import { SpiteFilter } from './spiteFilter';
import { buildShareImage } from '@/src/game/share';
import { captureScene } from '@/src/scene/capture';
import { IntroOverlay } from './IntroOverlay';
import { LoadingScreen } from './LoadingScreen';
import { SoundDirector } from './SoundDirector';
import { useInput } from './useInput';

const Experience = dynamic(() => import('@/src/scene/Experience'), { ssr: false });

export function ClientRoot() {
  const { video, startCamera, startMouse } = useInput();
  // Dev only: drive the head and the game from the console for layout checks.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    Object.assign(window, { __live: live, __app: useApp, __SpiteFilter: SpiteFilter, __buildShareImage: buildShareImage, __captureScene: captureScene });
  }, []);
  return (
    <>
      <GlyphPrimer />
      <Experience />
      <IntroOverlay onCamera={startCamera} onMouse={startMouse} />
      <HUD />
      <Subtitle />
      <JudgePanel video={video} />
      <ResultCard />
      <SoundDirector />
      <DebugPanel video={video} />
      <LoadingScreen />
    </>
  );
}
