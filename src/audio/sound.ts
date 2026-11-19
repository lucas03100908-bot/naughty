import { afterFirstScreen } from '@/src/game/firstScreen';
import { PRANK } from '@/src/game/constants';
import type { PrankId } from '@/src/game/scoring';

/**
 * Web Audio, two kinds of sound:
 * - Recorded clips made for the piece (public/sfx): an ambient bed looped under everything, the
 *   snowman's giggle (pitched up to a helium voice), a snowball (the throw at the tree star, the
 *   snowman coming apart), and the sting when the result comes in.
 * - Synthesized: the smaller effects (lamp, star, printer), through a small echo so they sound
 *   like they come from inside the globe. Each clip has a synthesized stand-in until it has
 *   loaded. (There is no music: the ambient bed is the only thing that plays throughout.)
 * The context starts on the first pointer press (browsers block audio before a gesture).
 */

const SFX_GAIN = 0.32;
/** The ambient bed's level, and how much of its end is folded into its start to loop it. */
const AMBIENT_GAIN = 0.3;
const AMBIENT_FOLD = 2;
const GIGGLE_GAIN = 0.9;
/** Helium: the giggle played this much faster, so it is higher (≈ +7.6 semitones) and quicker. */
const GIGGLE_RATE = 1.55;
const SNOWBALL_GAIN = 1;
/** The result sting, a little under the other clips. */
const RESULT_GAIN = 0.45;

const CLIPS = {
  ambient: '/sfx/ambient.m4a',
  giggle: '/sfx/giggle.m4a',
  snowball: '/sfx/snowball.m4a',
  result: '/sfx/bug.m4a',
} as const;
type Clip = keyof typeof CLIPS;

// Fetch the files once the first screen has loaded; they are decoded once the audio context exists.
const clipBytes: Partial<Record<Clip, Promise<ArrayBuffer | null>>> = {};
if (typeof window !== 'undefined')
  for (const [name, url] of Object.entries(CLIPS) as [Clip, string][])
    clipBytes[name] = new Promise<void>((go) => afterFirstScreen(go)).then(() =>
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null),
    );

/**
 * A buffer that loops without a seam: its last `fold` seconds are cross-faded (equal power) into
 * its first, and the result is that much shorter. Played with `loop`, one source, forever.
 */
function seamlessLoop(ctx: BaseAudioContext, src: AudioBuffer, fold: number) {
  const x = Math.min(Math.floor(fold * src.sampleRate), Math.floor(src.length / 3));
  const len = src.length - x;
  const out = ctx.createBuffer(src.numberOfChannels, len, src.sampleRate);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const a = src.getChannelData(c);
    const b = out.getChannelData(c);
    b.set(a.subarray(0, len));
    for (let i = 0; i < x; i++) {
      const t = (i / x) * (Math.PI / 2);
      b[i] = a[i] * Math.sin(t) + a[len + i] * Math.cos(t);
    }
  }
  return out;
}

