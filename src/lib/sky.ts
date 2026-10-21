/**
 * 벽의 하늘 — 말이 놓이는 기반 규칙(2026-10-20, 결정 9 — 견본 kv/megaphone.html의 fanOf · ringOf). 메가폰은 소리를 부채꼴로 퍼뜨린다:
 * 하늘의 말(모인 채)은 기기를 중심으로 한 세 겹 호(결정 35 — 두 겹이었다)에 앉아 호의 결을 따라 3분의 1만큼 기운다. 결정 4의 '위에서부터 쌓기'(디자이너 —
 * 위에 몰아넣으면 안 읽힌다)와 '화면 절반' 꽉 참을 대신한다. 자리를 고르는 일은 이 파일 하나에 모았다.
 * 길이는 px(화면) — 말 좌표(u)의 점은 × u로 옮긴다. 견본의 px 값은 1280 × 720 기준이라 화면 크기에 비례.
 */
import { G, RF, type Dot } from './aggregate';

type P = [number, number];
/** [왼, 위, 오른, 아래](px) */
export type Box = [number, number, number, number];
export const SKY = {
  /** 하늘 말의 u — 벽 높이의 몫(결정 5: 글자 높이 ≈ 벽 높이의 2.2%, 1080 벽에서 27px → 결정 35에서 0.8배, 약 1.8%). 땅 · 스카이라인의
      점 간격도 이 값이라 함께 촘촘해진다(견본 그대로) */
  u: 0.0253 * 0.8,
  /** 하늘에 뜨는 수 — 한눈에 낱낱으로 읽히는 수(결정 8에서 10 → 결정 35에서 12, 디자이너 "더 많이 있어도 괜찮아 보여"). 세 겹 호에
      안 들어가면 그 전에도 가장 오래 떠 있던 말부터 터진다. 못 뜬 말은 기다림 줄에서 차례를 기다린다(WallSky 돌려 보이기) */
  max: 12,
  /** 천장 여백(높이의 몫, 견본 12px@720) · 좌우 끝 여백(폭의 몫, 16px@1280) */
  ceil: 12 / 720, side: 16 / 1280,
  /** 이웃이 호를 따라 미끄러지는 시간(초, easeInOut — 결정 4에서 다시 올라붙던 시간) */
  move: 0.8,
  /** 몸통 상자는 '하늘 가운데 이 높이에서의 꼬리'로 잰다(높이의 몫, 견본 120px@720) — 꼬리 방향이 자리마다 조금씩 달라서 */
  probe: 120 / 720,
  /** 기기 — 벽 아래 가운데 바깥(높이의 몫, 30px@720) */
  devDrop: 30 / 720
} as const;

/** 점 간격 칸 → [위끝, 아래끝](px, 말 원점 기준) — 몸통 + 꼬리 밑동 3분의 1(t ≤ 0.35) */
export type Profile = Map<number, [number, number]>;
export function profileOf(dots: readonly Dot[], u: number): Profile {
  const m: Profile = new Map();
  for (const d of dots) {
    if ((d.t ?? 0) > 0.35) continue;
    const c = Math.round(d.x / G), r = RF * d.r, v = m.get(c) ?? [Infinity, -Infinity];
    v[0] = Math.min(v[0], (d.y - r) * u); v[1] = Math.max(v[1], (d.y + r) * u);
    m.set(c, v);
  }
  return m;
}
/** 몸통 상자(px, 말 원점) — 윤곽의 칸들 ± 메움 반지름 */
export function bodyOf(prof: Profile, u: number): Box {
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [c, [t, w]] of prof) { b[0] = Math.min(b[0], (c * G - RF) * u); b[2] = Math.max(b[2], (c * G + RF) * u); b[1] = Math.min(b[1], t); b[3] = Math.max(b[3], w); }
  return b;
}
/** 점을 r(라디안)만큼 돌린다 */
export const turn = ([x, y]: readonly number[], r: number): P => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];

