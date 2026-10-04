/**
 * 당당한의 사진 나무를 그린다 — 칠 한 색 · 덩이 밑 그늘은 빗금으로 오려 냄 · 바람(2026-09-30, 디자이너가 격자와 움직이는
 * 견본으로 골랐다. design/landscape.md '나무').
 *
 * 그리는 판(assets/trees/<id>.png)은 초록 = 칠, 빨강 = 그늘이다. 나무마다 제 크기(기기 px)로 한 번 줄여 두고(tree),
 * 글자 자리 판(zone — 빨강 = 빗금을 걷는 곳, 초록 = 바람을 멈추는 곳)을 따로 그린다. 한 프레임은:
 *   바람  잎 떨림(바람결이 한쪽에서 지나가며 칠을 살랑 민다) + 흔들림(수관이 기울었다 돌아온다) × 돌풍. 밑동은 가만히,
 *         글자 자리도 가만히 — 그 둘레의 칠이 움직이면 윤곽 밖으로 나간 줄 끝(끄트머리 잘리게)이 깜박인다
 *   빗금  그늘 안에서 칠로 남는 줄(／)만 두고 나머지를 오려 낸다. 무늬는 칠을 따라 움직인다(잎에 붙은 그늘이다).
 *         손으로 그은 듯 줄이 굽이치고 굵기가 오르내린다 — 돌 · 구름과 같은 '미세'(2026-10-04). 줄 가장자리는 다듬는다
 *   칠    참여자가 고른 색 하나. 새 색을 만들지 않는다
 *
 * 벽에 나무가 여러 그루여도 WebGL 문맥은 **하나**다 — 크롬은 문맥이 열여섯을 넘으면 오래된 것부터 잃는다. 한 문맥에서
 * 나무마다 그리고 그 나무의 2D 캔버스로 옮긴다. WebGL이 없으면(끈 기기 · 문맥을 잃음) 바람 없이 한 번 그린다(CPU).
 */

export interface TreeJob {
  /** 나무 판 — 초록 칠 · 빨강 그늘, 나무 크기(기기 px) */
  tree: HTMLCanvasElement;
  /** 글자 자리 판 — 빨강 = 빗금을 걷는 곳, 초록 = 바람을 멈추는 곳(흐림 포함), 나무 판과 같은 크기 */
  zone: HTMLCanvasElement;
  /** 그릴 캔버스(기기 px) · 둘레 여유(기기 px — 밀린 잎이 잘리지 않게) */
  out: HTMLCanvasElement;
  margin: number;
  color: readonly [number, number, number];
  willow: boolean;
  /** 기기 px — 잎 떨림 · 흔들림 · 바람결 · 빗금 한 칸 · 빗금 줄 굵기 */
  flutter: number; sway: number; grain: number; hatchPeriod: number; hatchWidth: number;
  /** 빗금의 손맛 — 줄 자리를 미는 폭(낮은 결 · 잔 결, 기기 px) · 굵기 오르내림 몫, 그 결의 폭(기기 px) */
  hatchWob: readonly [number, number, number]; hatchGrain: readonly [number, number, number];
  /** 초 — --t-hold, 그 배수들(바람결 한 결 · 흔들림 한 번 · 돌풍 한 번), 나무마다 다른 시작 */
  hold: number; pass: number; swayTurn: number; gust: number; phase: number;
}

