// The HDRI panoramas are photographed on the ground: trees, houses and grass below the sky. The
// diorama wants only the sky. Keep the band above the treeline, stretch it down to the horizon,
// and lay a dark room tone below it, so the same file can be the background and light the scene.
//
//   node scripts/bake-sky.mjs [--preview]
//
// In:  assets/source/hdri/moonless_golf_2k.hdr (2048×1024, RLE RGBE): a moonless starry night
// Out: public/hdri/sky.hdr (RLE RGBE, full resolution so the stars stay sharp), and the horizon's
//      colour for the fog (printed, to copy into LOOK.fogColor)
import fs from 'node:fs';
import sharp from 'sharp';

const SRC = 'assets/source/hdri/moonless_golf_2k.hdr';
const OUT = 'public/hdri/sky.hdr';
/** Elevation (degrees) above which the source is clear sky: the treeline and its mast end below. */
const SKY_FROM = 25;
/** Below the horizon: a dim cool room tone (linear radiance), reached this many degrees down. */
const FLOOR = [0.0025, 0.003, 0.0045];
const FLOOR_FADE = 10;
/**
 * A night grade (linear multipliers, horizon → zenith): the photo's horizon glow is street-lamp
 * sodium; cool it a little, and deepen the zenith toward blue.
 */
const GRADE_HORIZON = [0.85, 0.9, 1.05];
const GRADE_ZENITH = [0.22, 0.3, 0.62];
/** How tall the horizon glow is, in degrees (it falls to 1/e of the way to the zenith grade). */
const GLOW_DEG = 6;
/** Stars are lifted above the sky around them, so they still read through the tilt-shift blur. */
const STAR_BOOST = 3;
/** Overall gain, so LOOK.skyIntensity ≈ 1 shows the sky as a night sky. */
const GAIN = 1.6;
const W = 2048;
const H = 1024;

function readHdr(file) {
  const buf = fs.readFileSync(file);
  let p = 0;
  const line = () => {
    let s = '';
    while (buf[p] !== 10) s += String.fromCharCode(buf[p++]);
    p++;
    return s;
  };
  while (line() !== '') {}
  const [, h, , w] = line().split(' ');
  const width = +w, height = +h;
  const out = new Float32Array(width * height * 3);
  const scan = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    p += 4;
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < width) {
        let n = buf[p++];
        if (n > 128) {
          n -= 128;
          const v = buf[p++];
          while (n--) scan[c * width + x++] = v;
        } else while (n--) scan[c * width + x++] = buf[p++];
      }
    }
    for (let x = 0; x < width; x++) {
      const e = scan[3 * width + x];
      const f = e ? Math.pow(2, e - 136) : 0;
      for (let c = 0; c < 3; c++) out[(y * width + x) * 3 + c] = scan[c * width + x] * f;
    }
  }
  return { width, height, data: out };
}

function writeHdr(file, w, h, data) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'ascii');
  const chunks = [head];
  const rgbe = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      const m = Math.max(r, g, b);
      if (m < 1e-32) {
        rgbe.fill(0, x * 4, x * 4 + 4);
        continue;
      }
      const e = Math.ceil(Math.log2(m) + 1e-9);
      const s = 256 / Math.pow(2, e);
      rgbe[x * 4] = Math.min(255, r * s);
      rgbe[x * 4 + 1] = Math.min(255, g * s);
      rgbe[x * 4 + 2] = Math.min(255, b * s);
      rgbe[x * 4 + 3] = e + 128;
    }
    // New-style run-length scanline: each channel separately, runs (128+n) or literals (n).
    const line = [2, 2, w >> 8, w & 255];
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < w) {
        let run = 1;
        while (x + run < w && run < 127 && rgbe[(x + run) * 4 + c] === rgbe[x * 4 + c]) run++;
        if (run >= 3) {
          line.push(128 + run, rgbe[x * 4 + c]);
          x += run;
          continue;
        }
        const start = x;
        let n = 0;
        while (x < w && n < 128) {
          if (x + 2 < w && rgbe[x * 4 + c] === rgbe[(x + 1) * 4 + c] && rgbe[x * 4 + c] === rgbe[(x + 2) * 4 + c]) break;
          x++;
          n++;
        }
        line.push(n);
        for (let k = start; k < start + n; k++) line.push(rgbe[k * 4 + c]);
      }
    }
    chunks.push(Buffer.from(line));
  }
  fs.writeFileSync(file, Buffer.concat(chunks));
}

