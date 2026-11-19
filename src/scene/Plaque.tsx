'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOBE, PLAQUE } from '@/src/game/constants';
import { totalPrankPoints, useApp } from '@/src/game/store';
import { titleFor } from '@/src/tracking/expression';

const W = 1024;
const H = 256;

/**
 * The brass plate on the front of the wooden base. Blank (just the work's name) until the
 * result; then the title and total score are engraved into it, left to right.
 * The canvas drives both the colour map and the bump map, so the letters read as cut in.
 */
export function Plaque() {
  const phase = useApp((s) => s.phase);
  const pranks = useApp((s) => s.pranks);
  const judge = useApp((s) => s.judgeResult);
  const engraveAt = useRef(0);

  const { color, bump, colorTex, bumpTex } = useMemo(() => {
    const color = document.createElement('canvas');
    const bump = document.createElement('canvas');
    color.width = bump.width = W;
    color.height = bump.height = H;
    const colorTex = new THREE.CanvasTexture(color);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.anisotropy = 8;
    const bumpTex = new THREE.CanvasTexture(bump);
    return { color, bump, colorTex, bumpTex };
  }, []);

  const text = useMemo(() => {
    if (phase !== 'reward') return null;
    const total = totalPrankPoints(pranks) + (judge?.points ?? 0);
    return { title: titleFor(total), score: total.toLocaleString() };
  }, [phase, pranks, judge]);

  useEffect(() => {
    if (text) engraveAt.current = performance.now();
  }, [text]);

  // Web fonts can arrive after the plate was drawn: redraw when they do.
  useEffect(() => {
    const redraw = () => (colorTex.userData.drawn = '');
    document.fonts.addEventListener('loadingdone', redraw);
    return () => document.fonts.removeEventListener('loadingdone', redraw);
  }, [colorTex]);

  useFrame(() => {
    const reveal = text ? Math.min(1, (performance.now() - engraveAt.current) / (PLAQUE.engraveSec * 1000)) : 1;
    // Only redraw while something changes.
    if (colorTex.userData.drawn === `${text?.title}|${text?.score}|${reveal}`) return;
    colorTex.userData.drawn = `${text?.title}|${text?.score}|${reveal}`;
    draw(color, bump, text, reveal);
    colorTex.needsUpdate = true;
    bumpTex.needsUpdate = true;
  });

  // A band of the lathe: radius just outside the base's waist, centred on the front (+z).
  const r = PLAQUE.radius;
  return (
    <mesh position-y={PLAQUE.y * (GLOBE.floorY / 0.32)}>
      <cylinderGeometry args={[r, r, PLAQUE.height, 48, 1, true, -PLAQUE.arc / 2, PLAQUE.arc]} />
      <meshStandardMaterial map={colorTex} bumpMap={bumpTex} bumpScale={-1.2} metalness={0.85} roughness={0.32} side={THREE.FrontSide} />
    </mesh>
  );
}

function draw(c: HTMLCanvasElement, b: HTMLCanvasElement, text: { title: string; score: string } | null, reveal: number) {
  const g = c.getContext('2d')!;
  const h = b.getContext('2d')!;
  // Brushed brass.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#d9b46a');
  grad.addColorStop(0.5, '#b88a3e');
  grad.addColorStop(1, '#8f6526');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(255,240,200,${Math.random() * 0.05})`;
    g.fillRect(0, Math.random() * H, W, 1);
  }
  h.fillStyle = '#fff';
  h.fillRect(0, 0, W, H);
  // Bevelled border.
  for (const ctx of [g, h]) {
    ctx.strokeStyle = ctx === g ? 'rgba(70,45,15,0.7)' : '#000';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, W - 28, H - 28);
  }

  const engrave = (s: string, y: number, size: number, font: string, weight = 'normal') => {
    for (const ctx of [g, h]) {
      ctx.save();
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (ctx === g) {
        // Cut edge catching the light below each stroke, then the dark cut itself.
        ctx.fillStyle = 'rgba(255,236,190,0.55)';
        ctx.fillText(s, W / 2, y + 3);
        ctx.fillStyle = '#1e1208';
      } else ctx.fillStyle = '#000';
      ctx.fillText(s, W / 2, y);
      ctx.restore();
    }
  };

  if (!text) {
    engrave('NAUGHTY LIST', H / 2, 64, "'olivia', Georgia, serif");
    return;
  }
  // Engrave inside a clip that sweeps left to right.
  for (const ctx of [g, h]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 40 + (W - 80) * reveal, H);
    ctx.clip();
  }
  engrave(text.title, H * 0.36, 108, "'jjblackrose', 'Apple SD Gothic Neo', sans-serif");
  engrave(text.score, H * 0.74, 60, "'olivia', Georgia, serif");
  for (const ctx of [g, h]) ctx.restore();
}