const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
const FS = `precision highp float;
uniform sampler2D uTree, uZone;
uniform vec2 uOut, uSize;
uniform vec3 uColor;
uniform float uM, uT, uHold, uR, uS, uGrain, uHP, uHW, uWillow, uPhase, uPass, uSwayT, uGustT;
uniform vec3 uWob, uGr;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
// 결의 폭 s(px)의 잡음 — 대략 표준편차 1(돌 · 구름의 뭉갠 잡음과 같은 손)
float sn(vec2 p, float s, float o){ return (noise(p / max(2.5 * s, 1e-3) + o) - .5) * 5.; }
void main(){
  vec2 px = vec2(gl_FragCoord.x, uOut.y - gl_FragCoord.y) - vec2(uM);          // 나무 좌표, 위가 0
  vec4 z = texture2D(uZone, clamp(px / uSize, 0., 1.));
  float y01 = clamp(px.y / uSize.y, 0., 1.);
  float still = pow(clamp((uSize.y - px.y) / (.45 * uSize.y), 0., 1.), 1.5) * (1. - clamp(z.g * 1.6, 0., 1.));
  float gust = .55 + .45 * sin(6.2832 * uT / (uHold * uGustT) + uPhase);
  float sp = uT / (uHold * uPass) + uPhase;
  vec2 q = uWillow > .5 ? vec2(px.x / uGrain, px.y / (uGrain * 4.)) : px / uGrain;   // 버드나무는 세로로 긴 결(가닥)
  float nx = noise(q + vec2(-sp, 0.)) + .5 * noise(q * 2.1 + vec2(-sp * 1.7, 3.1)) - .75;
  float ny = noise(q * 1.3 + vec2(-sp * 1.2, 7.7)) - .5;
  vec2 d = uR * gust * vec2(nx * 1.6, uWillow > .5 ? ny * .3 : ny);
  float lean = uWillow > .5 ? (.3 + .7 * y01) : pow(1. - y01, 2.);            // 소나무는 꼭대기, 버드나무는 늘어진 가닥 끝이 크게
  d.x += uS * gust * sin(6.2832 * uT / (uHold * uSwayT) + uPhase) * lean;
  if (uWillow > .5) d *= .35 + .65 * y01;
  vec2 src = px - d * still;
  if (src.x < 0. || src.y < 0. || src.x > uSize.x || src.y > uSize.y) { gl_FragColor = vec4(0.); return; }
  vec4 tv = texture2D(uTree, src / uSize);
  // 빗금 — 줄 자리를 낮은 결 + 잔 결로 밀고 굵기를 오르내린다(손맛). 줄 가장자리 · 그늘 테두리는 다듬는다(켜고 끄면 계단이 졌다)
  float u = src.x + src.y + uWob.x * sn(src, uGr.x, 0.) + uWob.y * sn(src, uGr.y, 17.);
  float wl = uHW * (1. + uWob.z * sn(src, uGr.z, 31.)), ph = mod(u, uHP);
  float sd = (ph >= wl ? min(ph - wl, uHP - ph) : -min(wl - ph, ph)) * .70710678;
  // 그늘은 칠에 대한 몫으로 — 가는 가닥은 줄이면 칠 · 그늘이 같이 옅어져 0.5 아래로 빠졌다
  float cut = smoothstep(.3, .7, tv.r / max(tv.g, .01)) * step(.02, tv.g) * (z.r < .3 ? 1. : 0.) * clamp(sd + .5, 0., 1.);
  float a = tv.g * (1. - cut);
  gl_FragColor = vec4(uColor * a, a);
}`;

type GL = { gl: WebGLRenderingContext; canvas: HTMLCanvasElement; loc: Record<string, WebGLUniformLocation | null> };
let shared: GL | null | undefined;
const NAMES = ['uTree', 'uZone', 'uOut', 'uSize', 'uColor', 'uM', 'uT', 'uHold', 'uR', 'uS', 'uGrain', 'uHP', 'uHW', 'uWillow', 'uPhase', 'uPass', 'uSwayT', 'uGustT', 'uWob', 'uGr'];

function glOf(): GL | null {
  if (shared !== undefined) return shared;
  shared = null;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
    if (!gl) return null;
    const sh = (type: number, src: string) => {
      const o = gl.createShader(type)!; gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) ?? 'shader');
      return o;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const loc: GL['loc'] = {};
    for (const n of NAMES) loc[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(loc.uTree, 0); gl.uniform1i(loc.uZone, 1);
    // 문맥을 잃으면 다음부터 CPU로(이미 그린 나무는 그대로 멈춘다)
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); shared = null; });
    shared = { gl, canvas, loc };
  } catch {
    shared = null;
  }
  return shared;
}

function texOf(gl: WebGLRenderingContext, src: HTMLCanvasElement): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]])
    gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}

