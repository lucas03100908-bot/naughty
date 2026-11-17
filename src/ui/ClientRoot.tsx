'use client';
import dynamic from 'next/dynamic';
import { DebugPanel } from './DebugPanel';
import { IntroOverlay } from './IntroOverlay';
import { useInput } from './useInput';

const Experience = dynamic(() => import('@/src/scene/Experience'), { ssr: false });

export function ClientRoot() {
  const { video, startCamera, startMouse } = useInput();
  return (
    <>
      <Experience />
      <IntroOverlay onCamera={startCamera} onMouse={startMouse} />
      <DebugPanel video={video} />
    </>
  );
}
