'use client';
import { useEffect, useRef, useState } from 'react';
import { ROLL } from '@/src/game/constants';
import { emitShake, live, useApp } from '@/src/game/store';
import { browDown, mouthFrown } from '@/src/tracking/expression';
import styles from './ui.module.css';

/** Toggle with D. Polls `live` at 10 Hz so the scene never re-renders for it. */
export function DebugPanel({ video }: { video: HTMLVideoElement | null }) {
  const open = useApp((s) => s.debugOpen);
  const mode = useApp((s) => s.mode);
  const error = useApp((s) => s.error);
  const events = useApp((s) => s.events);
  const phase = useApp((s) => s.phase);
  const toggle = useApp((s) => s.toggleDebug);
  const [, setTick] = useState(0);
  const preview = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [toggle]);

  useEffect(() => {
    const host = preview.current;
    if (!host || !video) return;
    host.appendChild(video);
    return () => {
      if (video.parentElement === host) host.removeChild(video);
    };
  }, [video, open]);

  // Viewers never see the button; the D key still opens the panel.
  if (!open) return process.env.NODE_ENV === 'production' ? null : <button className={styles.debugToggle} onClick={toggle}>디버그 (D)</button>;

  const b = live.blend;

  return (
    <aside className={styles.debug}>
      <header className={styles.debugHead}>
        <strong>디버그</strong>
        <span>
          {mode === 'camera' ? '헤드 트래킹' : mode === 'mouse' ? '마우스 대체' : '대기'} · {phase} · 안 {(live.viewBlend * 100).toFixed(0)}%
        </span>
        <button onClick={toggle} aria-label="닫기">×</button>
      </header>
      {error && <p className={styles.error}>{error}</p>}
      {mode === 'camera' && <div ref={preview} className={styles.preview} />}

      <Section title="머리 위치 (cm)">
        <Row k="x" v={live.head.x.toFixed(1)} />
        <Row k="y" v={live.head.y.toFixed(1)} />
        <Row k="z" v={live.head.z.toFixed(1)} />
        {mode === 'camera' && <Row k="얼굴" v={live.faceDetected ? '감지됨' : '없음'} />}
      </Section>

      <Section title="제스처">
        <Bar k="roll" v={live.rollDeg} min={-40} max={40} unit="°" dead={ROLL.deadzoneDeg} />
        <Bar k="yaw" v={live.yawDeg} min={-40} max={40} unit="°" />
        <Row k="흔들기 횟수" v={String(live.shakeCount)} />
      </Section>

      <Section title="표정 (blendshape)">
        <Bar k="browDown" v={browDown(b)} min={0} max={1} />
        <Bar k="mouthFrown" v={mouthFrown(b)} min={0} max={1} />
        <Bar k="browInnerUp" v={b.browInnerUp ?? 0} min={0} max={1} />
        <Bar k="mouthSmile" v={((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2} min={0} max={1} />
        <Bar k="jawOpen" v={b.jawOpen ?? 0} min={0} max={1} />
      </Section>

      <Section title="심술 심사">
        <Bar k="심술도" v={live.spite} min={0} max={1} />
        {live.spiteParts && (
          <>
            <Bar k="미소" v={live.spiteParts.smile} min={0} max={1} />
            <Bar k="찡그림" v={live.spiteParts.brow} min={0} max={1} />
            <Bar k="실눈" v={live.spiteParts.squint} min={0} max={1} />
            <Bar k="코 찡긋" v={live.spiteParts.sneer} min={0} max={1} />
          </>
        )}
        <label className={styles.row}>
          <span>필터 고정</span>
          <input
            type="range"
            min={-0.05}
            max={1}
            step={0.05}
            defaultValue={-0.05}
            onChange={(e) => {
              const v = Number(e.target.value);
              live.filterOverride = v < 0 ? null : v;
            }}
          />
          <span className={styles.num}>{live.filterOverride === null ? '자동' : live.filterOverride.toFixed(2)}</span>
        </label>
      </Section>

      <Section title="성능">
        <Row k="렌더 fps" v={live.renderFps.toFixed(0)} />
        {mode === 'camera' && <Row k="추적 fps" v={live.trackFps.toFixed(0)} />}
      </Section>

      <Section title="이벤트">
        <ul className={styles.events}>
          {events.length === 0 && <li className={styles.muted}>아직 없음</li>}
          {events.map((e) => (
            <li key={e.id}>{e.label}</li>
          ))}
        </ul>
        <button className={styles.small} onClick={() => emitShake('mouse')}>흔들기 테스트</button>
      </Section>

      {mode === 'mouse' && (
        <p className={styles.hint}>
          마우스 이동 = 시점 · 마우스를 빠르게 좌우로 흔들기 = 흔들기(첫 화면)
        </p>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span>{k}</span>
      <span className={styles.num}>{v}</span>
    </div>
  );
}

function Bar({ k, v, min, max, unit = '', dead }: { k: string; v: number; min: number; max: number; unit?: string; dead?: number }) {
  const span = max - min;
  const zero = ((0 - min) / span) * 100;
  const at = ((Math.min(max, Math.max(min, v)) - min) / span) * 100;
  const left = Math.min(zero, at);
  const width = Math.abs(at - zero);
  return (
    <div className={styles.row}>
      <span>{k}</span>
      <span className={styles.bar}>
        {dead !== undefined && (
          <i className={styles.dead} style={{ left: `${((-dead - min) / span) * 100}%`, width: `${((dead * 2) / span) * 100}%` }} />
        )}
        <i className={styles.fill} style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }} />
      </span>
      <span className={styles.num}>
        {unit ? v.toFixed(1) + unit : v.toFixed(2)}
      </span>
    </div>
  );
}