const src = readHdr(SRC);
/** Bilinear sample of the source at (u, v) in 0..1, wrapping round in u. */
function sample(u, v, out) {
  const fx = u * src.width - 0.5, fy = Math.min(src.height - 1, Math.max(0, v * src.height - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const y1 = Math.min(src.height - 1, y0 + 1);
  const xa = ((x0 % src.width) + src.width) % src.width, xb = (xa + 1) % src.width;
  for (let c = 0; c < 3; c++) {
    const a = src.data[(y0 * src.width + xa) * 3 + c], b = src.data[(y0 * src.width + xb) * 3 + c];
    const d = src.data[(y1 * src.width + xa) * 3 + c], e = src.data[(y1 * src.width + xb) * 3 + c];
    out[c] = (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
  }
  return out;
}

/** The sky's colour just above the horizon, per column, blurred wide so no single star shows. */
const horizonRow = (() => {
  const row = new Float32Array(W * 3);
  const px = [0, 0, 0];
  for (let x = 0; x < W; x++)
    for (let d = 0; d < 4; d++) {
      sample((x + 0.5) / W, (90 - SKY_FROM - d) / 180, px);
      for (let c = 0; c < 3; c++) row[x * 3 + c] += px[c] / 4;
    }
  const r = 48;
  const blurred = new Float32Array(W * 3);
  for (let x = 0; x < W; x++)
    for (let d = -r; d <= r; d++) {
      const xx = (((x + d) % W) + W) % W;
      for (let c = 0; c < 3; c++) blurred[x * 3 + c] += row[xx * 3 + c] / (2 * r + 1);
    }
  return blurred;
})();

const out = new Float32Array(W * H * 3);
const px = [0, 0, 0];
const horizon = [0, 0, 0];
for (let y = 0; y < H; y++) {
  const elev = 90 - ((y + 0.5) / H) * 180;
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W;
    const k = (y * W + x) * 3;
    if (elev >= 0) {
      // Horizon → the rooftops' edge, zenith → zenith; eased so the low sky keeps its glow.
      const t = elev / 90;
      const srcElev = SKY_FROM + (90 - SKY_FROM) * Math.pow(t, 0.6);
      sample(u, (90 - srcElev) / 180, px);
      // The camera looks down on the table and sees only the low sky: keep the glow a thin band
      // on the horizon, night blue from a little above it.
      const g = 1 - Math.exp(-elev / GLOW_DEG);
      for (let c = 0; c < 3; c++) out[k + c] = GAIN * px[c] * (GRADE_HORIZON[c] + (GRADE_ZENITH[c] - GRADE_HORIZON[c]) * g);
    } else {
      horizon[0] = horizonRow[x * 3];
      horizon[1] = horizonRow[x * 3 + 1];
      horizon[2] = horizonRow[x * 3 + 2];
      const f = Math.min(1, -elev / FLOOR_FADE);
      const s = f * f * (3 - 2 * f);
      for (let c = 0; c < 3; c++) out[k + c] = GAIN * horizon[c] * GRADE_HORIZON[c] * (1 - s) + FLOOR[c] * s;
    }
  }
}
fs.mkdirSync('public/hdri', { recursive: true });
writeHdr(OUT, W, H, out);
// Stars: whatever stands above a small blur of the sky around it, lifted.
{
  const top = H / 2;
  const blur = new Float32Array(W * top * 3);
  const tmp = new Float32Array(W * top * 3);
  const r = 5;
  for (let y = 0; y < top; y++)
    for (let x = 0; x < W; x++)
      for (let d = -r; d <= r; d++) {
        const xx = (((x + d) % W) + W) % W;
        for (let c = 0; c < 3; c++) tmp[(y * W + x) * 3 + c] += out[(y * W + xx) * 3 + c] / (2 * r + 1);
      }
  for (let y = 0; y < top; y++)
    for (let x = 0; x < W; x++)
      for (let d = -r; d <= r; d++) {
        const yy = Math.min(top - 1, Math.max(0, y + d));
        for (let c = 0; c < 3; c++) blur[(y * W + x) * 3 + c] += tmp[(yy * W + x) * 3 + c] / (2 * r + 1);
      }
  for (let k = 0; k < W * top * 3; k++) out[k] += Math.max(0, out[k] - blur[k] * 1.15) * STAR_BOOST;
}

// The horizon's average colour (display sRGB at skyIntensity 1): the fog that distant scenery fades into.
const avg = [0, 0, 0];
const row = Math.floor(H / 2) - 3;
for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) avg[c] += out[(row * W + x) * 3 + c] / W;
const hex = avg.map((v) => Math.round(Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('');
console.log(`horizon #${hex}`);
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`);

if (process.argv.includes('--preview')) {
  const b = Buffer.alloc(W * H * 3);
  for (let i = 0; i < out.length; i++) {
    const v = out[i] * 1;
    b[i] = Math.min(255, Math.pow(v / (1 + v), 1 / 2.2) * 255);
  }
  await sharp(b, { raw: { width: W, height: H, channels: 3 } }).jpeg().toFile('assets/reference/sky_preview.jpg');
}
