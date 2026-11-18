'use client';
import { useEffect, useRef, useState } from 'react';
import { FILTER, JUDGE, VIEW } from '@/src/game/constants';
import { live, useApp } from '@/src/game/store';
import { SpiteFilter } from './spiteFilter';
import styles from './ui.module.css';

/**
 * 심술 심사 panel, beside the globe once the camera has pulled out: the viewer's own face
 * (mirrored, with the 심술 필터), frosted and trimmed for Christmas; a stage icon, the spite
 * meter and the countdown. In mouse mode the face is replaced by a hold-to-spite button.
 */
export function JudgePanel({ video }: { video: HTMLVideoElement | null }) {
  const phase = useApp((s) => s.phase);
  const stage = useApp((s) => s.judgeStage);
  const mode = useApp((s) => s.mode);
  if (phase !== 'judge' || stage === 'pull') return null;
  return (
    <aside className={styles.judge}>
      <div className={styles.judgeFrame}>
        {mode === 'camera' && video ? <FilteredFace video={video} /> : <HoldToSpite active={stage === 'grin'} />}
        <div className={styles.frost} />
        <Holly className={styles.hollyTL} />
        <Holly className={styles.hollyBR} />
      </div>
      <JudgeStatus />
    </aside>
  );
}

function FilteredFace({ video }: { video: HTMLVideoElement }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [supported] = useState(() => !!document.createElement('canvas').getContext('webgl'));
  useEffect(() => {
    const el = canvas.current;
    if (!el || !supported) return;
    let filter: SpiteFilter;
    try {
      filter = new SpiteFilter(el);
    } catch {
      return;
    }
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (video.readyState < 2) return;
      const fresh = performance.now() - live.landmarksAt < 500;
      const strength = live.filterOverride ?? FILTER.minStrength + (1 - FILTER.minStrength) * live.spite;
      filter.render(video, live.landmarks, live.faceDetected && fresh, strength);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      filter.dispose();
    };
  }, [video, supported]);
  if (!supported) return <p className={styles.judgeFallback}>이 브라우저에서는 필터를 그릴 수 없어요.</p>;
  return <canvas ref={canvas} className={styles.face} aria-label="심술 필터를 씌운 내 얼굴" />;
}

/** Mouse fallback: hold the button (or Space) and spite climbs. */
function HoldToSpite({ active }: { active: boolean }) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        live.holdingSpite = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') live.holdingSpite = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      live.holdingSpite = false;
    };
  }, []);
  return (
    <button
      className={styles.holdButton}
      disabled={!active}
      onPointerDown={() => (live.holdingSpite = true)}
      onPointerUp={() => (live.holdingSpite = false)}
      onPointerLeave={() => (live.holdingSpite = false)}
    >
      {active ? '꾹 눌러 심술 부리기' : '잠깐만…'}
      <small>스페이스를 눌러도 돼요</small>
    </button>
  );
}

function JudgeStatus() {
  const stage = useApp((s) => s.judgeStage);
  const mode = useApp((s) => s.mode);
  const phaseAt = useApp((s) => s.phaseAt);
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);
  // Reading the clock during render is fine here: the interval re-renders us 10×/s anyway.
  // eslint-disable-next-line react-hooks/purity
  const since = (performance.now() - phaseAt) / 1000 - VIEW.pullSec;
  const left = stage === 'baseline' ? JUDGE.baselineSec - since : stage === 'grin' ? JUDGE.baselineSec + JUDGE.grinSec - since : 0;
  const pct = Math.round(live.spite * 100);
  const hot = live.spite >= JUDGE.threshold;
  return (
    <div className={styles.judgeStatus}>
      <div className={styles.judgeStage}>
        {stage === 'baseline' ? <FaceIcon kind="neutral" /> : <FaceIcon kind="spite" />}
        <span>{stage === 'baseline' ? '평소 얼굴' : stage === 'grin' ? '심술 미소' : '판정 중'}</span>
        {left > 0 && <span className={styles.judgeTime}>{Math.ceil(left)}</span>}
      </div>
      <div className={styles.meter} aria-label={`심술도 ${pct}%`}>
        <i className={styles.meterThreshold} style={{ left: `${JUDGE.threshold * 100}%` }} />
        <i className={`${styles.meterFill} ${hot ? styles.meterHot : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.meterLabel}>
        <span>심술도</span>
        <span className={styles.num}>{pct}</span>
      </div>
      {mode === 'camera' && stage !== 'baseline' && <ChannelBars />}
      {mode === 'camera' && !live.faceDetected && <p className={styles.judgeWarn}>얼굴이 안 보여요. 카메라 정면을 봐 주세요.</p>}
    </div>
  );
}

/** What the camera is reading right now, so the viewer can see which part to push. */
function ChannelBars() {
  const p = live.spiteParts;
  const rows: [string, number][] = [
    ['미소', p?.smile ?? 0],
    ['찡그림', p?.brow ?? 0],
    ['실눈', p?.squint ?? 0],
  ];
  return (
    <div className={styles.channels}>
      {rows.map(([label, v]) => (
        <div key={label} className={styles.channel}>
          <span>{label}</span>
          <span className={styles.channelBar}>
            <i style={{ width: `${Math.round(v * 100)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Tiny line-drawn signs for the two stages (not a face to copy). */
function FaceIcon({ kind }: { kind: 'neutral' | 'spite' }) {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
      {kind === 'neutral' ? (
        <>
          <circle cx="11.5" cy="13" r="1.6" fill="currentColor" />
          <circle cx="20.5" cy="13" r="1.6" fill="currentColor" />
          <path d="M11 21h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M8 10l6 2.5M24 10l-6 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 14.5h3M19 14.5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M7.5 18c3 5.5 14 5.5 17 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function Holly({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 40" aria-hidden>
      <path d="M32 22C24 8 10 6 2 10c6 2 6 8 2 10 6 0 8 6 6 9 8-4 16-3 22-7z" fill="#1f5a34" />
      <path d="M32 22C40 8 54 6 62 10c-6 2-6 8-2 10-6 0-8 6-6 9-8-4-16-3-22-7z" fill="#24683c" />
      <circle cx="28" cy="24" r="4.2" fill="#c8202a" />
      <circle cx="36" cy="24" r="4.2" fill="#d42a2f" />
      <circle cx="32" cy="18.5" r="4.2" fill="#b81a24" />
    </svg>
  );
}
