import type { FontFamily } from '../types';

/**
 * 말풍선 네 모양.
 *
 * 그동안 메시지는 라운드 사각형 한 가지였다. 벽에서 그건 '패널'로 읽히지
 * '말'로는 안 읽힌다. 그래서 윤곽 자체를 말풍선으로 바꾼다.
 *
 * 모양은 **02에서 고른 성격이 정한다.** 시스템이 추천하는 것이 아니라,
 * 발화자가 이미 명시적으로 고른 값이 형식으로 이어지는 것이다.
 *
 * ── 왜 경로를 수식으로 내는가 ─────────────────────────────────────────
 * 몸통(채움)과 물결(선)이 **같은 윤곽**이어야 한 몸으로 읽힌다. 경로를
 * 손으로 적어 두 군데 두면 하나가 반드시 어긋난다. 여기서 한 번 내서
 * 둘이 같은 문자열을 쓴다.
 *
 * 화판은 240×240. 꼬리까지 이 안에 든다 — 벽에 여러 개가 뜰 때 꼬리가
 * 화판 밖으로 나가면 옆 말풍선을 침범한다.
 */

const CX = 120, CY = 108;                       // 몸통 중심. 꼬리 자리를 아래에 남긴다
const rad = (deg: number) => (deg * Math.PI) / 180;
type Pt = readonly [number, number];
const P = (deg: number, r: number): Pt => [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))];
const n1 = (v: number) => Math.round(v * 10) / 10;
const pts = (list: readonly Pt[]) => list.map(p => `${n1(p[0])} ${n1(p[1])}`);

/** 두 원이 만나는 두 점. 앞이 왼쪽(x 작은 쪽), 뒤가 오른쪽 */
function meet(c1: Pt, r1: number, c2: Pt, r2: number): [Pt, Pt] {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const mx = c1[0] + (a * dx) / d, my = c1[1] + (a * dy) / d;
    const p: Pt = [mx + (h * dy) / d, my - (h * dx) / d];
    const q: Pt = [mx - (h * dy) / d, my + (h * dx) / d];
    return p[0] <= q[0] ? [p, q] : [q, p];
}

/** 꼭짓점 목록을 닫힌 다각형으로 */
function poly(list: readonly Pt[]): string {
    const [head, ...rest] = pts(list);
    return `M ${head} L ${rest.join(' L ')} Z`;
}

/** 뾰족한 별 — 18갈래. 한 갈래만 길게 빼서 꼬리로 쓴다(아래, 110°).
    꼬리 자리를 홀수(짧은 쪽) 이웃 사이에 두어야 밑동이 좁아지고 꼬리로 읽힌다 */
function spiky(): string {
    const n = 18, step = 360 / n, outer = 106, inner = 80, tail = 10;
    const list: Pt[] = [];
    for (let i = 0; i < n; i++) {
        const near = i === tail - 1 || i === tail + 1;                 // 꼬리 양 옆은 더 깊이 판다
        list.push(P(-90 + i * step, i === tail ? 138 : near ? 64 : (i % 2 ? inner : outer)));
    }
    return poly(list);
}

/**
 * 구름 — 아홉 덩이. 꼬리도 구름이다.
 *
 * 꼬리를 삼각형으로 빼면 몸통과 다른 어휘가 된다. 대신 점점 작아지는
 * 동그라미 셋을 아래로 늘어놓고 **그 합집합의 윤곽**을 따라간다 —
 * 이웃한 두 원이 만나는 점에서 다음 원으로 갈아타면 된다.
 */
function cloud(): string {
    const n = 9, step = 360 / n, base = 84, bump = 116, tail = 4;
    const v = (i: number) => P(-90 + (i % n) * step, base);
    const O: Pt = [CX, CY];
    const dot: Array<{ c: Pt; r: number }> = [
        { c: P(90, 72), r: 34 }, { c: P(90, 94), r: 24 }, { c: P(90, 112), r: 15 }
    ];
    /** 몸통 → 오른쪽으로 내려가 꼭지를 돌아 왼쪽으로 올라온다 */
    function tailArc(): string {
        const join: Array<[Pt, Pt]> = [meet(O, base, dot[0].c, dot[0].r)];
        for (let i = 0; i < dot.length - 1; i++) join.push(meet(dot[i].c, dot[i].r, dot[i + 1].c, dot[i + 1].r));
        const last = dot[dot.length - 1];
        let d = ` L ${pts([join[0][1]])[0]}`;
        for (let i = 0; i < dot.length - 1; i++) d += ` A ${dot[i].r} ${dot[i].r} 0 0 0 ${pts([join[i + 1][1]])[0]}`;
        d += ` A ${last.r} ${last.r} 0 1 0 ${pts([join[dot.length - 1][0]])[0]}`;
        for (let i = dot.length - 2; i >= 0; i--) d += ` A ${dot[i].r} ${dot[i].r} 0 0 0 ${pts([join[i][0]])[0]}`;
        return d;
    }
    let d = `M ${pts([v(0)])[0]}`;
    for (let i = 0; i < n; i++) {
        const next = pts([v(i + 1)])[0];
        if (i === tail) d += tailArc() + ` L ${next}`;
        else d += ` Q ${pts([P(-90 + (i + 0.5) * step, bump)])[0]} ${next}`;
    }
    return d + ' Z';
}

