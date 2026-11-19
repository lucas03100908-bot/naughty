import type { SceneShot } from '@/src/scene/capture';
import { PRANK_TASK, type PrankId } from './scoring';
import type { PrankRecord, JudgeResult } from './store';

/**
 * The shareable result card: a 1080×1350 PNG drawn in the browser from the scene snapshot and
 * the scores. The viewer's face (and the filter on it) is never part of it.
 */
export interface ShareData {
  title: string;
  total: number;
  pranks: PrankRecord[];
  judge: JudgeResult | null;
  /** Still of the 3D scene with the globe's place in it, or null. */
  scene: SceneShot | null;
}

const W = 1080;
const H = 1350;
/** Height of the picture at the top of the card. */
const PIC = Math.round(H * 0.6);

const COLOR = {
  bg: '#07080c',
  title: '#a51d36', // burgundy, still bright enough on the dark
  rank: '#e2b46c',
  score: '#f3ece0',
  label: '#8d877d',
  value: '#efe7d9',
  missed: '#5a5650',
  rule: 'rgba(226,180,108,0.28)',
};

const ROWS: PrankId[] = ['snowman', 'lamp', 'tree'];

const KO = "'Apple SD Gothic Neo', -apple-system, sans-serif";

export async function buildShareImage(d: ShareData): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  await document.fonts.ready;

  g.fillStyle = COLOR.bg;
  g.fillRect(0, 0, W, H);
  if (d.scene) await drawScene(g, d.scene);

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  g.fillStyle = COLOR.title;
  g.font = "112px 'olivia', Georgia, serif";
  g.fillText('NAUGHTY LIST', W / 2, H * 0.6);

  g.fillStyle = COLOR.rank;
  g.font = "84px 'jjblackrose', 'Apple SD Gothic Neo', sans-serif";
  g.fillText(d.title, W / 2, H * 0.675);

  g.fillStyle = COLOR.score;
  g.font = `600 64px ${KO}`;
  g.fillText(d.total.toLocaleString(), W / 2, H * 0.745);

  // A thin rule, then the record as label · value rows.
  const left = W / 2 - 290;
  const right = W / 2 + 290;
  g.fillStyle = COLOR.rule;
  g.fillRect(left, H * 0.775, right - left, 2);

  const rows: { label: string; value: string | null }[] = ROWS.map((id) => {
    const r = d.pranks.find((p) => p.id === id);
    return { label: PRANK_TASK[id], value: r ? `${Math.max(1, Math.round(r.elapsedSec))}초` : null };
  });
  rows.push({ label: '심술 미소', value: d.judge ? `최고 ${Math.round(d.judge.peak * 100)}%` : null });

  let y = H * 0.825;
  for (const row of rows) {
    g.font = `400 32px ${KO}`;
    g.textAlign = 'left';
    g.fillStyle = COLOR.label;
    g.fillText(row.label, left, y);
    g.textAlign = 'right';
    g.font = `500 32px ${KO}`;
    g.fillStyle = row.value ? COLOR.value : COLOR.missed;
    g.fillText(row.value ?? '못 함', right, y);
    y += H * 0.045;
  }

  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

/** The globe, cropped at the card's own aspect (never stretched) and faded into the dark. */
async function drawScene(g: CanvasRenderingContext2D, shot: SceneShot) {
  const img = await loadImage(shot.url);
  const iw = img.width;
  const ih = img.height;
  const top = shot.globe.top * ih;
  const bottom = shot.globe.bottom * ih;
  // The globe fills the picture from 6% to 84% of its height, clear of the title below.
  // The crop keeps the W:PIC aspect, so nothing is stretched.
  let sh = Math.min(ih, (bottom - top) / 0.78);
  let sw = sh * (W / PIC);
  if (sw > iw) {
    sw = iw;
    sh = sw * (PIC / W);
  }
  const sx = Math.min(Math.max(0, shot.globe.cx * iw - sw / 2), iw - sw);
  const sy = Math.min(Math.max(0, top - sh * 0.06), ih - sh);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, W, PIC);

  const fade = g.createLinearGradient(0, PIC * 0.8, 0, PIC);
  fade.addColorStop(0, 'rgba(7,8,12,0)');
  fade.addColorStop(1, COLOR.bg);
  g.fillStyle = fade;
  g.fillRect(0, 0, W, PIC);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** Save the image, or hand it to the system share sheet where that exists. */
export async function shareOrSave(blob: Blob) {
  const file = new File([blob], 'naughty-list.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData | { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'NAUGHTY LIST' });
      return 'shared';
    } catch {
      // cancelled: fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'naughty-list.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}
