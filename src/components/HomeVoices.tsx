import { useEffect, useRef } from 'react';
import { charPos } from '../character/pos';

/**
 * 배경을 흘러가는 말들.
 *
 * ── 누구의 말인가 ─────────────────────────────────────────────────────
 * 캐릭터의 혼잣말이 아니다. 'AaBbCc'나 '음…' 같은 것을 뱉고 있었는데 그건
 * 이 물건이 **제 이야기**를 하는 것이다. 여기서 흘러야 하는 것은 **닿은
 * 사람들이 맡긴 말**이다 — 배경에서 지나간 사람들이 남기고 간 것.
 *
 * ── 나팔에서 나오지 않는다 (2026-09-20) ───────────────────────────────
 * 그 전까지는 캐릭터 한가운데에서 솟아 위로 올랐다. 나오는 자리가 몸 위라
 * **실루엣에 걸려** 한 줄이 반쯤 지워진 채로 읽혔다. 층을 올려 몸 위로
 * 띄워 봤지만(z 700) 그건 더 나빴다 — 배경이어야 할 것이 캐릭터 얼굴을
 * 가로질러 지나갔다.
 *
 * 자리를 옮기는 대신 **역할을 옮겼다.** 이제 이것들은 나팔의 말이 아니라
 * **배경 그 자체**다. 화면 왼쪽 밖에서 들어와 곧은 가로선으로 오른쪽 밖까지
 * 간다. 층은 맨 뒤(0)라 캐릭터와 구경꾼 뒤로 지나간다 — 가리는 것이
 * 아니라 **뒤를 지나는 것**이라, 겹치는 순간이 깊이로 읽힌다.
 *
 * 곡선도 파동도 없다. 곧은 선이라야 눈이 따라가지 않는다.
 *
 * ── 위계를 낮춘 방법 ──────────────────────────────────────────────────
 * 색(--grey-300) · 크기(액자 폭의 2.5~3.8%) · 느린 속도(가로지르는 데
 * 18~30초) 셋이 같이 한다. 한 글자씩 찍히던 것은 걷어냈다 — 찍히는 것은
 * 눈을 끄는 일이라, 배경으로 물러난 자리에서는 앞의 셋을 도로 무른다.
 *
 * 깊이도 셋이 같이 간다. 멀수록 작고 옅고 느리다.
 */

/** 동시에 살아 있을 수 있는 말의 수 */
const N = 5;
/** 화면을 한 번 가로지르는 데 걸리는 시간 (ms) — 멀리 있는 것이 느리다 */
const CROSS = { far: 30000, near: 18000 };
/** 다음 말까지의 쉼 (ms) */
const REST = { min: 3400, max: 7000 };
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
/**
 * 가로줄 몇 개에 나누어 태운다.
 *
 * 자리를 매번 아무 데나 잡으면 둘이 같은 높이에 겹쳐 한 줄이 두 겹으로
 * 읽힌다. 줄을 나누어 두고, 한 줄은 먼젓번 말이 절반을 지날 때까지 비운다.
 */
const LANES = 5;
/** 제목·버튼에서 이만큼은 비운다 (액자 높이의 비율) */
const GAP = 0.04;
/**
 * 메가폰트가 돌아선 뒤 이만큼(ms) 있다가 첫 말이 뜬다.
 *
 * 차례가 있다: 인사가 끝나고 → 돌아서고 → 사람들이 걸어 들어오고 →
 * 그제야 배경에 말이 흐른다. 돌아서자마자 다 같이 시작하면 화면이 한
 * 박자에 통째로 살아나 무엇을 볼지가 없다. 구경꾼 둘셋이 들어온 뒤다.
 */
const AFTER_TURN = 3200;

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