/**
 * 타원 — 만화 말풍선 그대로.
 *
 * 몸통은 세로보다 가로가 넓고(114:86), 꼬리는 아래 가운데가 아니라 **왼쪽
 * 아래로 쓸려 내려간다.** 대칭으로 달면 물방울이 되고, 물방울은 말이 아니다.
 *
 * 꼬리의 두 변은 하는 일이 다르다. 나가는 변은 몸통에서 거의 곧게 떨어지고,
 * 돌아오는 변은 길게 쓸어 올라가 몸통 바닥에 합류한다 — 그 비대칭이
 * '말이 새어 나온 자리'로 읽히게 한다.
 */
function oval(): string {
    const rx = 114, ry = 86, cy = 100;
    const at = (deg: number): Pt => [CX + rx * Math.cos(rad(deg)), cy + ry * Math.sin(rad(deg))];
    const a = at(125), b = at(88);
    // sweep 0 = 각도가 줄어드는 쪽. 88° → 0° → -90°(위) → 180° → 125°, 큰 호
    return `M ${pts([b])[0]} A ${rx} ${ry} 0 1 0 ${pts([a])[0]}`
        + ` C 46 192 42 216 42 238 C 66 226 96 206 ${pts([b])[0]} Z`;
}

/** 계단 — 네 변이 네모지게 물린다. 꼬리도 계단으로 내려간다 */
function steps(): string {
    const x0 = 18, x1 = 222, y0 = 14, y1 = 194, amp = 11;
    const edge = (from: Pt, to: Pt, k: number): Pt[] => {
        const dx = (to[0] - from[0]) / k, dy = (to[1] - from[1]) / k;
        const len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len;   // 시계방향 바깥쪽
        const out: Pt[] = [];
        for (let i = 0; i < k; i++) {
            const o = i % 2 ? amp : 0;
            out.push([from[0] + dx * i + nx * o, from[1] + dy * i + ny * o]);
            out.push([from[0] + dx * (i + 1) + nx * o, from[1] + dy * (i + 1) + ny * o]);
        }
        return out;
    };
    // 아랫변만 요철을 두지 않는다 — 옆변과 같이 물리면 꼬리가 그중 하나로 묻힌다
    const tail: Pt[] = [[152, y1], [152, 210], [134, 210], [134, 226], [116, 226], [116, 240], [98, 240], [98, y1]];
    return poly([
        ...edge([x0, y0], [x1, y0], 7),
        ...edge([x1, y0], [x1, y1], 6),
        [x1, y1], ...tail, [x0, y1],
        ...edge([x0, y1], [x0, y0], 6)
    ]);
}

export interface Bubble {
    key: string;
    label: string;
    /** 240×240 화판 안의 닫힌 윤곽. 몸통과 물결이 같이 쓴다 */
    d: string;
    /** 글이 들어가는 안전 영역 — 화판 대비 %(폭·높이)와 세로 중심 */
    inset: { w: number; h: number; cy: number };
}

export const BUBBLES: Record<string, Bubble> = {
    spiky: { key: 'spiky', label: '뾰족', d: spiky(), inset: { w: 66, h: 58, cy: 45 } },
    cloud: { key: 'cloud', label: '구름', d: cloud(), inset: { w: 70, h: 62, cy: 45 } },
    oval: { key: 'oval', label: '타원', d: oval(), inset: { w: 82, h: 60, cy: 40 } },
    steps: { key: 'steps', label: '계단', d: steps(), inset: { w: 78, h: 68, cy: 43 } }
};

/** 성격 → 모양. 당당한=뾰족 · 차분한=타원 · 다정한=구름 · 발랄한=계단 */
const BY_FONT: Record<string, string> = { ttoryeot: 'spiky', chabun: 'oval', doran: 'cloud', deulseok: 'steps' };

export function bubbleFor(font?: FontFamily | string): Bubble {
    return BUBBLES[BY_FONT[font ?? ''] ?? 'oval'];
}
