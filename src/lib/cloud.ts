import { LINE_HEIGHT, type BoxShape } from './fit';
import { formFor, opticalFix } from './palettes';

/**
 * 발화 배경 — 구름.
 *
 * 글줄을 따라 **크기가 제각각인 원**을 놓고 그 합집합이 배경이 된다. 규칙과
 * 고른 이유는 design/cloud-rules.md, 시안은 design/cloud-*.png. 2026-09-22에
 * 네 모양 말풍선(bubbles.ts)을 이것으로 바꿨다.
 *
 * 여기는 **자리만** 정한다 — 원의 중심·반지름, 갈래, 글이 앉을 자리. 그리는
 * 일(번짐 필터·숨)은 CloudBubble이 한다. 단위는 u = 글자 한 칸(font-size)이라
 * 폰에서도 벽에서도 같은 모양이고, 씨앗이 글이라 같은 글은 언제나 같은 구름이다.
 *
 * 순서가 중요하다: **글이 먼저고 틀이 결과다.** 참여자가 정한 크기·줄바꿈을
 * 그대로 두고, 그 글 덩어리를 원들이 감싼다.
 */

/** 글과 윤곽 사이에 반드시 남는 자리 — 글자 한 칸의 배수. 말풍선 때와 같다 */
export const PAD = 0.7;
/**
 * 짧은 글(두 줄까지)의 최소 지름 — **0이다.**
 *
 * 시안(cloud-form.png)에서 고른 것은 11.4u였다. 벽 가로폭의 ¼로, 한마디가
 * 제 존재감을 갖게 하는 값이었고 그 격자에서는 글자 크기를 28px로 붙박아
 * 두고 봤다. 실제 앱에 넣으니 그 전제가 깨졌다 — 크기 축이 글자 크기를
 * 정하므로, 이 최소가 짧은 글의 구름을 12.63u까지 부풀려 **두 줄짜리
 * (12.58u)보다 크게** 만들었다. 말이 짧을수록 커지는 셈이다.
 *
 * 둘 다 가질 수 없어서 길이 쪽을 골랐다(2026-09-22). 존재감은 최소로 두고
 * 길이가 드러나게 한다. 글이 읽히는 데 필요한 자리는 이것이 아니라 PAD가
 * 지킨다 — 사방 0.7u는 여기서도 그대로다. 0이어도 6자 글의 구름은 10.67u로,
 * 글 폭(5.49u)의 두 배 가까이 된다. 덩이 반지름에 하한이 있기 때문이다.
 *
 * 되살리려면 cloudFor의 minDiameter로 준다 — 조율 격자가 그렇게 쓴다.
 */
export const B_MIN_DIAMETER = 0;

// ─── 움직임 (중 · 6초). 값의 근거는 design/cloud-rules.md ─────────────
/** 반지름이 부푸는 최대 비율. 8%는 멈춰 보였고 28%는 짧은 말에서 과했다 */
export const AMP = 0.16;
/** 파동 주기(초)와 그 위에 얹는 느린 결의 주기. 나눠떨어지지 않아 되돌아가는 자리가 없다 */
export const T1 = 6;
export const T2 = 9.7;
/** 파동 한 마루의 길이 (u). 위상은 자리다 — 왼쪽이 먼저 부풀고 오른쪽이 따라온다 */
export const LAMBDA = 8;
/** 조각이 옮겨 다니는 거리 (u). 조각만 자리를 옮긴다 */
export const DRIFT = 0.6;

export type Edge = 'spike' | 'smooth' | 'cumulus' | 'pixel' | 'stone';

