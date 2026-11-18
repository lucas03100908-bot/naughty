import { FILTER } from '@/src/game/constants';

/**
 * 심술 필터: a WebGL face warp drawn from the webcam video, mirrored like a mirror.
 * A handful of soft "handles" sit on face landmarks; each pushes the image around it by a
 * displacement (pull the mouth corners toward the ears, V the brows, squint the eyes, puff the
 * cheeks). The fragment shader inverts that forward warp by fixed-point iteration, so a feature
 * really moves by d. Keep each displacement under ~0.9 × its radius or the warp folds over.
 * Nothing leaves the browser; nothing is stored.
 */

const MAX_HANDLES = 16;

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, (1.0 - a_pos.y) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D u_video;
uniform float u_aspect;
uniform int u_count;
uniform vec2 u_c[${MAX_HANDLES}];
uniform vec2 u_d[${MAX_HANDLES}];
uniform float u_r[${MAX_HANDLES}];
// Smile curve: mouth centre, mouth axis (unit, along the lips), half mouth width.
uniform vec2 u_mc;
uniform vec2 u_ma;
uniform float u_mhw;
uniform float u_smile;
uniform float u_stretch;
uniform float u_band;
uniform float u_curl;
varying vec2 v_uv;

// Forward displacement of the grin: lift grows with the square of the distance from the mouth
// centre (so the corners go up and the middle stays), plus a sideways stretch. Fades off above,
// below and past the corners.
vec2 mouthOff(vec2 s) {
  if (u_mhw <= 0.0) return vec2(0.0);
  vec2 q = s - u_mc;
  vec2 dn = vec2(-u_ma.y, u_ma.x);
  float a = dot(q, u_ma);
  float b = dot(q, dn);
  float t = a / u_mhw;
  float bw = u_band * u_mhw;
  float over = max(abs(t) - 1.25, 0.0);
  float f = exp(-(b * b) / (bw * bw)) * exp(-over * over * 2.5);
  // |t|^curl: flat in the middle, hooking up hard at the ends.
  float lift = pow(min(abs(t), 1.3), u_curl);
  return u_ma * (a * u_stretch * f) - dn * (u_smile * u_mhw * lift * f);
}
void main() {
  vec2 uv = vec2(1.0 - v_uv.x, v_uv.y);          // mirror
  vec2 p = vec2(uv.x * u_aspect, uv.y);           // aspect-correct space
  // Inverse of the forward warp f(s) = s + Σ dᵢ·wᵢ(s): solve f(s) = p by fixed-point iteration.
  vec2 s = p;
  for (int k = 0; k < 5; k++) {
    vec2 off = mouthOff(s);
    for (int i = 0; i < ${MAX_HANDLES}; i++) {
      if (i >= u_count) break;
      vec2 q = s - u_c[i];
      off += u_d[i] * exp(-dot(q, q) / (u_r[i] * u_r[i]));
    }
    s = p - off;
  }
  s = clamp(vec2(s.x / u_aspect, s.y), 0.0, 1.0);
  gl_FragColor = texture2D(u_video, s);
}`;

// Landmark indices (MediaPipe face mesh). "R"/"L" are the subject's right/left.
const LM = {
  eyeOuterR: 33,
  eyeOuterL: 263,
  mouthR: 61,
  mouthL: 291,
  browInnerR: 55,
  browInnerL: 285,
  browOuterR: 70,
  browOuterL: 300,
  lidUpR: 159,
  lidLowR: 145,
  lidUpL: 386,
  lidLowL: 374,
  cheekR: 50,
  cheekL: 280,
};

export class SpiteFilter {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private tex: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private smooth: Float32Array | null = null;
  private c = new Float32Array(MAX_HANDLES * 2);
  private d = new Float32Array(MAX_HANDLES * 2);
  private r = new Float32Array(MAX_HANDLES);

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    this.prog = link(gl, VERT, FRAG);
    gl.useProgram(this.prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(this.prog, 'a_pos');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const n of ['u_video', 'u_aspect', 'u_count', 'u_c', 'u_d', 'u_r', 'u_mc', 'u_ma', 'u_mhw', 'u_smile', 'u_stretch', 'u_band', 'u_curl'])
      this.loc[n] = gl.getUniformLocation(this.prog, n);
    gl.uniform1f(this.loc.u_mhw, 0); // no mouth yet: the smile term stays off
  }

  /**
   * @param landmarks normalized video coords, x/y interleaved (from live.landmarks)
   * @param hasFace false → draw the plain mirrored video
   * @param strength 0..1
   */
  render(video: HTMLVideoElement, landmarks: Float32Array, hasFace: boolean, strength: number) {
    const gl = this.gl;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    if (this.canvas.width !== vw || this.canvas.height !== vh) {
      this.canvas.width = vw;
      this.canvas.height = vh;
    }
    gl.viewport(0, 0, vw, vh);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    const aspect = vw / vh;
    const on = hasFace && strength > 0.001;
    const count = on ? this.buildHandles(landmarks, aspect, strength) : 0;
    gl.uniform1f(this.loc.u_smile, on ? FILTER.smileLift * strength : 0);
    gl.uniform1f(this.loc.u_stretch, on ? FILTER.smileStretch * strength : 0);
    gl.uniform1f(this.loc.u_band, FILTER.smileBand);
    gl.uniform1f(this.loc.u_curl, FILTER.smileCurl);

    gl.uniform1i(this.loc.u_video, 0);
    gl.uniform1f(this.loc.u_aspect, aspect);
    gl.uniform1i(this.loc.u_count, count);
    gl.uniform2fv(this.loc.u_c, this.c);
    gl.uniform2fv(this.loc.u_d, this.d);
    gl.uniform1fv(this.loc.u_r, this.r);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private buildHandles(raw: Float32Array, aspect: number, s: number) {
    // Smooth landmarks so tracking jitter doesn't make the warp wobble.
    if (!this.smooth) this.smooth = Float32Array.from(raw);
    const k = FILTER.landmarkSmoothing;
    for (let i = 0; i < raw.length; i++) this.smooth[i] = this.smooth[i] * k + raw[i] * (1 - k);
    const L = this.smooth;
    const P = (i: number): [number, number] => [L[i * 2] * aspect, L[i * 2 + 1]];

    // Face frame: x along the eye line (image right), y "down" the face; e = eye distance.
    const [rx, ry] = P(LM.eyeOuterR);
    const [lx, ly] = P(LM.eyeOuterL);
    const e = Math.hypot(lx - rx, ly - ry) || 0.1;
    const ux = [(lx - rx) / e, (ly - ry) / e];
    const down = [-ux[1], ux[0]];
    const up = [-down[0], -down[1]];

    let n = 0;
    const add = (i: number, dir: number[], amount: number, radius: number) => {
      if (n >= MAX_HANDLES) return;
      const [x, y] = P(i);
      this.c[n * 2] = x;
      this.c[n * 2 + 1] = y;
      this.d[n * 2] = dir[0] * amount * e * s;
      this.d[n * 2 + 1] = dir[1] * amount * e * s;
      this.r[n] = radius * e;
      n++;
    };
    const mix = (a: number[], wa: number, b: number[], wb: number) => {
      const v = [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb];
      const len = Math.hypot(v[0], v[1]) || 1;
      return [v[0] / len, v[1] / len];
    };
    const left = [-ux[0], -ux[1]]; // image-left (the subject's right side)
    const right = ux;
    const F = FILTER;

    // The grin itself is the smile curve in the shader, set up from the mouth corners.
    const [mrx, mry] = P(LM.mouthR);
    const [mlx, mly] = P(LM.mouthL);
    const hw = Math.max(0.2 * e, Math.hypot(mlx - mrx, mly - mry) / 2);
    this.gl.uniform2f(this.loc.u_mc, (mrx + mlx) / 2, (mry + mly) / 2);
    this.gl.uniform2f(this.loc.u_ma, (mlx - mrx) / (2 * hw), (mly - mry) / (2 * hw));
    this.gl.uniform1f(this.loc.u_mhw, hw);
    // V brows: inner ends down and in toward the nose, outer ends up.
    add(LM.browInnerR, mix(down, 1, right, F.browInnerIn), Math.hypot(F.browInnerDown, F.browInnerDown * F.browInnerIn), F.browRadius);
    add(LM.browInnerL, mix(down, 1, left, F.browInnerIn), Math.hypot(F.browInnerDown, F.browInnerDown * F.browInnerIn), F.browRadius);
    add(LM.browOuterR, up, F.browOuterUp, F.browRadius);
    add(LM.browOuterL, up, F.browOuterUp, F.browRadius);
    // Heavy upper lids (half-shut, sly), a little help from below.
    add(LM.lidUpR, down, F.eyeSquint, F.eyeRadius);
    add(LM.lidUpL, down, F.eyeSquint, F.eyeRadius);
    add(LM.lidLowR, up, F.eyeSquint * F.lowerLidShare, F.eyeRadius);
    add(LM.lidLowL, up, F.eyeSquint * F.lowerLidShare, F.eyeRadius);
    // Cheeks pushed up under the eyes.
    add(LM.cheekR, mix(left, 0.4, up, 0.7), F.cheekPuff, F.cheekRadius);
    add(LM.cheekL, mix(right, 0.4, up, 0.7), F.cheekPuff, F.cheekRadius);
    return n;
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

function link(gl: WebGLRenderingContext, vs: string, fs: string) {
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
    return sh;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}