/** Time of the loudest sample: the snowball's impact, so it can be lined up with the hit. */
function peakTime(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0);
  let peak = 0;
  let at = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) {
      peak = a;
      at = i;
    }
  }
  return at / buffer.sampleRate;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ambient: GainNode | null = null;
  private echo: GainNode | null = null;
  private clips: Partial<Record<Clip, AudioBuffer>> = {};
  private snowballHit = 0;
  private ambientSource: AudioBufferSourceNode | null = null;
  private giggling: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Create (or resume) the audio graph. Safe to call on every gesture. */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      // Only one engine plays: a hot reload in development re-creates this module, and the old
      // one would keep its ambient going underneath the new.
      const registry = globalThis as { __naughtySound?: Sound };
      if (registry.__naughtySound && registry.__naughtySound !== this) registry.__naughtySound.dispose();
      registry.__naughtySound = this;
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
      this.sfx = ctx.createGain();
      this.sfx.gain.value = SFX_GAIN;
      this.sfx.connect(this.master);
      this.sfx.connect(this.echo);
      // The ambient bed goes straight out: it is a room, not something inside the globe.
      this.ambient = ctx.createGain();
      this.ambient.gain.value = 0;
      this.ambient.gain.setTargetAtTime(AMBIENT_GAIN, ctx.currentTime, 1.2);
      this.ambient.connect(this.master);
      void this.loadClips(ctx);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private async loadClips(ctx: AudioContext) {
    await Promise.all(
      (Object.keys(CLIPS) as Clip[]).map(async (name) => {
        const bytes = await clipBytes[name];
        if (!bytes) return;
        try {
          // decodeAudioData detaches the buffer it is given; keep the fetched copy reusable.
          this.clips[name] = await ctx.decodeAudioData(bytes.slice(0));
        } catch {
          // Undecodable here: the synthesized stand-in stays.
        }
      }),
    );
    if (this.clips.snowball) this.snowballHit = peakTime(this.clips.snowball);
    if (this.clips.ambient) this.clips.ambient = seamlessLoop(ctx, this.clips.ambient, AMBIENT_FOLD);
    this.startAmbient();
  }

  /** Stop everything and let the context go. */
  dispose() {
    this.ambientSource?.stop();
    this.ambientSource = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  /** Start a clip at `at` (context time), `offset` seconds in. */
  private play(name: Clip, at: number, gain: number, out: AudioNode | null, offset = 0, rate = 1) {
    const ctx = this.ctx;
    const buffer = this.clips[name];
    if (!ctx || !buffer || !out) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(out);
    src.start(at, offset);
    return { src, gain: g };
  }

  /** The ambient bed: one looping source, started once. */
  private startAmbient() {
    if (this.ambientSource || !this.ctx) return;
    const bed = this.play('ambient', this.ctx.currentTime + 0.05, 1, this.ambient);
    if (!bed) return;
    bed.src.loop = true;
    this.ambientSource = bed.src;
  }

  /** The ambient bed's level, 0..1 of its normal. */
  setAmbient(level: number) {
    if (this.ctx && this.ambient) this.ambient.gain.setTargetAtTime(AMBIENT_GAIN * level, this.ctx.currentTime, 0.5);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** A small bell: a sine with a bright, fast-fading overtone. */
  private pluck(f: number, at: number, vel: number, out: AudioNode | null = this.sfx) {
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
    if (id === 'tree') {
      if (this.clips.snowball) {
        // Line the recording's impact up with the moment the snowball reaches the star.
        const start = t + PRANK.snowballSec - this.snowballHit;
        this.play('snowball', Math.max(t, start), SNOWBALL_GAIN, this.sfx, Math.max(0, t - start));
        this.burst(t, 0.42, 'bandpass', 600, 2400, 0.15, 2); // a little air under the throw
      } else this.burst(t, 0.42, 'bandpass', 600, 2400, 0.35, 2); // whoosh
    }
  }

  /** A prank landed. */
  prankDone(id: PrankId) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (id === 'snowman') {
      this.stopGiggle();
      this.thump(t, 140, 55, 0.35, 0.9);
      // The snow bursting: the snowball recording from just before its impact.
      if (this.clips.snowball) this.play('snowball', t, SNOWBALL_GAIN, this.sfx, Math.max(0, this.snowballHit - 0.02));
      else this.burst(t, 0.5, 'lowpass', 1800, 300, 0.6);
      this.thump(t + 0.32, 110, 50, 0.25, 0.5);
    } else if (id === 'lamp') {
      this.thump(t, 900, 120, 0.12, 0.25);
      this.burst(t, 0.2, 'highpass', 4000, 2000, 0.3);
    } else {
      if (!this.clips.snowball) this.burst(t, 0.18, 'lowpass', 1500, 300, 0.7); // snowball hits
      this.pluck(hz(88), t + 0.03, 0.5, this.sfx); // the star rings
      this.pluck(hz(83), t + 0.09, 0.35, this.sfx);
      this.thump(t + 0.55, 300, 90, 0.15, 0.35); // lands in the snow
    }
  }

  /** The result is in: the sting (a little rising arpeggio until it has loaded). */
  fanfare() {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const t = ctx.currentTime;
    if (this.play('result', t, RESULT_GAIN, this.sfx)) return;
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

  /** The snowman, when the cursor finds it: its giggle, played through once before it can repeat. */
  giggle() {
    const ctx = this.ctx;
    const clip = this.clips.giggle;
    if (!ctx || !this.sfx) return;
    if (clip) {
      if (!this.hoverReady('giggle', clip.duration / GIGGLE_RATE)) return;
      const voice = this.play('giggle', ctx.currentTime + 0.01, GIGGLE_GAIN, this.sfx, 0, GIGGLE_RATE);
      if (voice) {
        this.giggling = voice;
        voice.src.onended = () => {
          if (this.giggling === voice) this.giggling = null;
        };
      }
      return;
    }
    this.synthGiggle();
  }

  /** Knocked over mid-laugh: the giggle stops short. */
  private stopGiggle() {
    const ctx = this.ctx;
    const voice = this.giggling;
    if (!ctx || !voice) return;
    voice.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    voice.src.stop(ctx.currentTime + 0.2);
    this.giggling = null;
  }

  /**
   * Stand-in until the recording loads: a high, sly "hee-hee-hee-heh" — a buzzy voice through
   * an "ee" vowel (two formant filters), each syllable a little lower, with a wobble.
   */
  private synthGiggle() {
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
