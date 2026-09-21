import { useEffect, useRef } from 'react';
import { charPos } from '../character/pos';
import { says } from '../character/says';

/**
 * 배경을 흘러가는 말들.
 *
 * ── 누구의 말인가 ─────────────────────────────────────────────────────
 * 캐릭터의 혼잣말이 아니다. 'AaBbCc'나 '음…' 같은 것을 뱉고 있었는데 그건
 * 이 물건이 **제 이야기**를 하는 것이다. 여기서 흘러야 하는 것은 **닿은
 * 사람들이 맡긴 말**이다 — 배경에서 지나간 사람들이 남기고 간 것.
 *
 * ── 시계가 아니라 사람이 띄운다 (2026-09-21) ──────────────────────────
 * 그 전까지는 메가폰트가 돌아서고 3.2초 뒤에 첫 말, 그 뒤로는 3.4~7초마다
 * 하나씩 **시계가** 띄웠다. 그러면 누가 한 말인지가 없다 — 걷던 사람이
 * 메가폰트 앞에서 빨개지는 것과 화면에 글이 뜨는 것이 서로 모르는 채
 * 따로 돌았다. 아무도 앞에 없는데 말이 흐르기도 했다.
 *
 * 이제 차례가 하나다:
 *
 *   들어온다 → 메가폰트 앞에 선다 → 하늘색이 빨강이 된다 → 그때 말이 뜬다
 *
 * HomeCrowd가 빨개지는 순간 says에 자리를 적고, 여기서 프레임마다 비워
 * 가며 **그 머리 위에서** 말을 띄운다. 그래서 말은 늘 누군가의 말이고,
 * 사람이 없으면 화면도 조용하다.
 *
 * 첫 말은 '안녕하세요'다. 맨 처음 한 사람이 발화자가 되는 자리라, 거기서
 * 구호가 먼저 나오면 이 물건이 무엇을 시키는 것처럼 읽힌다.
 *
 * 이것은 **처음 들어올 때 한 번만 도는 메가폰트의 인사**와 다른 것이다.
 * 그쪽은 나팔이 제 입으로 하는 인사(HomeCharacter)이고, 이쪽은 지나가던
 * 사람이 남기고 가는 말이다.
 *
 * ── 나팔에서 나오지 않는다 (2026-09-20) ───────────────────────────────
 * 그 전까지는 캐릭터 한가운데에서 솟아 위로 올랐다. 나오는 자리가 몸 위라
 * **실루엣에 걸려** 한 줄이 반쯤 지워진 채로 읽혔다. 층을 올려 몸 위로
 * 띄워 봤지만(z 700) 그건 더 나빴다 — 배경이어야 할 것이 캐릭터 얼굴을
 * 가로질러 지나갔다.
 *
 * 자리를 옮기는 대신 **역할을 옮겼다.** 이제 이것들은 나팔의 말이 아니라
 * **배경 그 자체**다. 층은 맨 뒤(0)라 캐릭터와 구경꾼 뒤로 지나간다 —
 * 가리는 것이 아니라 **뒤를 지나는 것**이라, 겹치는 순간이 깊이로 읽힌다.
 *
 * 곡선도 파동도 없다. 곧은 선이라야 눈이 따라가지 않는다. 방향은 여전히
 * 오른쪽 하나다 — 태어나는 자리만 화면 왼쪽 밖에서 **말한 사람 위**로
 * 옮겼다.
 *
 * ── 위계를 낮춘 방법 ──────────────────────────────────────────────────
 * 색(--grey-300) · 크기(액자 폭의 2.5~3.8%) · 느린 속도(가로지르는 데
 * 18~30초) 셋이 같이 한다. 한 글자씩 찍히던 것은 걷어냈다 — 찍히는 것은
 * 눈을 끄는 일이라, 배경으로 물러난 자리에서는 앞의 셋을 도로 무른다.
 *
 * 깊이도 셋이 같이 간다. 멀수록 작고 옅고 느리다.
 */

/**
 * 동시에 살아 있을 수 있는 말의 수.
 *
 * 다섯이었다. 시계가 띄울 때는 쉼을 3.4~7초로 잡아 두었으니 다섯이면
 * 넘칠 일이 없었는데, 사람이 띄우기 시작하자 **몰리는 때**가 생겼다 —
 * 74초를 재는 동안 열여섯이 빨개졌고 그중 둘은 자리가 없어 말을 못 했다
 * (0.4~0.8초 간격으로 셋이 겹쳐 빨개지는 순간이 있다).
 *
 * 평균은 그대로 셋쯤이다(수명 15초 ÷ 간격 4.6초). 일곱은 **몰릴 때만**
 * 쓰이는 여유지 배경을 빽빽하게 만드는 값이 아니다. 빨개졌는데 아무 말도
 * 안 나오면 앞의 차례가 끊겨 보인다 — 그쪽이 더 나쁘다.
 */