export interface Persona {
  key: string;
  edge: Edge;
  /** 큰 덩이 반지름 — H(줄 반높이 + 여백)의 배수 범위 */
  lobe: readonly [number, number];
  /** 메우는 원 반지름 — H의 배수 범위 */
  fill: readonly [number, number];
  /** 큰 덩이 사이 (H 배수) */
  gap: number;
  /** 줄 끝 너머로 덩이를 더 두는 거리 (u) */
  spread: readonly [number, number];
  /** 작은 조각 개수 */
  sat: number;
  /** 번짐 (u) */
  blur: number;
  /** 당당한 — 갈래. 깊이(u) 범위 · 밑동 반폭(u) · 간격(u) */
  spike?: { depth: readonly [number, number]; base: number; gap: number };
  /** 유머있는 — 격자 한 칸 (u) */
  cell?: number;
  /** 차분한 — 날 선 돌. 원을 안 쓰고 다각형 하나다(stoneFor) */
  stone?: {
    /** 꼭짓점 수 범위 */
    corners: readonly [number, number];
    /** 꼭짓점 자리 흔들림(한 칸에 대한 비율) · 거리 흔들림(비율) */
    slot: number;
    reach: number;
    /** 모서리 굴림 (u) — 그리는 쪽(CloudBubble)이 쓴다 */
    round: number;
    /** 기울기 범위(도). 방향은 글마다 */
    tilt: readonly [number, number];
    /** 깨는 모서리 수 · 깨는 각도 범위(도) · 글 + 여백에서 비켜 지나는 거리(u) */
    crack: { count: number; angle: readonly [number, number]; clear: number };
    /** 빗금 — 바깥 법선 각도 범위(도, 0 = 오른쪽 · 90 = 아래) · 깊이 · 간격 · 굵기 (u) */
    hatch: { from: number; to: number; depth: number; gap: number; width: number };
  };
}

/**
 * 성격이 가장자리를 정한다. 구성은 하나다.
 * 값은 design/cloud-personality.png 격자에서 골랐다 — 고친 이유는 cloud-rules.md.
 */
export const PERSONAS: Record<string, Persona> = {
  // 뾰족 구름. 덩이 크고 대비 세게, 윤곽 위 둘레에만 갈래. 깊이 0.9·간격 1.2로
  // 33개였을 땐 해님이었다 — 줄이고 키웠다.
  ttoryeot: { key: 'ttoryeot', edge: 'spike', lobe: [1.25, 1.85], fill: [0.6, 0.8], gap: 1.9, spread: [0.2, 0.9], sat: 1, blur: 0.12,
    spike: { depth: [0.7, 1.3], base: 0.55, gap: 1.7 } },
  // 날 선 돌 (2026-09-27). 매끈한 덩이였다 — 성격의 짝이 돌·별·꽃·나비로 바뀌면서
  // 차분한이 먼저 돌이 됐다. 원을 안 써서 아래 lobe·fill·gap·spread는 쓰이지 않는다.
  // 값은 격자에서 골랐다 — 뭉툭 · 굴린 각 · 깎은 돌 중 날 선 각, 긴 글이 네모로 끌리던
  // 것은 기울이고 두 모서리를 깨서, 빗금은 둘레의 약 45%가 되게(design/landscape.md '돌').
  chabun: { key: 'chabun', edge: 'stone', lobe: [1.15, 1.35], fill: [0.75, 0.9], gap: 2.2, spread: [0, 0.3], sat: 0, blur: 0,
    stone: { corners: [6, 8], slot: 0.45, reach: 0.15, round: 0.12, tilt: [5, 10],
      crack: { count: 2, angle: [25, 65], clear: 0.3 },
      hatch: { from: -35, to: 125, depth: 0.6, gap: 0.2, width: 0.055 } } },
  // 뭉게구름 — 기준형.
  doran: { key: 'doran', edge: 'cumulus', lobe: [1.1, 1.6], fill: [0.5, 0.75], gap: 1.6, spread: [0, 0.9], sat: 3, blur: 0.12 },
  // 픽셀 구름. 같은 합집합을 0.5u 격자에 찍는다. 번짐은 모서리만 아주 살짝 —
  // 0.16칸에서는 계단이 흐려져 둥근 덩이에 잔털이 난 것이 됐다.
  deulseok: { key: 'deulseok', edge: 'pixel', lobe: [1.1, 1.6], fill: [0.55, 0.75], gap: 1.7, spread: [0, 0.8], sat: 2, blur: 0.04, cell: 0.5 }
};