/**
 * 부채꼴(결정 9 · 35) — 기기 중심 타원 세 겹(가로 · 세로 반지름은 화면 배수, 각은 도 — 270° = 바로 위). 읽는 차례(자리 번호)대로 바깥 호
 * 왼→오, 다음은 가운데 호, 나머지는 안 호. 나눔은 바깥 · 가운데 · 안 = 4 · 3.5 · 2.5할에서 시작해 안 들어가면 가까운 나눔부터(견본 순서 —
 * 같은 거리면 바깥 · 가운데가 적은 쪽 먼저). 두 겹(바깥 6할)으로는 최대를 올려도 8개 남짓만 떴다(결정 35 견본). 말마다 기기에서
 * 본 폭만큼 각을 차지하고 남는 각을 사이사이 고르게(폭이 자리마다 달라 네 번 맞춘다). 말 사이(다른 호와도) 적어도 1.2u, 아래는 벽 높이
 * 0.86(작은 사람 머리 위)까지 — 못 지키면 그 호의 양 끝을 3°씩 좁혀 다시(20°까지). 기울기 = (호 위 각 − 270°) × 1/3
 */
export const FAN = { rings: [{ a: 0.5, b: 0.97, from: 200, to: 340 }, { a: 0.4, b: 0.75, from: 196, to: 344 }, { a: 0.3, b: 0.52, from: 206, to: 334 }], share: [0.4, 0.35], gap: 1.2, low: 0.86, tilt: 1 / 3, shrink: 3, min: 20, fit: 4 } as const;
/** 부채꼴에 앉을 말 — 몸통 상자(px, 기울기 전) · 자리 번호 */
export interface Seated { body: Box; slot: number }
export interface Seat { pos: P; rot: number }
export function fanOf<T extends Seated>(list: readonly T[], W: number, H: number, u: number): Map<T, Seat> | null {
  const dev: P = [W / 2, H * (1 + SKY.devDrop)], side = SKY.side * W, ceil = SKY.ceil * H, low = FAN.low * H, gap = FAN.gap * u;
  const inside = (b: Box) => b[0] >= side && b[2] <= W - side && b[1] >= ceil && b[3] <= low;
  const apart = (a: Box, b: Box) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3])) >= gap;
  // 호 위 각 t에 앉힌 자리 — 기운 몸통 상자의 바깥 상자, 그 가운데가 호 위에
  const seat = (body: Box, R: (typeof FAN.rings)[number], t: number) => {
    const rot = (FAN.tilt * (t - 270) * Math.PI) / 180, a = (t * Math.PI) / 180;
    const cs = [[body[0], body[1]], [body[2], body[1]], [body[0], body[3]], [body[2], body[3]]].map((c) => turn(c, rot));
    const r: Box = [Math.min(...cs.map((c) => c[0])), Math.min(...cs.map((c) => c[1])), Math.max(...cs.map((c) => c[0])), Math.max(...cs.map((c) => c[1]))];
    const pos: P = [dev[0] + R.a * W * Math.cos(a) - (r[0] + r[2]) / 2, dev[1] + R.b * H * Math.sin(a) - (r[1] + r[3]) / 2];
    return { pos, rot, box: [pos[0] + r[0], pos[1] + r[1], pos[0] + r[2], pos[1] + r[3]] as Box };
  };
  const width = (b: Box) => { const as = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => ((Math.atan2(y - dev[1], x - dev[0]) * 180) / Math.PI + 360) % 360); return Math.max(...as) - Math.min(...as); };
  const row = (items: readonly T[], R: (typeof FAN.rings)[number], taken: readonly Box[]) => {
    for (let a0: number = R.from, a1: number = R.to; a1 - a0 > FAN.min; a0 += FAN.shrink, a1 -= FAN.shrink) {
      let ts = items.map((_, i) => a0 + ((i + 0.5) * (a1 - a0)) / items.length);
      for (let k = 0; k < FAN.fit; k++) {
        const ws = items.map((g, i) => width(seat(g.body, R, ts[i]).box)), g = (a1 - a0 - ws.reduce((p, q) => p + q, 0)) / (items.length + 1);
        if (g < 0) break;
        let t = a0 + g;
        ts = ws.map((w) => { const c = t + w / 2; t += w + g; return c; });
      }
      const seats = items.map((g, i) => seat(g.body, R, ts[i]));
      if (seats.every((s, i) => inside(s.box) && taken.every((o) => apart(s.box, o)) && (!i || apart(s.box, seats[i - 1].box)))) return seats;
    }
    return null;
  };
  const sorted = [...list].sort((a, b) => a.slot - b.slot), N = sorted.length;
  // 나눔 [바깥 끝, 가운데 끝] — 바깥 · 가운데 몫에서 먼 만큼 뒤로
  const off = ([a, b]: number[]) => Math.abs(a - N * FAN.share[0]) + Math.abs(b - a - N * FAN.share[1]);
  const cuts = [...Array(N + 1).keys()].flatMap((a) => [...Array(N - a + 1).keys()].map((k) => [a, a + k])).sort((p, q) => off(p) - off(q));
  for (const [a, b] of cuts) {
    const out = new Map<T, Seat>(), taken: Box[] = [];
    const ok = [sorted.slice(0, a), sorted.slice(a, b), sorted.slice(b)].every((items, ri) => {
      if (!items.length) return true;
      const seats = row(items, FAN.rings[ri], taken);
      seats?.forEach((s, i) => { out.set(items[i], { pos: s.pos, rot: s.rot }); taken.push(s.box); });
      return !!seats;
    });
    if (ok) return out;
  }
  return null;
}

