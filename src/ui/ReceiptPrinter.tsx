'use client';
/*
 * Adapted from "Receipt Printer" by @dorianbaffier, kokonutUI (https://kokonutui.com).
 *
 * MIT License
 *
 * Copyright (c) 2025 kokonutUI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Changes here: CSS modules instead of Tailwind, any children as the paper, prints on mount,
 * Korean labels, the game's sounds, and a calmer tear: the torn sheet drops like paper (slow,
 * swaying side to side, flapping a little) instead of swinging from the hand.
 */
import { type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '@/src/audio/sound';
import styles from './receipt.module.css';

// Where the paper comes out, from the top of the printer.
const SLOT_Y = 58;
// The printer feeds a line at a time, with a short stop between lines.
const LINE = 16;
const FEED_RATE = 34;
const LINE_PAUSE = 0.05;
const LINE_JITTER = 0.05;
// Simulation, in px and seconds, on a fixed step.
const STEP = 1 / 120;
const GRAVITY = 2600;
const DAMPING = 0.985;
// While hanging from the slot, a pull stretches only this far, with growing resistance, and
// tears past this much drag. A sideways pull turns the sheet only a little.
const MAX_PULL = 18;
const TEAR_DRAG = 72;
const MAX_TILT = 0.1;
// A sharp downward yank tears it too, in px per second.
const TEAR_SPEED = 900;
// Falling paper: air holds it to a slow drop, it sways side to side, tilting into each swing,
// and the sheet flaps as it catches the air.
const FALL_SPEED = 380;
const AIR = 2.4;
const SWAY = 26;
const SWAY_RATE = 2.6;
const SWAY_TILT = 0.09;
const FLAP_X = 16;
const FLAP_Y = 7;
const FLAP_RATE = 6.2;
const REST_EPSILON = 0.02;

type Phase = 'idle' | 'printing' | 'hanging' | 'falling';

function damp(distance: number, max: number) {
  return max * (1 - Math.exp(-distance / max));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function haptic(ms = 8) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}

/** Local point p on a sheet turned by `angle`, relative to its corner. */
function turn(px: number, py: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [px * cos - py * sin, px * sin + py * cos];
}

// Serrated edges: the bottom was torn off the last receipt, and the top gets the same edge once
// this one is torn.
const TOOTH = 8;
const edge = (side: 'top' | 'bottom') =>
  `conic-gradient(from ${side === 'bottom' ? '-45deg at 50% 100%' : '135deg at 50% 0'}, #0000, #000 1deg 89deg, #0000 90deg) 50% ${side === 'bottom' ? '100%' : '0'} / ${TOOTH}px ${TOOTH / 2}px repeat-x`;
const FILL = `linear-gradient(#000 0 0) 0 ${TOOTH / 2}px / 100% calc(100% - ${TOOTH}px) no-repeat`;
const MASK_RESTING = `${edge('bottom')}, linear-gradient(#000 0 0) 0 0 / 100% calc(100% - ${TOOTH / 2}px) no-repeat`;
const MASK_TORN = `${edge('top')}, ${edge('bottom')}, ${FILL}`;

export function ReceiptPrinter({ label, children, onTear }: { label: string; children: ReactNode; onTear?: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [torn, setTorn] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [paperHeight, setPaperHeight] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const printerRef = useRef<HTMLDivElement>(null);

  const sim = useRef({
    phase: 'idle' as Phase,
    width: 0,
    height: 0,
    slotX: 0,
    // Centre of mass, now and one step ago (Verlet, while hanging), and the sheet's angle.
    cx: 0,
    cy: 0,
    pcx: 0,
    pcy: 0,
    angle: 0,
    // The hinge at the slot.
    hx: 0,
    hy: 0,
    // Falling: velocity, the line it sways about, time in the air, a per-tear seed.
    vx: 0,
    vy: 0,
    baseX: 0,
    tilt0: 0,
    fallT: 0,
    seed: 0,
    flapX: 0,
    flapY: 0,
    // Printing: how much paper is still inside the printer.
    hidden: 0,
    feedTarget: 0,
    pause: 0,
    // Dragging.
    pointerId: -1,
    grabX: 0,
    grabY: 0,
    startX: 0,
    startY: 0,
    samples: [] as { t: number; x: number; y: number }[],
    raf: 0,
    last: 0,
    carry: 0,
    reduceMotion: false,
  });

  const onTearRef = useRef(onTear);
  useEffect(() => {
    onTearRef.current = onTear;
  }, [onTear]);

  const setPhaseBoth = useCallback((next: Phase) => {
    sim.current.phase = next;
    setPhase(next);
  }, []);

  const draw = useCallback(() => {
    const s = sim.current;
    const paper = paperRef.current;
    if (!paper) return;
    // Place the sheet so its centre of mass lands on (cx, cy), turned by `angle` around its
    // top-left corner.
    const [ox, oy] = turn(s.width / 2, s.height / 2, s.angle);
    const left = s.slotX - s.width / 2;
    const tx = s.cx - ox - left;
    const ty = s.cy - oy - SLOT_Y;
    paper.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${s.angle.toFixed(4)}rad)`;
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (s.phase === 'falling') {
      // The flap, and light sliding across the bend with it.
      sheet.style.transform = `perspective(900px) rotateX(${s.flapX.toFixed(2)}deg) rotateY(${s.flapY.toFixed(2)}deg)`;
      sheet.style.setProperty('--bend', (s.flapX / FLAP_X).toFixed(3));
    } else if (sheet.style.transform) {
      sheet.style.transform = '';
      sheet.style.removeProperty('--bend');
    }
  }, []);

  // The centre of mass for a sheet hanging from the slot at `angle`.
  const hangAt = useCallback((angle: number) => {
    const s = sim.current;
    const [dx, dy] = turn(0, s.height / 2, angle);
    return [s.hx + dx, s.hy + dy];
  }, []);

  const placeAtSlot = useCallback(
    (pull: number) => {
      const s = sim.current;
      s.hx = s.slotX;
      s.hy = SLOT_Y + pull;
      const [cx, cy] = hangAt(0);
      s.cx = cx;
      s.cy = cy;
      s.pcx = cx;
      s.pcy = cy;
      s.angle = 0;
    },
    [hangAt],
  );

  // A thermal printer moves in short bursts: feed a line, stop, feed.
  const stepPrinting = useCallback(
    (dt: number) => {
      const s = sim.current;
      if (s.pause > 0) s.pause -= dt;
      else if (s.feedTarget > 0) {
        s.feedTarget = Math.max(0, s.feedTarget - LINE);
        s.pause = LINE_PAUSE + Math.random() * LINE_JITTER;
        sound.printLine();
      }
      s.hidden += (s.feedTarget - s.hidden) * Math.min(1, FEED_RATE * dt);
      if (Math.abs(s.hidden - s.feedTarget) < 0.05) s.hidden = s.feedTarget;
      placeAtSlot(-s.hidden);
      const printer = printerRef.current;
      if (printer) {
        // The housing buzzes while the motor runs.
        const buzz = s.pause > 0 ? 0 : Math.sin(performance.now() / 9) * 0.4;
        printer.style.transform = `translate3d(${buzz.toFixed(2)}px,0,0)`;
      }
      if (s.hidden === 0 && s.feedTarget === 0) {
        if (printer) printer.style.transform = '';
        setPhaseBoth('hanging');
        return 0;
      }
      return 1;
    },
    [placeAtSlot, setPhaseBoth],
  );

  // Hanging from the slot: a short, heavily damped settle back to straight down.
  const stepPendulum = useCallback(() => {
    const s = sim.current;
    const vx = (s.cx - s.pcx) * DAMPING;
    const vy = (s.cy - s.pcy) * DAMPING;
    s.pcx = s.cx;
    s.pcy = s.cy;
    s.cx += vx;
    s.cy += vy + GRAVITY * STEP * STEP;
    const rod = s.height / 2;
    const dx = s.cx - s.hx;
    const dy = s.cy - s.hy;
    const dist = Math.hypot(dx, dy) || 1;
    s.cx = s.hx + (dx / dist) * rod;
    s.cy = s.hy + (dy / dist) * rod;
    s.angle = clamp(Math.atan2(s.cy - s.hy, s.cx - s.hx) - Math.PI / 2, -MAX_TILT, MAX_TILT);
    return Math.abs(vx) + Math.abs(vy);
  }, []);

  // Falling like paper: the drop eases to a slow, steady speed, the sheet sways about a line
  // and tilts into each swing, and flaps as the air catches it.
  const stepFalling = useCallback(() => {
    const s = sim.current;
    s.fallT += STEP;
    const air = 1 - Math.exp(-AIR * STEP);
    s.vy += (FALL_SPEED - s.vy) * air;
    s.vx *= 1 - air;
    s.baseX += s.vx * STEP;
    s.cy += s.vy * STEP;
    // The sway builds up over the first half second, so the tear itself stays clean.
    const grow = 1 - Math.exp(-s.fallT * 3);
    const wave = s.fallT * SWAY_RATE + s.seed;
    s.cx = s.baseX + Math.sin(wave) * SWAY * grow;
    s.angle = s.tilt0 * Math.exp(-s.fallT * 2.5) + Math.cos(wave) * SWAY_TILT * grow;
    s.flapX = Math.sin(s.fallT * FLAP_RATE + s.seed * 2) * FLAP_X * grow;
    s.flapY = Math.sin(s.fallT * FLAP_RATE * 0.63 + s.seed) * FLAP_Y * grow;
    // Off the bottom of the window: done.
    const top = cardRef.current?.getBoundingClientRect().top ?? 0;
    const floor = window.innerHeight - top + Math.hypot(s.width, s.height) / 2;
    return s.cy > floor ? 0 : 1;
  }, []);

  const stepPhysics = useCallback(
    (elapsed: number) => {
      const s = sim.current;
      let busy = 0;
      s.carry += elapsed;
      while (s.carry >= STEP) {
        s.carry -= STEP;
        if (s.phase === 'falling') busy = stepFalling();
        else if (s.phase === 'hanging' && s.pointerId < 0) busy = stepPendulum();
      }
      return busy;
    },
    [stepFalling, stepPendulum],
  );

  const tickRef = useRef<(now: number) => void>(() => {});
  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const elapsed = s.last ? Math.min((now - s.last) / 1000, 0.05) : STEP;
      s.last = now;
      const busy = s.phase === 'printing' ? stepPrinting(elapsed) : stepPhysics(elapsed);
      draw();
      if (s.phase === 'falling' && busy === 0) {
        setPhaseBoth('idle');
        s.last = 0;
        return;
      }
      const keepGoing = s.phase === 'printing' || s.phase === 'falling' || s.pointerId >= 0 || busy > REST_EPSILON;
      if (keepGoing && !document.hidden) s.raf = requestAnimationFrame(tickRef.current);
      else s.last = 0;
    },
    [draw, setPhaseBoth, stepPhysics, stepPrinting],
  );
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const wake = useCallback(() => {
    const s = sim.current;
    if (!s.raf && !document.hidden) s.raf = requestAnimationFrame(tickRef.current);
  }, []);

  const measure = useCallback(() => {
    const s = sim.current;
    const card = cardRef.current;
    const paper = paperRef.current;
    if (!(card && paper)) return;
    s.width = paper.offsetWidth;
    s.height = paper.offsetHeight;
    s.slotX = card.clientWidth / 2;
    setPaperHeight(s.height);
  }, []);

  const print = useCallback(() => {
    const s = sim.current;
    measure();
    setTorn(false);
    if (s.reduceMotion) {
      placeAtSlot(0);
      draw();
      setPhaseBoth('hanging');
      return;
    }
    s.hidden = s.height;
    s.feedTarget = s.height;
    s.pause = 0.35;
    placeAtSlot(-s.hidden);
    draw();
    setPhaseBoth('printing');
    wake();
  }, [draw, measure, placeAtSlot, setPhaseBoth, wake]);

  /** Rip at the perforation and let it drop, carrying a little of the hand's speed. */
  const tear = useCallback(
    (vx: number, vy: number) => {
      const s = sim.current;
      setTorn(true);
      setDragging(false);
      haptic(14);
      sound.rip();
      onTearRef.current?.();
      printerRef.current?.animate([{ transform: 'translate3d(0,1.5px,0)' }, { transform: 'translate3d(0,0,0)' }], {
        duration: 220,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      });
      if (s.reduceMotion) {
        setPhaseBoth('idle');
        return;
      }
      s.pointerId = -1;
      s.vx = clamp(vx * 0.3, -160, 160);
      s.vy = clamp(vy * 0.4, 60, FALL_SPEED * 1.4);
      s.baseX = s.cx;
      s.tilt0 = s.angle;
      s.fallT = 0;
      // Sway away from the side it was pulled toward, so it reads as one motion.
      s.seed = vx > 0 ? Math.PI : 0;
      setPhaseBoth('falling');
      wake();
    },
    [setPhaseBoth, wake],
  );

  // Print once mounted (after fonts, so the paper is measured at its real height).
  useEffect(() => {
    const s = sim.current;
    s.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    measure();
    placeAtSlot(-s.height);
    draw();
    let alive = true;
    const go = () => alive && print();
    const timer = setTimeout(() => void document.fonts.ready.then(go), 450);
    const onVisible = () => !document.hidden && wake();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [draw, measure, placeAtSlot, print, wake]);

  const localPoint = (event: PointerEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: 0, y: 0 };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.phase !== 'hanging' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const { x, y } = localPoint(event);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the drag still works while over the sheet.
    }
    s.pointerId = event.pointerId;
    s.startX = x;
    s.startY = y;
    s.grabX = x - s.slotX;
    s.grabY = Math.max(y - SLOT_Y, 24);
    s.samples = [{ t: event.timeStamp, x, y }];
    setDragging(true);
    wake();
  };

  // Still attached: the sheet stretches a little downward and leans a little toward the hand.
  const dragAttached = (x: number, y: number) => {
    const s = sim.current;
    const pull = damp(Math.max(0, y - s.startY), MAX_PULL);
    s.hx = s.slotX;
    s.hy = SLOT_Y + pull;
    const lean = clamp(-Math.atan2(x - s.startX, s.grabY + 120), -MAX_TILT, MAX_TILT);
    const [cx, cy] = hangAt(lean);
    s.pcx = s.cx;
    s.pcy = s.cy;
    s.cx = cx;
    s.cy = cy;
    s.angle = lean;
  };

  const releaseVelocity = () => {
    const s = sim.current;
    const first = s.samples[0];
    const last = s.samples.at(-1) ?? first;
    const dt = Math.max((last.t - first.t) / 1000, 0.016);
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.pointerId !== event.pointerId || s.phase !== 'hanging') return;
    const { x, y } = localPoint(event);
    s.samples.push({ t: event.timeStamp, x, y });
    if (s.samples.length > 5) s.samples.shift();
    if (y - s.startY > TEAR_DRAG) {
      const { vx, vy } = releaseVelocity();
      tear(vx, vy);
    } else dragAttached(x, y);
    wake();
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.pointerId !== event.pointerId) return;
    s.pointerId = -1;
    setDragging(false);
    if (s.phase !== 'hanging') return;
    const { vx, vy } = releaseVelocity();
    if (vy > TEAR_SPEED) tear(vx, vy);
    else {
      // Let go: it springs back up to the slot and settles.
      s.hy = SLOT_Y;
      s.pcx = s.cx;
      s.pcy = s.cy;
    }
    wake();
  };

  const handleTearKey = () => {
    if (sim.current.phase === 'hanging') tear(0, 120);
  };

  let status = '대기';
  if (phase === 'printing') status = '출력 중…';
  else if (phase === 'hanging') status = '아래로 당겨 뜯기';
  else if (torn) status = '뜯음';

  const breeze = phase === 'hanging' && !dragging;

  return (
    <div className={styles.card} ref={cardRef} style={{ height: SLOT_Y + paperHeight + 8 }}>
      {/* The sheet, clipped at the slot until it's torn free. */}
      <div className={styles.paperZone} style={{ top: SLOT_Y, overflow: torn ? 'visible' : 'hidden' }}>
        <div
          aria-label={label}
          className={`${styles.paper} ${phase === 'hanging' ? styles.grab : ''} ${dragging ? styles.grabbing : ''} ${phase === 'idle' && torn ? styles.gone : ''}`}
          onLostPointerCapture={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={paperRef}
          role="document"
        >
          <div
            className={`${styles.sheet} ${breeze ? styles.breeze : ''}`}
            ref={sheetRef}
            style={{ mask: torn ? MASK_TORN : MASK_RESTING, WebkitMask: torn ? MASK_TORN : MASK_RESTING }}
          >
            {/* Perforation along the slot, where the sheet tears off. */}
            {!torn && <span aria-hidden="true" className={styles.perforation} />}
            {children}
          </div>
        </div>
      </div>

      {/* The printer housing, in front of the paper's top edge. */}
      <div className={styles.printer} ref={printerRef}>
        <div className={styles.printerTop}>
          <span className={styles.brand}>
            <span className={`${styles.led} ${phase === 'printing' ? styles.ledBusy : ''}`} aria-hidden="true" />
            HUMBUG PRINT
          </span>
          <span aria-live="polite" className={styles.status}>
            {status}
          </span>
        </div>
        <div className={styles.slot} />
      </div>

      {phase === 'hanging' && (
        <button className={styles.srTear} onClick={handleTearKey} type="button">
          성적표 뜯기
        </button>
      )}

      {phase === 'idle' && torn && (
        <div className={styles.again}>
          <button className={styles.againButton} onClick={print} type="button">
            한 장 더 출력
          </button>
        </div>
      )}
    </div>
  );
}