/** 성격 → 구름. 옛 Firestore 문서의 서체 키는 fontMap과 같은 칸으로 보낸다 */
const BY_FONT: Record<string, string> = {
  ttoryeot: 'ttoryeot', chabun: 'chabun', doran: 'doran', deulseok: 'deulseok',
  gothic: 'ttoryeot', myeongjo: 'chabun', song: 'deulseok'
};
export function personaFor(font?: string): Persona {
  return PERSONAS[BY_FONT[font ?? ''] ?? 'chabun'];
}

/**
 * 글자 한 칸의 실제 폭 — 서체마다 다르다. 100px로 재서 나눈 값(2026-09-22).
 * 한글은 셋이 정확히 1em인데 핸드젯만 0.722em이다. 띄어쓰기는 셋이 0.35em,
 * 핸드젯 0.177em. 이걸 안 재고 '한 칸 = 1u'로 두면 핸드젯 글은 늘 여백이
 * 넉넉하고 장평 1.3의 다카포 글은 윤곽을 뚫는다.
 */
/* 2026-09-25에 다시 쟀다(서체가 다 받아진 뒤, 100px). 둥켈·본명조·핸드젯이
   표와 달랐다 — 둥켈 1 → 0.839(폭 축 700, 기본), 본명조 1 → 0.989, 핸드젯
   0.722 → 0.790(굵기·말투와 상관없이 같다). 먼저 잰 값은 서체가 덜 받아진
   채 대신 선 서체를 쟀던 것으로 보인다. 둥켈은 폭 축을 따라 넓어진다
   (1000에서 0.984) — advanceFor가 그 사이를 잇는다. */
const ADVANCE: Record<string, { hangul: number; space: number }> = {
  ttoryeot: { hangul: 0.839, space: 0.116 },
  chabun: { hangul: 0.989, space: 0.31 },
  doran: { hangul: 1, space: 0.35 },
  deulseok: { hangul: 0.79, space: 0.177 },
  botong: { hangul: 0.864, space: 0.251 }
};
/** 둥켈산스 폭 축 1000에서의 글자폭 */
const TTORYEOT_WIDE = { hangul: 0.984, space: 0.174 };
function advanceFor(key: string, wdth?: number) {
  const a = ADVANCE[key] ?? ADVANCE.botong;
  if (key !== 'ttoryeot' || !wdth) return a;
  const k = Math.min(1, Math.max(0, (wdth - 700) / 300));
  return { hangul: a.hangul + (TTORYEOT_WIDE.hangul - a.hangul) * k, space: a.space + (TTORYEOT_WIDE.space - a.space) * k };
}
const LATIN = 0.55;

export interface Circle {
  x: number; y: number; r: number;
  kind: 'lobe' | 'fill' | 'sat';
  /** 파동의 위상(자리)과 느린 결의 위상 — 0..1 */
  p1: number; p2: number;
  /** 조각만: 옮겨 다니는 방향과 위상 */
  sx: number; sy: number; p3: number; p4: number;
}
type Pt = readonly [number, number];
export interface Spike { lobe: number; pts: readonly [Pt, Pt, Pt] }
/** 한 변의 안쪽 띠 — 빗금이 들어갈 자리. 변의 두 끝과 안쪽으로 물러난 두 점 */
export type Quad = readonly [Pt, Pt, Pt, Pt];
/** 차분한의 돌. 원점 = 구름 상자 왼쪽 위, u 단위 */
export interface Stone {
  /** 꼭짓점 — 곧은 변으로 잇는다. 모서리 굴림은 그리는 쪽이 */
  pts: Pt[];
  /** 오른쪽 아래 안쪽 빗금의 띠들 */
  hatch: Quad[];
}

