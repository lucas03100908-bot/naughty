'use client';
import { useEffect, useState } from 'react';
import { PLAY, TITLES } from '@/src/game/constants';
import { PRANK_LABEL, PRANK_TASK, type PrankId } from '@/src/game/scoring';
import { totalPrankPoints, useApp, type JudgeResult, type PrankRecord } from '@/src/game/store';
import { cleanNickname, rankingIsShared, submitScore, todaysTop, type RankEntry } from '@/src/game/ranking';
import { buildShareImage, shareOrSave } from '@/src/game/share';
import { captureScene } from '@/src/scene/capture';
import { titleFor } from '@/src/tracking/expression';
import { LINES } from './copy';
import { ReceiptPrinter } from './ReceiptPrinter';
import receipt from './receipt.module.css';
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
      ? LINES.start
      : phase === 'judge'
        ? stage === 'pull'
          ? LINES.pull
          : stage === 'baseline'
            ? mode === 'camera'
              ? LINES.baselineCamera
              : LINES.baselineMouse
            : stage === 'grin'
              ? mode === 'camera'
                ? LINES.grinCamera
                : LINES.grinMouse
              : LINES.outro
        : null;
  if (!line) return null;
  return (
    <p className={styles.subtitle} key={line}>
      <span className={styles.speaker}>험벅</span>
      <span className={styles.line}>{line}</span>
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

/**
 * Result card beside the globe (the plaque on the base shows the title and score too):
 * score breakdown, records, today's ranking with a nickname, and the share image.
 */
export function ResultCard() {
  const phase = useApp((s) => s.phase);
  const pranks = useApp((s) => s.pranks);
  const judge = useApp((s) => s.judgeResult);
  if (phase !== 'reward') return null;
  return <ResultCardBody pranks={pranks} judge={judge} />;
}

function ResultCardBody({ pranks, judge }: { pranks: PrankRecord[]; judge: JudgeResult | null }) {
  const restart = useApp((s) => s.restart);
  const prankTotal = totalPrankPoints(pranks);
  const spite = judge?.points ?? 0;
  const total = prankTotal + spite;
  const title = titleFor(total);
  const [nickname, setNickname] = useState('');
  const [rank, setRank] = useState<{ list: RankEntry[]; status: 'idle' | 'saving' | 'saved' | 'error'; error?: string }>({ list: [], status: 'idle' });
  const [shareState, setShareState] = useState<'idle' | 'working' | 'done'>('idle');

  useEffect(() => {
    let alive = true;
    todaysTop().then(
      (list) => alive && setRank((r) => ({ ...r, list })),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    setRank((r) => ({ ...r, status: 'saving' }));
    try {
      await submitScore({ nickname, score: total, title });
      setRank({ list: await todaysTop(), status: 'saved' });
    } catch (e) {
      setRank((r) => ({ ...r, status: 'error', error: (e as Error).message }));
    }
  };

  const share = async () => {
    setShareState('working');
    const blob = await buildShareImage({ title, total, pranks, judge, scene: captureScene() });
    await shareOrSave(blob);
    setShareState('done');
  };

  const cleanName = cleanNickname(nickname);
  const myRank = rank.list.filter((e) => e.score > total).length + 1;

  return (
    <aside className={styles.result}>
      <ReceiptPrinter label={`험벅의 성적표: ${title}, ${total.toLocaleString()}점`}>
        <Receipt title={title} total={total} prankTotal={prankTotal} spite={spite} pranks={pranks} judge={judge} />
      </ReceiptPrinter>

      <section className={styles.desk}>
        <div className={styles.rankTop}>
          <p className={styles.rankHead}>
            오늘의 악동 순위{!rankingIsShared && <span className={styles.muted}> · 이 브라우저</span>}
          </p>
          {rank.status !== 'saved' && <span className={styles.rankGuess}>지금 점수면 {myRank}위</span>}
        </div>
        {rank.status !== 'saved' ? (
          <div className={styles.rankForm}>
            <input
              className={styles.input}
              value={nickname}
              maxLength={12}
              placeholder="악동 이름"
              aria-label="순위에 올릴 이름"
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button className={styles.rankSubmit} onClick={submit} disabled={rank.status === 'saving'}>
              {rank.status === 'saving' ? '올리는 중…' : '올리기'}
            </button>
          </div>
        ) : null}
        {rank.status === 'error' && <p className={styles.error}>{rank.error}</p>}
        <ol className={styles.rankList}>
          {rank.list.length === 0 && <li className={styles.rankEmpty}>아직 아무도 없어요. 첫 번째 악동이 돼 보세요.</li>}
          {rank.list.slice(0, 5).map((e, i) => (
            <li key={i} className={rank.status === 'saved' && e.nickname === cleanName && e.score === total ? styles.rankMine : ''}>
              <span className={styles.rankPos} data-pos={i + 1}>
                {i + 1}
              </span>
              <span className={styles.rankName}>
                {e.nickname} <span className={styles.muted}>{e.title}</span>
              </span>
              <span className={styles.rankScore}>{e.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>

        <div className={styles.resultActions}>
          <button className={styles.secondary} onClick={share} disabled={shareState === 'working'}>
            {shareState === 'working' ? '만드는 중…' : shareState === 'done' ? '다시 저장' : '이미지 저장·공유'}
          </button>
          <button className={styles.primary} onClick={restart}>
            다시 하기
          </button>
        </div>
        <p className={styles.privacy}>성적표 이미지에는 얼굴이 들어가지 않아요.</p>
      </section>
    </aside>
  );
}

// Barcode bar widths, fixed so server and browser agree.
const BARS = [2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1, 1, 2, 2, 1, 1, 3, 1, 2];

/** Humbug's verdict at the bottom of the receipt, by title tier. */
function footerFor(total: number) {
  if (total >= TITLES[2].min) return { lead: '석탄 한 트럭', rest: ' 예약 완료. 내년에도 기대할게요.' };
  if (total >= TITLES[1].min) return { lead: '선물 대신 석탄 1kg', rest: ' 배송 예정.' };
  return { lead: '아직은 귀여운 수준', rest: '. 석탄은 보류해 둘게요.' };
}

/** The scorecard as a printed receipt: verdict, itemised pranks, total, barcode. */
function Receipt({
  title,
  total,
  prankTotal,
  spite,
  pranks,
  judge,
}: {
  title: string;
  total: number;
  prankTotal: number;
  spite: number;
  pranks: PrankRecord[];
  judge: JudgeResult | null;
}) {
  // Printed once, when the receipt comes out.
  const [stamp] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      no: String(d.getTime() % 10000).padStart(4, '0'),
    };
  });
  const footer = footerFor(total);
  return (
    <div className={receipt.receipt}>
      <div className={receipt.head}>
        <p className={receipt.logo}>NAUGHTY LIST</p>
        <p className={receipt.meta}>
          험벅의 성적표 · No.{stamp.no}
          <br />
          {stamp.date}
        </p>
      </div>
      <hr className={receipt.rule} />
      <div className={receipt.verdict}>
        <p className={receipt.verdictLabel}>판정</p>
        <p className={receipt.title}>{title}</p>
        <span className={receipt.stamp}>NAUGHTY</span>
      </div>
      <hr className={receipt.rule} />
      <ul className={receipt.lines}>
        {ORDER.map((id) => {
          const r = pranks.find((p) => p.id === id);
          return (
            <li key={id} className={`${receipt.line} ${r ? '' : receipt.missed}`}>
              <span className={receipt.lineName}>{PRANK_TASK[id]}</span>
              <span className={receipt.lineNote}>{r ? `${Math.max(1, Math.round(r.elapsedSec))}초` : '못 함'}</span>
              <span className={receipt.linePts}>{r ? `+${r.points.toLocaleString()}` : '0'}</span>
            </li>
          );
        })}
        <li className={`${receipt.line} ${judge ? '' : receipt.missed}`}>
          <span className={receipt.lineName}>심술 미소</span>
          <span className={receipt.lineNote}>{judge ? `최고 ${Math.round(judge.peak * 100)}%` : '없음'}</span>
          <span className={receipt.linePts}>{judge ? `+${judge.points.toLocaleString()}` : '0'}</span>
        </li>
      </ul>
      <hr className={receipt.rule} />
      <p className={receipt.sub}>
        <span>장난 점수</span>
        <span>{prankTotal.toLocaleString()}</span>
      </p>
      <p className={receipt.sub}>
        <span>심술 점수</span>
        <span>{spite.toLocaleString()}</span>
      </p>
      <p className={receipt.total}>
        <span className={receipt.totalLabel}>합계</span>
        <span className={receipt.totalValue}>{total.toLocaleString()}</span>
      </p>
      <div aria-hidden="true" className={receipt.barcode}>
        {BARS.map((w, i) => (
          <span key={i} style={{ width: w }} />
        ))}
      </div>
      <p className={receipt.footer}>
        <strong>{footer.lead}</strong>
        {footer.rest}
      </p>
    </div>
  );
}