/**
 * 소리의 결(결정 9 · 11) — 도킹 때 메가폰처럼 격렬하게. 벽(WallSky)과 폰 07이 같은 박자로 그린다. 벽은 평소에도 얕게 난다(결정 49 —
 * 아래 IDLE · idleWavesAt. 폰 07은 그대로 도킹 때만).
 * 쏟아짐: 결 사이 k 0.2 · 빠르기 k 0.5/초(0.4초마다 하나) · 세기 1.4 · 도킹 0.3초 뒤부터 1초에 차오르고, 잦아들 때는 0.7초(벽은 모임).
 * 한 방: 도킹 순간 세기 4 · 1초, 글자가 설 때마다 세기 2.2 · 1.5초(easeOut). k 0.12까지 생겨나고 1.45 앞 0.45에서 잦아든다.
 * 벽: 기기 중심 타원(부채꼴 바깥 호 × k) · 선 높이/540 × 세기 · --grey-600, 지나가면 하늘 말이 덜컥(0.3u × Σ(정도 × min(세기, 3) ×
 * exp(−((결의 k − 말의 k) / 0.04)²))). 폰: 화면 아래 바깥이 중심인 원(높이 0.9 × k) · 2px × 세기 · --paper · 0.45배 옅게.
 * 선은 둥근 점 점선으로 긋는다(결정 53 — 아래 DOTS · waveArc, 점 지름 = 선 굵기 × 2.2)
 */
export const WAVE = { gap: 0.2, v: 0.5, end: 1.45, born: 0.12, fade: 0.45, stream: 1.4, pour: 0.3, fill: 1, calm: 0.7,
  first: { s: 4, dur: 1 }, letter: { s: 2.2, dur: 1.5 }, line: 1 / 540, bob: 0.3, sig: 0.04 } as const;
export type Wave = { k: number; s: number; a: number };
const clamp = (k: number) => Math.min(1, Math.max(0, k));
/** 지금 지나는 결 — t = 도킹 장면이 열린 뒤 초, letters = 글자마다 다 쌓인 때(초, dockPlanOf의 modDone), calm = 쏟아짐이 잦아들기 시작하는 때(초) */
export function wavesAt(t: number, letters: readonly number[], calm = Infinity): Wave[] {
  const out: Wave[] = [], pour = clamp((t - WAVE.pour) / WAVE.fill) * (1 - clamp((t - calm) / WAVE.calm));
  if (pour > 0) for (let k = (t * WAVE.v) % WAVE.gap; k < WAVE.end; k += WAVE.gap) out.push({ k, s: WAVE.stream, a: pour });
  const hit = (T0: number, p: { s: number; dur: number }) => { if (t >= T0 && t < T0 + p.dur) out.push({ k: WAVE.end * (1 - (1 - (t - T0) / p.dur) ** 3), s: p.s, a: 1 }); };
  hit(0, WAVE.first);
  for (const x of letters) hit(x, WAVE.letter);
  return out;
}
/** 결이 보이는 정도 — 생겨나고 잦아드는 것 × 그 결의 정도 */
export const waveAlpha = (w: Wave) => clamp(w.k / WAVE.born) * clamp((WAVE.end - w.k) / WAVE.fade) * w.a;

/**
 * 결의 점선(결정 53, 2026-10-22 디자이너 — "이 동심원 선도 우리가 … '원형 도트 반복 선'으로"). 02 십자선(결정 12)과 같은 둥근 점:
 * 점 지름 = 그 결의 선 굵기 × d, 점 사이(가운데에서 가운데) = 점 지름 × gap. 길이 0인 대시에 둥근 끝을 달면 점이 된다 — 점을 하나씩
 * 그리지 않고 선 한 번 긋는 값으로(파이). 가운데 각 mid에서 양쪽으로 half만큼, 둘로 나눠 그어 가운데에 점 하나가 선다.
 * 벽(평소 · 도킹) · 홈 · 폰 07이 이것 하나로 그린다. 견본 셋(고운 점 1.5 · 2 / 굵은 점 2.2 · 2 / 굵고 성긴 점 2.2 · 3) 중 굵고 성긴 점
 */
