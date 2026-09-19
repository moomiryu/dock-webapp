import { useEffect, useRef } from 'react';
import { charPos } from '../lib/charPos';

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
 * 멀어지는 거리 — 메가폰트 상자 한 변에 대한 비율.
 *
 * 0.62였는데 화면 밖까지 흘러 나가 **아직 진할 때 잘렸다.** 줄이고,
 * 그래도 모자라면 테두리 안에서 끝나게 마지막에 한 번 더 묶는다.
 */
const DRIFT = { x: 0.34, y: 0.22 };
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
      x: number; y: number; dx: number; dy: number;
      text: string[]; typed: number; nextChar: number; tilt: number;
    };
    const pool: Voice[] = nodes.map((el) => ({
      el, live: false, born: 0, life: 0, x: 0, y: 0, dx: 0, dy: 0,
      text: [], typed: 0, nextChar: 0, tilt: 0
    }));

    /** 다음 다발까지 남은 시간 · 이 다발에서 몇을 더 낼지 */
    let nextEmit = 0, left = 0;

    const emit = (t: number) => {
      const p = pool.find((v) => !v.live);
      if (!p) return;
      // 나팔이 향한 쪽으로 나간다. charPos.voice가 그 방향(-1·+1)을 들고 있다.
      const dir = charPos.voice || 1;
      p.live = true;
      p.born = t;
      p.life = random(LIFE.min, LIFE.max);
      p.x = charPos.x + dir * charPos.size * 0.26;
      p.y = charPos.y + random(-0.22, 0.2) * charPos.size;
      p.dx = dir * charPos.size * DRIFT.x * random(0.7, 1.3);
      p.dy = -charPos.size * DRIFT.y * random(0.25, 1);
      p.text = Array.from(pick(VOICES));
      p.typed = 0;
      p.nextChar = t;
      p.tilt = random(-7, 7);
      p.el.style.setProperty('--voice-tilt', `${p.tilt.toFixed(1)}deg`);
      // --char-box는 캐릭터 요소에만 걸려 있다. 여기서는 잰 값을 그대로 쓴다.
      p.el.style.fontSize = `${(charPos.size * 0.072).toFixed(1)}px`;

      /* 테두리 안에서 나고 지게 묶는다.
         글은 제 **가운데**를 자리로 삼으므로(translate -50%), 가운데만
         묶으면 폭의 절반이 삐져나간다 — 실제로 진한 채로 잘렸다.
         다 찍힌 상태로 한 번 재고 지운다. */
      p.el.textContent = p.text.join('');
      const half = p.el.offsetWidth / 2;
      p.el.textContent = '';
      const lo = EDGE + half, hi = frame.clientWidth - EDGE - half;
      if (hi > lo) {
        p.x = Math.min(hi, Math.max(lo, p.x));
        p.dx = Math.min(hi, Math.max(lo, p.x + p.dx)) - p.x;
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
          `translate(${(p.x + p.dx * ease).toFixed(1)}px, ${(p.y + p.dy * ease).toFixed(1)}px)` +
          ` translate(-50%, -50%) rotate(var(--voice-tilt, 0deg)) scale(${(1 - ease * 0.16).toFixed(3)})`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="home-voices" ref={wrap} aria-hidden="true">
      {Array.from({ length: N }, (_, i) => <span className="voice" key={i} />)}
    </div>
  );
}
