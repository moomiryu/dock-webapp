import { useEffect, useRef } from 'react';
import { charPos } from '../character/pos';

/**
 * 나팔에서 흘러나오는 말들.
 *
 * 인사가 끝나고 메가폰트가 옆모습으로 돌아서면, 그때부터 나팔 쪽으로 짧은
 * 말들이 줄줄 나와 배경으로 흩어진다.
 *
 * ── 누구의 말인가 ─────────────────────────────────────────────────────
 * 캐릭터의 혼잣말이 아니다. 'AaBbCc'나 '음…' 같은 것을 뱉고 있었는데 그건
 * 이 물건이 **제 이야기**를 하는 것이다. 여기서 나와야 하는 것은 **닿은
 * 사람들이 맡긴 말**이다 — 배경에서 지나간 사람들이 남기고 간 것.
 * 그래서 문장은 벽에 오를 법한 한 줄들이고, 나팔에서 나와 멀어지며 옅어진다.
 *
 * ── 왜 다발인가 ───────────────────────────────────────────────────────
 * 하나씩 또박또박 나오면 그건 이 물건이 읽어 주는 것이 된다. 두셋이 겹쳐
 * 나왔다 흩어져야 **여럿의 말이 모여 나가는 것**으로 보인다.
 *
 * 한 글자씩 찍히며 나온다 — 글자를 다루는 물건이 하는 일이라서.
 *
 * ── 가운데 한 축으로 오른다 ───────────────────────────────────────────
 * 처음엔 나팔이 향한 쪽으로 사방에 뿌렸다. 포즈가 바뀔 때마다 말이 나오는
 * 쪽도 같이 바뀌어서, 화면에 축이 서지 않았다 — 무엇을 읽어야 하는지가
 * 매번 다른 자리에서 시작한다. 이제 **어느 포즈든 같은 축**이다. 가운데
 * 에서 나와 곧장 위로 오르고, 위의 부제목에 닿기 한참 전에 다 옅어진다.
 * 글줄이 부제목과 겹치면 워드마크가 두 겹으로 읽힌다.
 */

/** 동시에 살아 있을 수 있는 말의 수 */
const N = 8;
/** 한 글자가 찍히는 시간 (ms) */
const TYPE_MS = 52;
/**
 * 한 말이 사는 시간 (ms).
 *
 * 포즈가 5~9초마다 바뀌는데 말은 태어난 쪽으로 계속 간다. 오래 살면 몸이
 * 이미 반대로 돌아선 뒤에도 옛 방향으로 흘러가 **엉뚱한 쪽에서 나오는
 * 것처럼** 보인다. 포즈 한 판보다 짧게 둔다.
 */
const LIFE = { min: 2800, max: 4000 };
/** 한 다발에 몇 마디 · 그 안의 간격(ms) · 다발 사이의 쉼(ms) */
const BUNCH = { min: 2, max: 3 }, INSIDE = { min: 260, max: 620 }, REST = { min: 2200, max: 4600 };
/**
 * 다 옅어지는 자리 — **부제목 아래로 이만큼 남긴 높이**(프레임 높이 비율).
 *
 * 말이 부제목까지 올라오면 워드마크 덩어리가 두 겹으로 읽힌다. 닿기 한참
 * 전에 끝나야 그 위는 제목의 자리, 그 아래는 말의 자리로 갈린다.
 */
const FADE_GAP = 0.13;
/** 나오는 자리 — 캐릭터 한가운데에서 이만큼 위 (상자 한 변의 비율) */
const MOUTH = { min: 0.02, max: 0.16 };
/** 가장자리에서 이만큼은 남긴다 (px) */
const EDGE = 16;

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
      x: number; y: number; dy: number;
      text: string[]; typed: number; nextChar: number;
    };
    const pool: Voice[] = nodes.map((el) => ({
      el, live: false, born: 0, life: 0, x: 0, y: 0, dy: 0,
      text: [], typed: 0, nextChar: 0
    }));

    /* 다 옅어지는 높이. 부제목을 프레임 좌표로 재어 그 아래로 잡는다 —
       수치를 적어 두면 글자 크기가 바뀔 때 그 줄이 먼저 죽는다. */
    let ceiling = 0;
    const measure = () => {
      const f = frame.getBoundingClientRect();
      const sub = frame.querySelector('.home-subtitle')?.getBoundingClientRect();
      ceiling = (sub ? sub.bottom - f.top : f.height * 0.22) + f.height * FADE_GAP;
    };
    measure();
    window.addEventListener('resize', measure);

    /** 다음 다발까지 남은 시간 · 이 다발에서 몇을 더 낼지 */
    let nextEmit = 0, left = 0;

    const emit = (t: number) => {
      const p = pool.find((v) => !v.live);
      if (!p) return;
      p.live = true;
      p.born = t;
      p.life = random(LIFE.min, LIFE.max);
      // 포즈가 어느 쪽을 보든 같은 축이다. 가운데에서 나와 곧장 위로.
      p.x = frame.clientWidth / 2;
      p.y = charPos.y - random(MOUTH.min, MOUTH.max) * charPos.size;
      p.dy = ceiling - p.y;
      p.text = Array.from(pick(VOICES));
      p.typed = 0;
      p.nextChar = t;
      // --char-box는 캐릭터 요소에만 걸려 있다. 여기서는 잰 값을 그대로 쓴다.
      let px = charPos.size * 0.072;
      p.el.style.fontSize = `${px.toFixed(1)}px`;

      /* 가운데 축에 선 글은 제 폭의 절반씩 좌우로 나간다(translate -50%).
         자리를 옮겨 피할 수가 없으므로 — 옮기면 축이 깨진다 — 넘치는
         만큼 글자를 줄인다. 다 찍힌 상태로 한 번 재고 지운다. */
      p.el.textContent = p.text.join('');
      const half = p.el.offsetWidth / 2;
      p.el.textContent = '';
      const room = frame.clientWidth / 2 - EDGE;
      if (half > room && half > 0) {
        px *= room / half;
        p.el.style.fontSize = `${px.toFixed(1)}px`;
      }
    };

    let raf = 0;
    const step = (t: number) => {
      if (!media.matches && charPos.ready && charPos.greeted) {
        if (t > nextEmit) {
          if (left <= 0) { left = Math.round(random(BUNCH.min, BUNCH.max)); }
          emit(t);
          left -= 1;
          nextEmit = t + (left > 0 ? random(INSIDE.min, INSIDE.max) : random(REST.min, REST.max));
        }
      }
      for (const p of pool) {
        if (!p.live) continue;
        const age = (t - p.born) / p.life;
        if (age >= 1) {
          p.live = false;
          p.el.style.opacity = '0';
          continue;
        }
        // 한 글자씩 찍힌다
        if (p.typed < p.text.length && t > p.nextChar) {
          p.typed += 1;
          p.nextChar = t + TYPE_MS;
          p.el.textContent = p.text.slice(0, p.typed).join('');
        }
        // 멀어지며 옅어진다. 처음 10%는 떠오르는 구간이라 진해진다.
        const ease = 1 - (1 - age) ** 2;
        const fade = age < 0.1 ? age / 0.1 : 1 - (age - 0.1) / 0.9;
        p.el.style.opacity = (fade * 0.85).toFixed(3);
        p.el.style.transform =
          `translate(${p.x.toFixed(1)}px, ${(p.y + p.dy * ease).toFixed(1)}px)` +
          ` translate(-50%, -50%) scale(${(1 - ease * 0.16).toFixed(3)})`;
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