const random = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const mix = (lo: number, hi: number, k: number) => lo + (hi - lo) * k;
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export default function HomeVoices() {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = wrap.current!;
    const frame = host.parentElement!;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const nodes = [...host.children] as HTMLElement[];

    type Voice = {
      el: HTMLElement; live: boolean; born: number; cross: number;
      y: number; from: number; span: number; ink: number;
    };
    const pool: Voice[] = nodes.map((el) => ({
      el, live: false, born: 0, cross: 0, y: 0, from: 0, span: 0, ink: 0
    }));

    /**
     * 말이 흐르는 띠.
     *
     * 위는 제목을, 아래는 **지평선**을 액자 좌표로 재어 그 사이로 잡는다 —
     * 수치를 적어 두면 글자 크기가 바뀔 때 그 줄이 먼저 죽는다.
     *
     * 아래가 지평선인 이유: 이 말들은 **하늘에 떠 있는 것**이다. 들판으로
     * 내려오면 땅 위를 흘러가는 글이 되고, 거기는 구경꾼들이 걷는 자리라
     * 배경끼리 겹친다. 전에는 버튼 윗선까지 썼는데 그러면 다섯 줄 중
     * 아래 둘이 초록 위로 내려왔다.
     */
    let band = { top: 0, height: 0 };
    /** 지평선. 글자 **아래 끝**이 이 선을 넘지 않는다 */
    let horizon = 0;
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
      /* 배경이 하늘과 들판으로 갈리는 선. app.css가 --horizon으로 들고
         있고 지금은 55%다. 값을 여기 베껴 적으면 둘 중 하나가 낡는다. */
      const hz = getComputedStyle(frame).getPropertyValue('--horizon').trim();
      horizon = f.height * ((parseFloat(hz) || 55) / 100);
      const top = (sub ? sub.bottom - f.top : f.height * 0.24) + f.height * GAP;
      const bottom = horizon - f.height * GAP;
      band = { top, height: Math.max(0, bottom - top) };
      /* 안내는 지평선 위로 두 줄까지 선다. 그 높이를 실제로 재지 않고
         칸으로 잡는 이유: 안내는 몇 초만 떠 있다가 사라지는데, 자리를
         그때그때 재면 뜰 때마다 흐르는 줄이 비켜나 화면이 들썩인다. */
      keep = { top: f.height * 0.2, bottom: f.height * 0.36 };
    };
    measure();
    window.addEventListener('resize', measure);

    /** 메가폰트가 돌아선 때. 여기서 AFTER_TURN을 세고 시작한다 */
    let turned = 0;
    /** 각 줄이 다시 비는 시각 */
    const laneFree = new Array(LANES).fill(0);
    /** 다음 말까지 남은 시간 */
    let nextEmit = 0;

    /**
     * 말 하나를 띄운다. head는 **이미 지나온 몫**(0~1)이다 — 화면이 처음
     * 서는 순간에만 쓴다. 다들 왼쪽 밖에서 출발하면 배경이 차오르는 데
     * 30초가 걸려서, 그동안 홈이 허전했다(재서 확인). 처음 몇은 이미
     * 가던 중이었던 것처럼 중간에 놓는다.
     */
    const emit = (t: number, head = 0) => {
      const p = pool.find((v) => !v.live);
      if (!p) return;
      const lh = band.height / LANES;
      const open = laneFree
        .map((free, i) => (free <= t ? i : -1))
        .filter((i) => i >= 0)
        // 안내가 서는 칸은 건너뛴다
        .filter((i) => {
          const mid = band.top + (i + 0.5) * lh;
          return mid < keep.top || mid > keep.bottom;
        });
      if (!open.length) return;
      const lane = pick(open);

      // 깊이 하나가 크기·짙기·속도를 다 정한다. 0이 멀고 1이 가깝다.
      const depth = Math.random();
      const px = frame.clientWidth * mix(SIZE.far, SIZE.near, depth);
      p.cross = mix(CROSS.far, CROSS.near, depth);
      p.ink = mix(INK.far, INK.near, depth);
      p.el.style.fontSize = `${px.toFixed(1)}px`;
      /* 지금 떠 있는 말은 다시 고르지 않는다. 열다섯 마디에 다섯이 동시에
         사는 구성이라 그냥 뽑으면 같은 줄이 두 군데에 뜬다 — 60초를 지켜
         보는 동안 세 번 겹쳤다. 겹치면 배경이 아니라 **오류**로 읽힌다. */
      const onAir = pool.filter((v) => v.live).map((v) => v.el.textContent);
      const free = VOICES.filter((v) => !onAir.includes(v));
      p.el.textContent = pick(free.length ? free : VOICES);

      // 줄 한가운데에 앉히고, 줄 높이의 5분의 1만큼만 흔든다
      p.y = band.top + lane * lh + (lh - px) / 2 + random(-lh, lh) * 0.1;
      /* 글자의 **아랫부분까지** 하늘 안에 있어야 한다. 줄 한가운데를
         기준으로 잡으면 큰 글씨(가까운 것)의 밑동이 지평선을 넘는다 —
         offsetHeight로 실제 상자를 재어 그만큼 올려 붙인다. */
      p.y = Math.min(p.y, horizon - p.el.offsetHeight);

      // 왼쪽 밖에서 들어와 오른쪽 밖으로 나간다. 곧은 선이다.
      const w = p.el.offsetWidth;
      p.from = -w;
      p.span = frame.clientWidth + w;

      p.live = true;
      p.born = t - p.cross * head;
      // 이 줄은 먼젓번 말이 절반을 지날 때까지 비워 둔다
      laneFree[lane] = p.born + p.cross * 0.55;
    };

    /** 첫 장면을 미리 채웠는가 */
    let seeded = false;
    let raf = 0;
    const step = (t: number) => {
      if (!turned && charPos.greeted) turned = t;
      if (!media.matches && charPos.ready && turned && t - turned > AFTER_TURN) {
        if (!seeded) {
          seeded = true;
          for (const head of [0.62, 0.38, 0.16]) emit(t, head);
        }
        if (t > nextEmit) {
          emit(t);
          nextEmit = t + random(REST.min, REST.max);
        }
      }
      for (const p of pool) {
        if (!p.live) continue;
        const age = (t - p.born) / p.cross;
        if (age >= 1) {
          p.live = false;
          p.el.style.opacity = '0';
          continue;
        }
        // 들어올 때 스미고 나갈 때 빠진다 — 가장자리에서 툭 끊기지 않는다
        const fade = age < 0.12 ? age / 0.12 : age > 0.88 ? (1 - age) / 0.12 : 1;
        p.el.style.opacity = (fade * p.ink).toFixed(3);
        p.el.style.transform =
          `translate(${(p.from + p.span * age).toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div className="home-voices" ref={wrap} aria-hidden="true">
      {Array.from({ length: N }, (_, i) => <span className="voice" key={i} />)}
    </div>
  );
}
