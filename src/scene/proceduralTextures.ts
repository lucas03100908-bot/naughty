import * as THREE from 'three';

// Small canvas-generated textures, so the base, floor and cloth cost no downloads.

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!] as const;
}

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function tex(c: HTMLCanvasElement, repeat: [number, number], srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/**
 * Chunky stockinette knit: columns of interlocking "V" loops. Returns a colour map and a
 * height (bump) map that share the same layout.
 */
export function knitTextures(repeat: [number, number]) {
  const size = 512;
  const cols = 8;
  const rows = 12;
  const [cc, c] = canvas(size);
  const [hc, h] = canvas(size);
  const r = rand(7);
  c.fillStyle = '#0b0b0d';
  c.fillRect(0, 0, size, size);
  h.fillStyle = '#000';
  h.fillRect(0, 0, size, size);

  const cw = size / cols;
  const rh = size / rows;
  for (let col = 0; col < cols; col++) {
    for (let row = -1; row <= rows; row++) {
      const x = col * cw + cw / 2;
      const y = row * rh + rh / 2;
      for (const side of [-1, 1]) {
        // One leg of the V: a tilted, elongated loop.
        const draw = (ctx: CanvasRenderingContext2D, fill: string | CanvasGradient) => {
          ctx.save();
          ctx.translate(x + side * cw * 0.22, y);
          ctx.rotate(side * -0.62);
          ctx.beginPath();
          ctx.ellipse(0, 0, cw * 0.2, rh * 0.78, 0, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.restore();
        };
        const shade = 92 + r() * 22;
        const gc = c.createRadialGradient(x, y - rh * 0.2, 1, x, y, rh);
        gc.addColorStop(0, `rgb(${shade + 30},${shade + 30},${shade + 34})`);
        gc.addColorStop(1, `rgb(${shade - 45},${shade - 45},${shade - 42})`);
        draw(c, gc);
        const gh = h.createRadialGradient(x + side * cw * 0.22, y, 1, x + side * cw * 0.22, y, rh * 0.8);
        gh.addColorStop(0, '#fff');
        gh.addColorStop(1, '#000');
        draw(h, gh);
      }
    }
  }
  // Fuzzy fibres.
  for (let i = 0; i < 9000; i++) {
    const v = 90 + r() * 60;
    c.fillStyle = `rgba(${v},${v},${v + 4},0.12)`;
    c.fillRect(r() * size, r() * size, 1, 2 + r() * 3);
  }
  return { map: tex(cc, repeat, true), bump: tex(hc, repeat, false) };
}

/** Dark walnut with turned-wood rings (stripes run around the lathe). */
export function woodTextures() {
  const size = 512;
  const [cc, c] = canvas(size);
  const [rc, rg] = canvas(size);
  const r = rand(3);
  const grad = c.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#3a2215');
  grad.addColorStop(1, '#2a170d');
  c.fillStyle = grad;
  c.fillRect(0, 0, size, size);
  rg.fillStyle = '#7a7a7a';
  rg.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const y = r() * size;
    const w = 0.5 + r() * 2.5;
    const dark = r() > 0.5;
    c.strokeStyle = dark ? `rgba(15,7,3,${0.15 + r() * 0.35})` : `rgba(120,70,40,${0.08 + r() * 0.15})`;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) c.lineTo(x, y + Math.sin(x * 0.02 + i) * 2.5);
    c.stroke();
    rg.strokeStyle = dark ? 'rgba(170,170,170,0.5)' : 'rgba(60,60,60,0.4)';
    rg.lineWidth = w;
    rg.beginPath();
    rg.moveTo(0, y);
    rg.lineTo(size, y);
    rg.stroke();
  }
  return { map: tex(cc, [3, 1], true), roughness: tex(rc, [3, 1], false) };
}

/** Frosty cobblestones for the village floor under the snow. */
export function cobbleTextures() {
  const size = 512;
  const [cc, c] = canvas(size);
  const [hc, h] = canvas(size);
  const r = rand(11);
  c.fillStyle = '#23252a';
  c.fillRect(0, 0, size, size);
  h.fillStyle = '#000';
  h.fillRect(0, 0, size, size);
  const n = 14;
  const s = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = i * s + s / 2 + (r() - 0.5) * s * 0.25 + (j % 2) * s * 0.5;
      const y = j * s + s / 2 + (r() - 0.5) * s * 0.25;
      const rx = s * (0.36 + r() * 0.08);
      const ry = s * (0.32 + r() * 0.08);
      const v = 70 + r() * 40;
      c.fillStyle = `rgb(${v},${v + 2},${v + 8})`;
      c.beginPath();
      c.ellipse(x % size, y, rx, ry, r() * 3, 0, Math.PI * 2);
      c.fill();
      const g = h.createRadialGradient(x % size, y, 1, x % size, y, rx);
      g.addColorStop(0, '#fff');
      g.addColorStop(1, '#222');
      h.fillStyle = g;
      h.beginPath();
      h.ellipse(x % size, y, rx, ry, 0, 0, Math.PI * 2);
      h.fill();
    }
  // Frost in the gaps.
  for (let i = 0; i < 5000; i++) {
    c.fillStyle = `rgba(220,230,240,${0.05 + r() * 0.12})`;
    c.fillRect(r() * size, r() * size, 2, 2);
  }
  return { map: tex(cc, [3, 3], true), bump: tex(hc, [3, 3], false) };
}

/** Soft round sprite for snowflakes. */
export function flakeSprite() {
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