export const DOTS = { d: 2.2, gap: 3 } as const;
export function waveArc(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, mid: number, half: number, line: number) {
  const d = line * DOTS.d;
  g.lineWidth = d; g.lineCap = 'round'; g.setLineDash([0, d * DOTS.gap]);
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, mid, mid - half, true);
  g.moveTo(cx + rx * Math.cos(mid), cy + ry * Math.sin(mid));
  g.ellipse(cx, cy, rx, ry, 0, mid, mid + half);
  g.stroke();
}

/**
 * 평소의 얕은 결(결정 49, 2026-10-21 디자이너 — "도킹할 때에만 파동 동심원이 두둥 나오잖음. 평상시에도 하단 중앙에서 얕게 조금씩").
 * 도킹 결과 같은 꼴 · 자리 · 색에서, every마다 한 겹이 기기에서 생겨나 dur 동안 reach(바깥 호의 몫)까지 퍼지며 잦아든다. 시간은
 * --t-hold의 배수, 퍼짐은 ease(--ease-standard). 하늘 말을 덜컥이게 하지 않고, 도킹 · 끄기 창 · 움직임 줄이기 땐 없다(WallSky).
 * 폰 07은 평소에 결이 없다(wavesAt만 쓴다).
 * 견본 '가끔 한 번 · 숨 쉬듯 · 잔물결' 중 숨 쉬듯을 골랐고("좀 더 연속성이 있게 여러 겹이 나와도 될 듯 — 속도가 느려서 괜찮을 것"),
 * 그 빠르기로 겹을 촘촘히 한 셋(한 겹 · 2~3겹 · 4겹쯤) 중 가장 이어지는 것: --t-hold의 2배마다 한 겹이 8배에 걸쳐 가운데 호까지
 * 퍼진다 — 한 화면에 4겹쯤이 함께, 한 겹은 옅게(a), 도킹 결보다 조금 굵게(s)
 */
export const IDLE = { every: 2, dur: 8, reach: 0.92, a: 0.4, s: 1.2 } as const;
/** 평소의 결 — t = 페이지 시계(초) · hold = --t-hold(초) · ease = 퍼지는 꼴. 지금 지나는 겹들(나온 차례로) */
export function idleWavesAt(t: number, hold: number, ease: (k: number) => number): Wave[] {
  const v = IDLE, out: Wave[] = [], every = v.every * hold, dur = v.dur * hold;
  for (let n = Math.floor(t / every); n >= 0 && t - n * every < dur; n--) {
    const p = (t - n * every) / dur;
    out.push({ k: v.reach * ease(p), s: v.s, a: v.a * (1 - p) });
  }
  return out;
}

/**
 * 광각 퍼짐(결정 4) — 도킹하면 하늘 말들이 큰 말을 빙 둘러싼 고리(화면 가장자리 너머까지 — 잘려도 된다)로 퍼진다. 고리 = 화면 가운데
 * 중심, 가로 반지름 0.56 × 폭 · 세로 0.58 × 높이, 150°(왼쪽 아래)에서 위를 지나 30°(오른쪽 아래)까지 240°. x 차례(같으면 y)로 줄 세워
 * 고르게, 하나 건너 하나는 안쪽 고리(0.84배). 고리를 따라 기운다(회전 = (각 − 270°) × 0.12). 퍼지며 1.45배
 */
export const WIDE = { a: 0.56, b: 0.58, from: 150, sweep: 240, inner: 0.16, tilt: 0.12, grow: 1.45, t: 0.6 } as const;
export function ringOf<T extends { pos: P }>(list: readonly T[], W: number, H: number): Map<T, { to: P; rot: number }> {
  const m = new Map<T, { to: P; rot: number }>(), order = [...list].sort((p, q) => p.pos[0] - q.pos[0] || p.pos[1] - q.pos[1]);
  order.forEach((g, i) => {
    const ring = i % 2 ? 1 - WIDE.inner : 1, phi = ((WIDE.from + (WIDE.sweep * (i + 0.5)) / order.length) * Math.PI) / 180;
    m.set(g, { to: [W / 2 + WIDE.a * W * ring * Math.cos(phi), H / 2 + WIDE.b * H * ring * Math.sin(phi)], rot: (phi - 1.5 * Math.PI) * WIDE.tilt });
  });
  return m;
}
