import type { PrankId } from '@/src/game/scoring';

/**
 * All sound is synthesized with Web Audio: no files to load or license.
 * - A music box playing the chorus of Jingle Bells (James Lord Pierpont, 1857: public domain),
 *   looped, soft, through a small echo so it sounds like it comes from inside the globe.
 * - One-shot effects for the pranks and the result.
 * The context starts on the first pointer press (browsers block audio before a gesture).
 */

const MUSIC_GAIN = 0.11;
const SFX_GAIN = 0.32;
/** Beats per minute of the music box. */
const BPM = 112;

// Chorus of Jingle Bells in C, one octave up for a music box. [MIDI note, beats]; 0 = rest.
const E = 76, F = 77, G = 79, D = 74, C = 72;
const TUNE: [number, number][] = [
  [E, 1], [E, 1], [E, 2], [E, 1], [E, 1], [E, 2], [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4],
  [F, 1], [F, 1], [F, 1.5], [F, 0.5], [F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5], [E, 1], [D, 1], [D, 1], [E, 1], [D, 2], [G, 2],
  [E, 1], [E, 1], [E, 2], [E, 1], [E, 1], [E, 2], [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4],
  [F, 1], [F, 1], [F, 1.5], [F, 0.5], [F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5], [G, 1], [G, 1], [F, 1], [D, 1], [C, 3], [0, 1],
];
// A soft bass note under each bar (beats per bar = 4).
const BASS = [48, 48, 48, 48, 53, 48, 50, 55, 48, 48, 48, 48, 53, 48, 55, 48];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private echo: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicOn = false;
  private nextNoteAt = 0;
  private noteIndex = 0;
  private beatInTune = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  muted = false;

  /** Create (or resume) the audio graph. Safe to call on every gesture. */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);
      // Small echo: a feedback delay through a lowpass, like a box with glass walls.
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.23;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2600;
      this.echo = ctx.createGain();
      this.echo.gain.value = 0.35;
      this.echo.connect(delay);
      delay.connect(tone);
      tone.connect(fb);
      fb.connect(delay);
      tone.connect(this.master);
      this.music = ctx.createGain();
      this.music.gain.value = 0;
      this.music.connect(this.master);
      this.music.connect(this.echo);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = SFX_GAIN;
      this.sfx.connect(this.master);
      this.sfx.connect(this.echo);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.timer = setInterval(() => this.schedule(), 100);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** Fade the music box in or out (it keeps its place in the tune). */
  setMusic(on: boolean, level = 1) {
    if (!this.ctx || !this.music) {
      this.musicOn = on;
      return;
    }
    if (on && !this.musicOn) this.nextNoteAt = this.ctx.currentTime + 0.15;
    this.musicOn = on;
    this.music.gain.setTargetAtTime(on ? MUSIC_GAIN * level : 0, this.ctx.currentTime, on ? 0.6 : 0.25);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn) return;
    const beat = 60 / BPM;
    if (this.nextNoteAt < ctx.currentTime) this.nextNoteAt = ctx.currentTime + 0.05;
    while (this.nextNoteAt < ctx.currentTime + 0.4) {
      const [note, beats] = TUNE[this.noteIndex];
      if (note) this.pluck(hz(note), this.nextNoteAt, 0.9);
      // Bass on each bar line.
      if (this.beatInTune % 4 === 0) this.pluck(hz(BASS[Math.floor(this.beatInTune / 4) % BASS.length]), this.nextNoteAt, 0.45);
      this.nextNoteAt += beats * beat;
      this.beatInTune += beats;
      this.noteIndex = (this.noteIndex + 1) % TUNE.length;
      if (this.noteIndex === 0) this.beatInTune = 0;
    }
  }

  /** A music-box tine: a sine with a bright, fast-fading overtone. */
  private pluck(f: number, at: number, vel: number, out: AudioNode | null = this.music) {
    const ctx = this.ctx;
    if (!ctx || !out) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vel, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, at + 1.6);
    g.connect(out);
    const o1 = ctx.createOscillator();
    o1.frequency.value = f;
    o1.connect(g);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vel * 0.35, at);
    g2.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
    g2.connect(out);
    const o2 = ctx.createOscillator();
    o2.frequency.value = f * 4.2;
    o2.connect(g2);
    for (const o of [o1, o2]) {
      o.start(at);
      o.stop(at + 1.7);
    }
  }

  private burst(at: number, dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number, q = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.sfx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, at);
    filter.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(filter).connect(g).connect(this.sfx);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  }

  private thump(at: number, f0: number, f1: number, dur: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(this.sfx);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** Click on a prank target (before it lands): the lamp starts to fizz, a snowball is thrown. */
  prankStart(id: PrankId) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (id === 'lamp') for (let i = 0; i < 7; i++) this.burst(t + i * 0.11 + Math.random() * 0.05, 0.05, 'bandpass', 3200, 1800, 0.5, 6);
    if (id === 'tree') this.burst(t, 0.42, 'bandpass', 600, 2400, 0.35, 2); // whoosh
  }

  /** A prank landed. */
  prankDone(id: PrankId) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (id === 'snowman') {
      this.thump(t, 140, 55, 0.35, 0.9);
      this.burst(t, 0.5, 'lowpass', 1800, 300, 0.6);
      this.thump(t + 0.32, 110, 50, 0.25, 0.5);
    } else if (id === 'lamp') {
      this.thump(t, 900, 120, 0.12, 0.25);
      this.burst(t, 0.2, 'highpass', 4000, 2000, 0.3);
    } else {
      this.burst(t, 0.18, 'lowpass', 1500, 300, 0.7); // snowball hits
      this.pluck(hz(88), t + 0.03, 0.5, this.sfx); // the star rings
      this.pluck(hz(83), t + 0.09, 0.35, this.sfx);
      this.thump(t + 0.55, 300, 90, 0.15, 0.35); // lands in the snow
    }
  }

  /** The result is in: a little rising arpeggio. */
  fanfare() {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84, 88].forEach((n, i) => this.pluck(hz(n), t + i * 0.09, 0.6, this.sfx));
  }

  private lastHover: Record<string, number> = {};
  /** Hover sounds repeat at most this often per target, seconds. */
  private hoverReady(key: string, gap: number) {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.currentTime - (this.lastHover[key] ?? -99) < gap) return false;
    this.lastHover[key] = ctx.currentTime;
    return true;
  }

  /**
   * The snowman, when the cursor finds it: a high, sly "hee-hee-hee-heh" — a buzzy voice through
   * an "ee" vowel (two formant filters), each syllable a little lower, with a wobble.
   */
  giggle() {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.hoverReady('giggle', 1.4)) return;
    const t0 = ctx.currentTime + 0.02;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    for (const [f, q, g] of [
      [420, 6, 1],
      [2500, 9, 0.7],
      [3300, 10, 0.35],
    ] as const) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const gg = ctx.createGain();
      gg.gain.value = g;
      out.connect(bp).connect(gg).connect(this.sfx);
    }
    const syllables = 5;
    for (let i = 0; i < syllables; i++) {
      const at = t0 + i * 0.105 + (i === syllables - 1 ? 0.04 : 0);
      const len = i === syllables - 1 ? 0.2 : 0.075;
      const pitch = 760 - i * 55 + Math.random() * 20;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(pitch * 1.08, at);
      o.frequency.exponentialRampToValueAtTime(pitch * 0.86, at + len);
      const vib = ctx.createOscillator();
      vib.frequency.value = 28;
      const vibAmt = ctx.createGain();
      vibAmt.gain.value = pitch * 0.04;
      vib.connect(vibAmt).connect(o.frequency);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.5, at + 0.012);
      env.gain.exponentialRampToValueAtTime(0.001, at + len);
      o.connect(env).connect(out);
      for (const n of [o, vib]) {
        n.start(at);
        n.stop(at + len + 0.02);
      }
      // A breath between syllables.
      this.burst(at, 0.05, 'highpass', 5000, 3000, 0.08);
    }
  }

  /** The prank lamp, when the cursor finds it: a short electric buzz and crackle. */
  buzz() {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.hoverReady('buzz', 1.2)) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 100;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g.gain.setValueAtTime(0.12, t + 0.32);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(lp).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.5);
    for (let i = 0; i < 3; i++) this.burst(t + 0.05 + Math.random() * 0.3, 0.03, 'bandpass', 3500, 2500, 0.35, 5);
  }

  /** The tree star, when the cursor finds it: a bright little twinkle. */
  twinkle() {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.hoverReady('twinkle', 1.0)) return;
    const t = ctx.currentTime;
    [96, 100, 103].forEach((n, i) => this.pluck(hz(n), t + i * 0.06, 0.28, this.sfx));
  }

  /** The receipt printer feeding one line: a short dry rasp of the thermal head. */
  printLine() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.burst(t, 0.045, 'bandpass', 2600 + Math.random() * 600, 1800, 0.22, 3);
    this.thump(t, 180, 120, 0.03, 0.08);
  }

  /** The receipt torn off at the slot. */
  rip() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) this.burst(t + i * 0.022, 0.05, 'highpass', 2500, 5000, 0.3 - i * 0.03, 1);
  }

  /** Shake in the intro: a shimmer of tiny bells. */
  shimmer() {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 9; i++) this.pluck(hz(84 + Math.floor(Math.random() * 12)), t + i * 0.05 + Math.random() * 0.03, 0.18, this.sfx);
  }
}

export const sound = new Sound();