export interface Cloud {
  persona: Persona;
  rule: 'B' | 'C';
  /** 원점 = 구름 상자 왼쪽 위. u 단위 */
  circles: Circle[];
  /** 당당한의 갈래. 점은 제 덩이 중심 기준 — 덩이가 부풀면 같이 부푼다 */
  spikes: Spike[];
  /** 차분한의 돌. 있으면 circles · spikes는 비어 있다 */
  stone?: Stone;
  /** 구름 상자 (u) */
  w: number; h: number;
  /** 글 덩어리가 앉는 자리 (상자 안, u) */
  text: { x: number; y: number; w: number; h: number };
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 한 줄의 폭 (u). 한글·띄어쓰기·라틴을 따로 세고 광학 보정과 장평을 곱한다 */
function lineWidth(line: string, font: string | undefined, optic: number, scaleX: number, slant: number, wdth?: number, track = 0): number {
  const adv = advanceFor(BY_FONT[font ?? ''] ?? font ?? '', wdth);
  let w = 0;
  for (const ch of Array.from(line)) {
    if (ch === ' ') w += adv.space;
    else if (/[A-Za-z0-9.,!?'"-]/.test(ch)) w += LATIN;
    else w += adv.hangul;
    w += track;   // 자간은 글자마다 붙는다(차분한 -0.025em)
  }
  // 기운 글자는 위아래 끝이 옆으로 나간다 — 줄 높이의 반 × tan
  const lean = Math.abs(Math.tan((slant * Math.PI) / 180)) * LINE_HEIGHT * optic;
  return w * optic * scaleX + lean;
}

interface Options {
  /** 씨앗. 안 주면 글 자체 — 미리보기와 벽이 같은 구름을 봐야 한다 */
  seed?: string;
  /** 짧은 글의 최소 지름을 덮어쓴다 (u). 조율 격자가 쓴다 */
  minDiameter?: number;
  /** 장평 (03의 '빠르기') */
  scaleX?: number;
  /** 기울기 (도) */
  slant?: number;
  /** 세로 비율 (2026-09-25 표 — 당당한·유머있는·차분한의 한쪽 끝) */
  scaleY?: number;
  /** 둥켈산스 폭 축 */
  wdth?: number;
  /** 자간 (em) */
  track?: number;
}

/**
 * 조율 값 그대로 구름을 만든다 — 서체별 표(palettes.ts · formFor)가 계산한
 * 장평·세로·기울기·폭 축·자간을 넘긴다. 4/5와 벽이 같은 이 함수를 쓴다.
 */
export function cloudForTone(lines: readonly string[], tone: Parameters<typeof formFor>[0] | null | undefined, o: Pick<Options, 'seed' | 'minDiameter'> = {}): Cloud {
  if (!tone) return cloudFor(lines, undefined, o);
  const f = formFor(tone);
  return cloudFor(lines, tone.font, { ...o, scaleX: f.scaleX, scaleY: f.scaleY, slant: f.slant, wdth: f.wdth, track: parseFloat(f.letterSpacing) || 0 });
}

/**
 * 이 글의 구름.
 *
 * 차례: ① 줄마다 큰 덩이를 드문드문 ② 두 줄까지는 최소 지름을 채우는 큰 덩이
 * ③ 글 상자 + 여백의 테두리와 **안쪽**을 훑어 안 덮인 자리마다 작은 원(목)
 * ④ 조각 ⑤ 당당한이면 윤곽 위 둘레에 갈래.
 *
 * 같은 크기의 원을 촘촘히 두면 모서리만 둥근 상자가 된다(첫 시안). 윤곽의
 * 변화는 원의 크기 차이와 성김에서 온다.
 */
export function cloudFor(lines: readonly string[], font: string | undefined, o: Options = {}): Cloud {
  const pr = personaFor(font);
  const optic = opticalFix[font ?? '']?.scale ?? 1;
  const scaleX = o.scaleX ?? 1, slant = o.slant ?? 0;
  /* 세로 비율은 글 덩어리를 가운데에서 누른다 — 보이는 줄 높이가 그만큼 준다 */
  const LH = LINE_HEIGHT * optic * (o.scaleY ?? 1);        // 줄 높이 (u)
  const H = LH / 2 + PAD;                                  // 줄 위아래로 반드시 덮을 반높이
  const R = rng(hash((o.seed ?? lines.join('\n')) + '|' + pr.key));
  const pick = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * R();

  // 글 덩어리. 줄은 가운데 정렬 — VoiceBubble이 그렇게 앉힌다
  const widths = lines.map((l) => lineWidth(l, font, optic, scaleX, slant, o.wdth, o.track ?? 0));
  const TW = Math.max(0.5, ...widths), TH = Math.max(1, lines.length) * LH;
  const boxes = widths.map((w, i) => ({ x0: (TW - w) / 2, x1: (TW + w) / 2, yc: (i + 0.5) * LH }));
  const rule: 'B' | 'C' = boxes.length <= 2 ? 'B' : 'C';
  if (pr.edge === 'stone' && pr.stone) return stoneFor(pr, rule, TW, TH, R);

  const circles: Circle[] = [];
  const put = (x: number, y: number, r: number, kind: Circle['kind']) =>
    circles.push({ x, y, r, kind, p1: 0, p2: R(), sx: R() > 0.5 ? 1 : -1, sy: R() > 0.5 ? 1 : -1, p3: R(), p4: R() });
  const inside = (x: number, y: number) => circles.some((c) => Math.hypot(c.x - x, c.y - y) <= c.r);

  // ① 큰 덩이 — 줄마다 드문드문. C에서는 줄을 한 줄씩 위아래로 어긋내 줄이 제 덩이를 갖게 한다
  boxes.forEach((b, li) => {
    const a = b.x0 + 0.4, z = b.x1 - 0.4, len = Math.max(0, z - a);
    const k = Math.max(1, Math.round(len / (pr.gap * H)));
    const yj = rule === 'C' ? (li % 2 ? 1 : -1) * 0.15 : 0;
    for (let i = 0; i < k; i++) {
      const x = k === 1 ? (a + z) / 2 : a + (len * (i + 0.5 + (R() - 0.5) * 0.5)) / k;
      put(x, b.yc + yj + (R() - 0.5) * 0.5 * H, H * pick(pr.lobe), 'lobe');
    }
    const sl = pick(pr.spread), sr = pick(pr.spread);
    if (sl > 0) put(a - sl, b.yc + (R() - 0.5) * 0.8, H * pick(pr.lobe) * 0.85, 'lobe');
    if (sr > 0) put(z + sr, b.yc + (R() - 0.5) * 0.8, H * pick(pr.lobe) * 0.85, 'lobe');
  });

  // ② 짧은 글의 최소 자리. 긴 글에 쓰면 귀만 두 개 남고 아래가 좁아져 자루가 된다
  const cx = TW / 2, cy = TH / 2;
  if (rule === 'B') {
    const want = (o.minDiameter ?? B_MIN_DIAMETER) / 2;
    const ext = () => Math.max(...circles.map((c) => Math.hypot(c.x - cx, c.y - cy) + c.r));
    let guard = 0;
    while (ext() < want && guard++ < 12) {
      const t = R() * Math.PI * 2, r = want * (0.3 + 0.3 * R());
      put(cx + Math.cos(t) * (want - r), cy + Math.sin(t) * (want - r) * 0.9, r, 'lobe');
    }
  }

  // ③ 메움. 테두리만 훑으면 성긴 덩이 사이에 구멍이 남는다 — 차분한 다섯 줄에서
  //    글 사이에 검은 점이 났다. 안쪽 점은 바깥 방향이 없어 원이 그 자리에 앉는다.
  const need: Array<[number, number, number, number]> = [];
  for (const b of boxes) {
    const xa = b.x0 - PAD, xz = b.x1 + PAD, yt = b.yc - H, yb = b.yc + H;
    const n = Math.max(2, Math.ceil((xz - xa) / 0.35)), m = Math.max(2, Math.ceil((yb - yt) / 0.35));
    for (let i = 0; i <= n; i++) { const x = xa + ((xz - xa) * i) / n; need.push([x, yt, 0, -1], [x, yb, 0, 1]); }
    for (let j = 0; j <= m; j++) { const y = yt + ((yb - yt) * j) / m; need.push([xa, y, -1, 0], [xz, y, 1, 0]); }
    for (let j = 1; j < m; j++) for (let i = 1; i < n; i++) need.push([xa + ((xz - xa) * i) / n, yt + ((yb - yt) * j) / m, 0, 0]);
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const [x, y, nx, ny] of need) {
      if (inside(x, y)) continue;
      const r = H * pick(pr.fill);
      put(x - nx * r * 0.8, y - ny * r * 0.8, r, 'fill');   // 점을 덮되 중심은 안쪽으로
    }
  }

  // ④ 조각 — 붙거나 조금 떨어져서. 움직일 때 이것만 자리를 옮긴다
  for (let i = 0; i < pr.sat; i++) {
    const t = R() * Math.PI * 2;
    const base = circles[Math.floor(R() * circles.length)];
    const r = 0.22 + 0.45 * R();
    const gap = (R() * 1.5 - 0.3) * r;
    put(base.x + Math.cos(t) * (base.r + r + gap), base.y + Math.sin(t) * (base.r + r + gap), r, 'sat');
  }

  // ⑤ 갈래 — 윤곽 위에 선 둘레에만. 밑동은 원 안에 0.25u 물려 번짐이 합친다
  const spikes: Spike[] = [];
  if (pr.spike) {
    const sp = pr.spike;
    circles.forEach((c, ci) => {
      if (c.kind === 'sat') return;
      const n = Math.max(6, Math.round((2 * Math.PI * c.r) / sp.gap));
      const off = R() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const t = off + (i / n) * Math.PI * 2;
        const px = c.x + Math.cos(t) * c.r, py = c.y + Math.sin(t) * c.r;
        if (circles.some((o) => o !== c && o.kind !== 'sat' && Math.hypot(o.x - px, o.y - py) <= o.r - 0.05)) continue;
        const d = pick(sp.depth), b = sp.base;
        const ux = Math.cos(t), uy = Math.sin(t), tx = -uy, ty = ux;
        const r0 = c.r - 0.25;
        spikes.push({ lobe: ci, pts: [
          [ux * r0 + tx * b, uy * r0 + ty * b],
          [ux * (c.r + d), uy * (c.r + d)],
          [ux * r0 - tx * b, uy * r0 - ty * b]
        ] });
      }
    });
  }

  // 상자. 부풀었을 때(AMP)와 갈래·격자·번짐이 나갈 자리까지 넣는다
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = 1 + AMP;
  for (const c of circles) {
    const r = c.r * grow + (c.kind === 'sat' ? DRIFT : 0);
    minX = Math.min(minX, c.x - r); maxX = Math.max(maxX, c.x + r);
    minY = Math.min(minY, c.y - r); maxY = Math.max(maxY, c.y + r);
  }
  for (const s of spikes) {
    const c = circles[s.lobe];
    for (const p of s.pts) {
      minX = Math.min(minX, c.x + p[0] * grow); maxX = Math.max(maxX, c.x + p[0] * grow);
      minY = Math.min(minY, c.y + p[1] * grow); maxY = Math.max(maxY, c.y + p[1] * grow);
    }
  }
  const edge = pr.cell ? pr.cell * 1.6 : pr.blur * 2;
  minX -= edge; minY -= edge; maxX += edge; maxY += edge;

  // 파동의 위상은 자리다 — 상자 왼쪽에서 오른쪽으로. 구름마다 시작점을 어긋내
  // 벽에 열 개가 떠도 같은 박자로 안 뛴다.
  const phase0 = R();
  for (const c of circles) {
    c.x -= minX; c.y -= minY;
    c.p1 = (phase0 + c.x / LAMBDA) % 1;
  }
  return {
    persona: pr, rule, circles, spikes,
    w: maxX - minX, h: maxY - minY,
    text: { x: -minX, y: -minY, w: TW, h: TH }
  };
}

// ─── 차분한 — 날 선 돌 (2026-09-27) ──────────────────────────────────
// 고른 과정과 잰 결과는 design/landscape.md '돌'. 값은 PERSONAS.chabun.stone.

/** 다각형 안인가 (짝수-홀수 규칙) */
function inPolygon(x: number, y: number, P: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 반평면으로 자른다 — n·p ≤ c 쪽을 남긴다 (Sutherland–Hodgman) */
function clipHalf(P: readonly Pt[], nx: number, ny: number, c: number): Pt[] {
  const out: Pt[] = [];
  const side = (p: Pt) => nx * p[0] + ny * p[1] - c;
  for (let i = 0; i < P.length; i++) {
    const A = P[i], B = P[(i + 1) % P.length], da = side(A), db = side(B);
    if (da <= 0) out.push(A);
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
  }
  return out;
}

/** 네모의 둘레 위 점들 — 돌이 품어야 할 자리를 잰다 */
function rimOf(x0: number, y0: number, x1: number, y1: number, n = 12): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    p.push([x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]);
  }
  return p;
}

