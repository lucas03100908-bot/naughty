'use client';
import { useEffect, useState } from 'react';
import { PLAY } from '@/src/game/constants';
import { PRANK_LABEL, prankRecordText, type PrankId } from '@/src/game/scoring';
import { totalPrankPoints, useApp } from '@/src/game/store';
import { titleFor } from '@/src/tracking/expression';
import styles from './ui.module.css';

const ORDER: PrankId[] = ['snowman', 'lamp', 'tree'];

/** Current time, refreshed on a timer while mounted (for the countdown). */
function useNow(ms: number) {
  const [now, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set(performance.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Humbug speaks only in subtitles (and later, voice). */
export function Subtitle() {
  const phase = useApp((s) => s.phase);
  const stage = useApp((s) => s.judgeStage);
  const mode = useApp((s) => s.mode);
  const line =
    phase === 'start'
      ? '60초 안에 이 마을 크리스마스를 망쳐.'
      : phase === 'judge'
        ? stage === 'pull'
          ? '좋아, 이제 네 심술을 보자.'
          : stage === 'baseline'
            ? mode === 'camera'
              ? '평소 얼굴로 가만히 있어 봐.'
              : '준비해.'
            : stage === 'grin'
              ? mode === 'camera'
                ? '이제 웃으면서 찡그려. 최대한 심술궂게!'
                : '버튼을 꾹 눌러서 심술을 부려!'
              : '흠… 어디 보자.'
        : null;
  if (!line) return null;
  return (
    <p className={styles.subtitle} key={line}>
      <span className={styles.speaker}>험벅</span> {line}
    </p>
  );
}

/** Timer, score and prank checklist during start/play. */
export function HUD() {
  const phase = useApp((s) => s.phase);
  const pranks = useApp((s) => s.pranks);
  const playStartAt = useApp((s) => s.playStartAt);
  const now = useNow(200);
  if (phase !== 'start' && phase !== 'play') return null;

  const left = phase === 'play' ? Math.max(0, Math.min(PLAY.durationSec, PLAY.durationSec - (now - playStartAt) / 1000)) : PLAY.durationSec;
  const done = new Set(pranks.map((p) => p.id));
  return (
    <div className={styles.hud}>
      <div className={styles.hudBlock}>
        <span className={styles.hudLabel}>남은 시간</span>
        <span className={`${styles.hudValue} ${left <= 10 ? styles.hudWarn : ''}`}>{Math.ceil(left)}</span>
      </div>
      <ul className={styles.checklist}>
        {ORDER.map((id) => (
          <li key={id} className={done.has(id) ? styles.done : ''}>
            {PRANK_LABEL[id]}
          </li>
        ))}
      </ul>
      <div className={styles.hudBlock}>
        <span className={styles.hudLabel}>점수</span>
        <span className={styles.hudValue}>{totalPrankPoints(pranks)}</span>
      </div>
    </div>
  );
}

/** Result card. (The engraved plaque on the base comes later in M3; this card holds the same data.) */
export function ResultCard() {
  const phase = useApp((s) => s.phase);
  const pranks = useApp((s) => s.pranks);
  const judge = useApp((s) => s.judgeResult);
  const restart = useApp((s) => s.restart);
  if (phase !== 'reward') return null;
  const prankTotal = totalPrankPoints(pranks);
  const spite = judge?.points ?? 0;
  const total = prankTotal + spite;
  return (
    <div className={styles.card}>
      <p className={styles.kicker}>험벅의 성적표</p>
      <p className={styles.cardTitle}>{titleFor(total)}</p>
      <p className={styles.cardScore}>{total}점</p>
      <ul className={styles.cardRows}>
        <li>
          <span>장난 점수</span>
          <span className={styles.num}>{prankTotal}</span>
        </li>
        <li>
          <span>심술 점수</span>
          <span className={styles.num}>{spite}</span>
        </li>
      </ul>
      <ul className={styles.records}>
        {ORDER.map((id) => {
          const r = pranks.find((p) => p.id === id);
          return (
            <li key={id}>
              <span>{r ? prankRecordText(id, r.elapsedSec) : `${PRANK_LABEL[id]}: 못 함`}</span>
              <span className={styles.num}>{r ? `+${r.points}` : '0'}</span>
            </li>
          );
        })}
        {judge && (
          <li>
            <span>심술 미소: 최고 {Math.round(judge.peak * 100)}%, {Math.round(judge.heldShare * 100)}% 동안 유지</span>
            <span className={styles.num}>+{judge.points}</span>
          </li>
        )}
      </ul>
      <button className={styles.primary} onClick={restart}>
        다시 하기
      </button>
    </div>
  );
}