const N = 7;
/** 화면 **폭만큼** 흐르는 데 걸리는 시간 (ms) — 멀리 있는 것이 느리다 */
const CROSS = { far: 30000, near: 18000 };
/**
 * 글자 크기 — 액자 폭에 대한 비율. 390 화면에서 9.8~14.8px.
 *
 * 3.4~5.2%(13.3~20.3px)에서 한 단계 내렸다(2026-09-20). 굵기는 700 그대로
 * 두고 크기만 줄이는 쪽을 골랐다 — 네 단계(지금·−15%·−27%·−40%)를 홈
 * 배경에 한 장으로 놓고 비교했고, −27%가 배경으로 물러나면서도 문장이
 * 읽히는 마지막 자리였다. −40%는 무슨 말인지 안 보인다.
 */
const SIZE = { far: 0.025, near: 0.038 };
/** 짙기 — .voice의 색에 이만큼을 곱한다 */
const INK = { far: 0.45, near: 1 };
/** 제목·버튼에서 이만큼은 비운다 (액자 높이의 비율) */
const GAP = 0.04;
/** 머리 끝에서 이만큼 띄워 앉힌다 (px). 붙으면 모자처럼 읽힌다 */
const ABOVE = 8;
/**
 * 스미고 빠지는 시간 (ms).
 *
 * 지나온 몫의 비율이 아니라 **시간**으로 잡는다. 태어나는 자리가 저마다
 * 달라서(왼쪽에 선 사람의 말은 375px, 오른쪽에 선 사람의 말은 147px을
 * 간다 — 재서 확인) 비율로 잡으면 짧은 것은 뜨자마자 지기 시작한다.
 */
const FADE = { in: 800, out: 1400 };

/**
 * 지나간 사람들이 맡기고 간 말.
 *
 * 벽에 오를 법한 한 줄들이다(design/line-length-2026-09-17.md의 열두 자
 * 안에 든다). 이 물건이 무엇을 받아 주는 자리인지 배경이 먼저 말한다.
 */
const VOICES = [
  '학생은 소모품이 아니다', '등록금 내고 자리 없다', '여기 누가 있었다',
  '도서관 자리 좀', '졸업은 언제 오나', '나 아직 안 죽었어',
  '우리는 여기 있습니다', '오늘 하루가 어땠는지', '밥 먹었어?',
  '말하지 않으면 아무도', '수업은 끝났는데', '이 학교는 우리 것이다',
  '왜?', '나도 모르니까', '한 줄을 남긴다'
];

/** 맨 처음 발화자가 되는 사람이 하는 말 */
const HELLO = '안녕하세요';