/** 나무 한 그루를 그리는 붓 — draw(초)마다 그 순간의 나무를 out에 그린다. 다 쓰면 dispose */
export class TreePainter {
  private g: GL | null;
  private tex: [WebGLTexture, WebGLTexture] | null = null;
  readonly moving: boolean;
  constructor(private job: TreeJob) {
    this.g = glOf();
    if (this.g) this.tex = [texOf(this.g.gl, job.tree), texOf(this.g.gl, job.zone)];
    this.moving = !!this.g;
  }
  draw(sec: number, wind = true): void {
    const j = this.job, g = shared && shared === this.g ? this.g : null;
    const W = j.out.width, H = j.out.height, ctx = j.out.getContext('2d');
    if (!ctx || W < 1 || H < 1) return;
    if (!g || !this.tex) { this.cpu(ctx); return; }
    const { gl, canvas, loc } = g;
    if (canvas.width < W) canvas.width = W;
    if (canvas.height < H) canvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
    gl.uniform2f(loc.uOut, W, H); gl.uniform2f(loc.uSize, j.tree.width, j.tree.height);
    gl.uniform3f(loc.uColor, j.color[0], j.color[1], j.color[2]);
    gl.uniform1f(loc.uM, j.margin); gl.uniform1f(loc.uT, sec); gl.uniform1f(loc.uHold, j.hold);
    gl.uniform1f(loc.uR, wind ? j.flutter : 0); gl.uniform1f(loc.uS, wind ? j.sway : 0);
    gl.uniform1f(loc.uGrain, j.grain); gl.uniform1f(loc.uHP, j.hatchPeriod); gl.uniform1f(loc.uHW, j.hatchWidth);
    gl.uniform3f(loc.uWob, j.hatchWob[0], j.hatchWob[1], j.hatchWob[2]); gl.uniform3f(loc.uGr, j.hatchGrain[0], j.hatchGrain[1], j.hatchGrain[2]);
    gl.uniform1f(loc.uWillow, j.willow ? 1 : 0); gl.uniform1f(loc.uPhase, j.phase);
    gl.uniform1f(loc.uPass, j.pass); gl.uniform1f(loc.uSwayT, j.swayTurn); gl.uniform1f(loc.uGustT, j.gust);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(canvas, 0, canvas.height - H, W, H, 0, 0, W, H);
  }
  /** WebGL 없이 — 바람 없는 한 장. 셰이더와 같은 규칙(칠 · 그늘 안 빗금 · 글자 자리에선 걷음), 손맛 · 다듬기는 없이 곧은 줄 */
  private cpu(ctx: CanvasRenderingContext2D): void {
    const j = this.job, W = j.out.width, H = j.out.height, tw = j.tree.width, th = j.tree.height, m = Math.round(j.margin);
    const T = j.tree.getContext('2d')?.getImageData(0, 0, tw, th).data, Z = j.zone.getContext('2d')?.getImageData(0, 0, tw, th).data;
    if (!T || !Z) return;
    const img = ctx.createImageData(W, H), o = img.data;
    const [r, gg, b] = j.color.map((v) => Math.round(v * 255));
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const i = (y * tw + x) * 4, fill = T[i + 1] / 255;
      if (!fill) continue;
      const cut = T[i] > 127 && ((x + y) % j.hatchPeriod) >= j.hatchWidth && Z[i] < 77;
      if (cut) continue;
      const k = ((y + m) * W + x + m) * 4;
      if (x + m >= W || y + m >= H) continue;
      o[k] = r; o[k + 1] = gg; o[k + 2] = b; o[k + 3] = Math.round(fill * 255);
    }
    ctx.putImageData(img, 0, 0);
  }
  dispose(): void {
    if (this.g && this.tex && shared === this.g) for (const t of this.tex) this.g.gl.deleteTexture(t);
    this.tex = null;
  }
}

const IMGS = new Map<string, Promise<HTMLImageElement>>();
/** 그리는 판을 한 번만 받는다 */
export function treeImage(url: string): Promise<HTMLImageElement> {
  let p = IMGS.get(url);
  if (!p) {
    p = new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = no; i.src = url; });
    IMGS.set(url, p);
  }
  return p;
}

/** CSS 색 → 0~1 셋. '#rgb' · '#rrggbb' · 'rgb(…)', 그 밖은 캔버스에게 물어 고친다 */
export function rgb01(c: string): [number, number, number] {
  let s = c.trim();
  if (!/^#|^rgb/i.test(s) && typeof document !== 'undefined') {
    const x = document.createElement('canvas').getContext('2d');
    if (x) { x.fillStyle = s; s = String(x.fillStyle); }
  }
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (h) {
    const v = h[1].length === 3 ? h[1].split('').map((d) => d + d).join('') : h[1];
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number];
  }
  const m = /rgba?\(([^)]+)\)/i.exec(s);
  if (m) { const [a, b, d] = m[1].split(',').map((v) => parseFloat(v) / 255); return [a || 0, b || 0, d || 0]; }
  return [1, 1, 1];
}