/**
 * 빗금 자리 — 바깥 법선이 from~to를 향한 변들의 한 줄기를 끝까지, 변마다 안쪽 depth의 띠.
 *
 * 줄기가 없으면 오른쪽 아래(45°)에 가장 가까운 변 하나로 — 글 200개로 재 보니 그런
 * 돌은 없었지만(2026-09-27), '늘 있다'는 약속을 운에 맡기지 않는다.
 */
function hatchBands(P: readonly Pt[], cx: number, cy: number, h: { from: number; to: number; depth: number }): Quad[] {
  const n = P.length;
  const edges = P.map((A, i) => {
    const B = P[(i + 1) % n], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1e-9;
    let nx = (B[1] - A[1]) / L, ny = -(B[0] - A[0]) / L;
    if (nx * ((A[0] + B[0]) / 2 - cx) + ny * ((A[1] + B[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    const ang = (Math.atan2(ny, nx) * 180) / Math.PI;
    return { A, B, nx, ny, ang, ok: ang >= h.from && ang <= h.to };
  });
  const start = edges.findIndex((e, i) => e.ok && !edges[(i - 1 + n) % n].ok);
  let run: typeof edges = [];
  if (start >= 0) for (let j = 0; j < n && edges[(start + j) % n].ok; j++) run.push(edges[(start + j) % n]);
  if (!run.length) run = [edges.reduce((m, e) => (Math.abs(e.ang - 45) < Math.abs(m.ang - 45) ? e : m))];
  return run.map(({ A, B, nx, ny }): Quad => [A, B, [B[0] - nx * h.depth, B[1] - ny * h.depth], [A[0] - nx * h.depth, A[1] - ny * h.depth]]);
}

/**
 * 차분한의 돌.
 *
 * 초타원(지수 3) 둘레에 꼭짓점을 흔들어 놓고 곧은 변으로 잇는다. 돌 전체를 기울이고,
 * 글 + 사방 여백을 다 품을 때까지 가운데에서 키운 뒤, 오른쪽 아래를 뺀 세 모서리 중
 * 둘을 깬다. 깨진 면은 글 + 여백에서 clear만큼 바깥을 지나 글을 다치지 않는다.
 *
 * 기울이고 깨는 것은 긴 글 때문이다 — 네다섯 줄의 글 덩어리는 네모라, 그걸 품는
 * 꼭짓점 여섯 개짜리 돌도 네모로 끌려갔다. 줄 수에 비례해 흔들기는 돌을 34%까지
 * 키웠고, 줄 따라 깎기는 네모를 더 잘 없앴지만 '깨진 돌'의 인상이 없었다.
 *
 * 원은 하나도 안 쓴다. 번지지도 숨 쉬지도 않는다 — 돌은 가만히 있다.
 */
function stoneFor(pr: Persona, rule: 'B' | 'C', TW: number, TH: number, R: () => number): Cloud {
  const s = pr.stone!;
  const cx = TW / 2, cy = TH / 2, a = TW / 2 + PAD, b = TH / 2 + PAD;
  const pick = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * R();
  const k = s.corners[0] + Math.floor(R() * (s.corners[1] - s.corners[0] + 1));
  const tilt = ((R() < 0.5 ? -1 : 1) * pick(s.tilt) * Math.PI) / 180;
  const off = R() * Math.PI * 2;
  const sup = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / 3);

  // 꼭짓점 — 초타원을 12% 넉넉히 잡고 자리와 거리를 흔든다
  let pts: Pt[] = [];
  for (let i = 0; i < k; i++) {
    const t = off + ((i + (R() - 0.5) * 2 * s.slot) / k) * Math.PI * 2;
    const m = 1 + (R() - 0.5) * 2 * s.reach;
    const x = a * 1.12 * sup(Math.cos(t)) * m, y = b * 1.12 * sup(Math.sin(t)) * m;
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  pts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));

  // 글 + 사방 여백을 다 품을 때까지 키운다
  const need = rimOf(-PAD, -PAD, TW + PAD, TH + PAD);
  for (let g = 0; g < 120 && !need.every(([x, y]) => inPolygon(x, y, pts)); g++) {
    pts = pts.map(([x, y]): Pt => [cx + (x - cx) * 1.02, cy + (y - cy) * 1.02]);
  }

  // 깨기 — 오른쪽 아래(빗금 자리)는 두고 나머지 셋 중 count곳, 사분면 안의 각도로
  const quads: Pt[] = [[-1, -1], [1, -1], [-1, 1]];
  for (let i = quads.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [quads[i], quads[j]] = [quads[j], quads[i]]; }
  for (const [sx, sy] of quads.slice(0, s.crack.count)) {
    const th = (pick(s.crack.angle) * Math.PI) / 180, ux = sx * Math.cos(th), uy = sy * Math.sin(th);
    pts = clipHalf(pts, ux, uy, Math.max(...need.map(([x, y]) => ux * x + uy * y)) + s.crack.clear);
  }
  // 자른 자리에 겹친 점이 남으면 길이 0인 변이 생긴다
  pts = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-4; });

  const hatch = hatchBands(pts, cx, cy, s.hatch);

  // 상자 — 원점을 왼쪽 위로. 가장자리가 잘리지 않게 조금 넉넉히
  const e = 0.05;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs) - e, minY = Math.min(...ys) - e;
  const mv = ([x, y]: Pt): Pt => [x - minX, y - minY];
  return {
    persona: pr, rule, circles: [], spikes: [],
    stone: { pts: pts.map(mv), hatch: hatch.map((q): Quad => [mv(q[0]), mv(q[1]), mv(q[2]), mv(q[3])]) },
    w: Math.max(...xs) + e - minX, h: Math.max(...ys) + e - minY,
    text: { x: -minX, y: -minY, w: TW, h: TH }
  };
}

/** fit.ts와 잇는 계약. 구름은 글이 정하므로 tw·th를 안 받고 제 상자를 답한다 */
export function cloudShape(cloud: Cloud): BoxShape {
  return {
    body: (_tw, _th, u) => ({ w: cloud.w * u, h: cloud.h * u }),
    tail: () => 0
  };
}