const mix = (lo: number, hi: number, k: number) => lo + (hi - lo) * k;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export default function HomeVoices() {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = wrap.current!;
    const frame = host.parentElement!;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const nodes = [...host.children] as HTMLElement[];

    type Voice = {
      el: HTMLElement; live: boolean; born: number; life: number;
      y: number; px: number; from: number; span: number; now: number; ink: number;
    };
    const pool: Voice[] = nodes.map((el) => ({
      el, live: false, born: 0, life: 0, y: 0, px: 0, from: 0, span: 0, now: 0, ink: 0
    }));

    /* 말이 흐르는 띠. 제목과 버튼을 액자 좌표로 재어 그 사이로 잡는다 —
       수치를 적어 두면 글자 크기가 바뀔 때 그 줄이 먼저 죽는다. 버튼과
       제목은 맨 위 층(1000)이라 거기까지 가면 도로 가려진다. */
    let band = { top: 0, bottom: 0 };
    /**
     * 비워 둘 자리 — **참여 안내**가 서는 곳이다.
     *
     * 읽어야 하는 글과 배경으로 흘러가는 글이 같은 높이에서 겹치면, 둘 다
     * 안 읽힌다. 안내는 밤하늘의 정해진 자리에 붙박여 있으므로(app.css의
     * .home-char-say) 그 칸을 통째로 비우고 위아래로만 흘린다.
     */
    let keep = { top: 0, bottom: 0 };
    const measure = () => {
      const f = frame.getBoundingClientRect();
      const sub = frame.querySelector('.home-subtitle')?.getBoundingClientRect();
      const gate = frame.querySelector('.home-gate')?.getBoundingClientRect();
      const top = (sub ? sub.bottom - f.top : f.height * 0.24) + f.height * GAP;
      const bottom = (gate ? gate.top - f.top : f.height * 0.82) - f.height * GAP;
      band = { top, bottom: Math.max(top, bottom) };
      /* 안내는 지평선 위로 두 줄까지 선다. 그 높이를 실제로 재지 않고
         칸으로 잡는 이유: 안내는 몇 초만 떠 있다가 사라지는데, 자리를
         그때그때 재면 뜰 때마다 흐르는 줄이 비켜나 화면이 들썩인다. */
      keep = { top: f.height * 0.2, bottom: f.height * 0.36 };
    };
    measure();
    window.addEventListener('resize', measure);

    /**
     * 이 높이에 지금 끼어들 수 있는가.
     *
     * 다 같이 오른쪽으로 가므로 위험한 것은 **왼쪽에 있는 먼젓번 말**이다 —
     * 그것이 더 빠르면 따라잡아 두 줄이 한 줄로 겹쳐 읽힌다. 비슷한 높이에
     * 그런 것이 하나라도 있으면 이 자리는 비운다.
     */
    const clear = (y: number, px: number, right: number) =>
      !pool.some((v) =>
        v.live && Math.abs(v.y - y) < Math.max(px, v.px) * 1.3 && v.now < right + 40);

    /** 말 하나를 띄운다. at은 방금 빨개진 사람의 자리다 */
    const emit = (t: number, at: { x: number; top: number }) => {
      const p = pool.find((v) => !v.live);
      if (!p) return;

      // 깊이 하나가 크기·짙기·속도를 다 정한다. 0이 멀고 1이 가깝다.
      const depth = Math.random();
      const px = frame.clientWidth * mix(SIZE.far, SIZE.near, depth);
      const speed = frame.clientWidth / mix(CROSS.far, CROSS.near, depth);   // px/ms
      p.px = px;
      p.ink = mix(INK.far, INK.near, depth);
      p.el.style.fontSize = `${px.toFixed(1)}px`;

      /* 첫 말은 인사다. 그다음부터는 지금 떠 있지 않은 것 중에서 고른다 —
         열다섯 마디에 일곱까지 동시에 사는 구성이라 그냥 뽑으면 같은 줄이
         두 군데에 뜬다(60초를 지켜보는 동안 세 번 겹쳤다). */
      if (says.count === 0) {
        p.el.textContent = HELLO;
      } else {
        const onAir = pool.filter((v) => v.live).map((v) => v.el.textContent);
        const free = VOICES.filter((v) => !onAir.includes(v));
        p.el.textContent = pick(free.length ? free : VOICES);
      }

      // 말한 사람의 머리 위에 선다. 안내가 서는 칸이면 그 아래로 민다.
      const w = p.el.offsetWidth;
      let y = at.top - ABOVE - px;
      if (y + px > keep.top && y < keep.bottom) y = keep.bottom;
      y = clamp(y, band.top, band.bottom - px);

      const from = at.x - w / 2;
      /* 같은 높이가 막혀 있으면 한 줄씩 **위로만** 비켜 본다. 세 번까지.
         아래로는 안 비킨다 — 거기는 말한 사람의 몸이고, 이 층은 맨 뒤라
         태어나는 순간 그 몸에 가려 안 보인다. 뜨는 것이 안 보이면 누구의
         말인지가 끊긴다.

         세 번까지 해도 막히면 이번 말은 거른다. 없는 자리에 억지로 띄워
         두 줄이 겹치면 배경이 아니라 **오류**로 읽힌다 — 빨개지는 일은
         5초에 한 번쯤이라 곧 다음이 온다. */
      for (let n = 0; n < 3 && !clear(y, px, from + w); n++) {
        y = clamp(y - px * 1.8, band.top, band.bottom - px);
      }
      if (!clear(y, px, from + w)) return;

      p.y = y;
      // 태어난 자리에서 오른쪽 밖까지. 곧은 선이다.
      p.from = from;
      p.span = frame.clientWidth - from;
      p.life = p.span / speed;
      p.now = from;
      p.live = true;
      p.born = t;
      says.count += 1;
    };

    let raf = 0;
    const step = (t: number) => {
      /* 빨개진 사람이 있으면 그 수만큼 띄운다. 멈춤을 원하는 사람에게는
         구경꾼도 안 움직이므로 빨개지는 일 자체가 없지만, 쌓인 자리가
         남아 있지 않도록 여기서도 비운다. */
      if (!media.matches && charPos.ready) {
        while (says.queue.length) emit(t, says.queue.shift()!);
      } else {
        says.queue.length = 0;
      }

      for (const p of pool) {
        if (!p.live) continue;
        const age = (t - p.born) / p.life;
        if (age >= 1) {
          p.live = false;
          p.el.style.opacity = '0';
          continue;
        }
        // 뜰 때 스미고 질 때 빠진다 — 가장자리에서 툭 끊기지 않는다
        const lived = t - p.born;
        const fade = Math.min(1, lived / FADE.in, (p.life - lived) / FADE.out);
        p.now = p.from + p.span * age;
        p.el.style.opacity = (fade * p.ink).toFixed(3);
        p.el.style.transform = `translate(${p.now.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      says.queue.length = 0;
    };
  }, []);

  return (
    <div className="home-voices" ref={wrap} aria-hidden="true">
      {Array.from({ length: N }, (_, i) => <span className="voice" key={i} />)}
    </div>
  );
}
