import { useEffect, useRef } from 'react';
import { charPos } from './pos';
import { said } from './says';
import {
  BODY, CLIP_H, EYE_LOOK, EYE_SHUT, EYE_SMILE, EYE_WHITE, EYE_WIDE, EYE_FAR_DX,
  HEAD, SHADOW, SHADOW_FRONT, SHADOW_SIDE, VIEW, WALK, type WalkerEye
} from './walker';

/**
 * 배경을 오가는 작은 캐릭터들.
 *
 * 화면에는 늘 여섯이 있다. 저마다 가장자리에서 걸어 들어와 제 볼일을 보고
 * 반대쪽으로 나간다. 나간 자리는 곧 새 캐릭터가 채운다 — 같은 여섯이
 * 갇혀 도는 것이 아니라 **지나가는 사람들**이다.
 *
 * ── 이 장면이 말하는 것 ───────────────────────────────────────────────
 * 그중 얼마는 메가폰트 앞에 선다. 쳐다보고, 놀라고, 깜빡이고, 웃는다.
 * 웃는 순간 몸이 **빨강**이 되고 그대로 화면 밖으로 걸어 나간다.
 * 파랑으로 들어와 빨강으로 나가는 것 — 이 설치물이 하는 일이 그것이다.
 * 말로 설명하지 않고 배경에서 계속 일어나게 둔다.
 *
 * ── 앞뒤는 발끝이 정한다 ──────────────────────────────────────────────
 * 2D에 깊이를 만드는 방법은 하나뿐이다: **아래에 있는 것이 앞에 있다.**
 *
 * 처음엔 메가폰트보다 앞이냐 뒤냐 두 층으로만 갈랐는데, 그러면 **구경꾼끼리는
 * 앞뒤가 없다** — 같은 층이라 문서에 먼저 적힌 쪽이 뒤로 간다. 더 아래에
 * 선 애가 위에 선 애에게 가리는 일이 생겼다.
 *
 * 이제 발끝 높이를 그대로 층으로 쓴다. 메가폰트를 가운데(CHAR_Z)에 두고,
 * 그 그림자보다 얼마나 아래인지를 더한다. 그러면 여섯과 메가폰트가 한
 * 줄로 정렬된다.
 */

/** 화면에 늘 이만큼 있다 */
const N = 6;
/** 키 (px). 메가폰트 상자(272)의 5분의 1쯤 */
const HEIGHT = 56;
const RATIO = VIEW.w / VIEW.h;
/**
 * 한 걸음의 주기 (ms). 그림에 적힌 1.28초를 그대로 쓴다.
 * 여섯이 다 같으면 한 몸처럼 발을 맞추므로 저마다 조금씩 어긋나게 둔다.
 */
const walkMs = (i: number) => Math.round(WALK.ms * (0.82 + (i % 4) * 0.12));
/** 걷는 빠르기 (px/s) */
const SPEED = { min: 13, max: 26 };
/**
 * 메가폰트는 **지나갈 수 없는 것**이다.
 *
 * 이 반지름 안으로 들어오면 멈춰 선다. 뒤로 빠져나가지 못하므로 만난
 * 사람은 왔던 쪽으로 되돌아 나간다 — 공이 튕기듯이. 몸을 스치지 않는
 * 높이(위아래로 BLOCK.y 밖)로 지나는 사람은 그냥 지나간다.
 *
 * 값은 상자 한 변에 대한 비율이다. 실루엣이 삼각형이라 가로가 세로보다
 * 넓게 잡혀 있다.
 */
const BLOCK = { x: 0.42, y: 0.34 };
/**
 * **앞을 지나는 사람**이 닿았다고 보는 거리.
 *
 * 뒤로 지나는 사람은 메가폰트에 가려지므로 몸 가장자리에서 멎어야 한다.
 * 앞으로 지나는 사람은 가려질 일이 없으니 **정면 한가운데까지** 와도 된다 —
 * 그래야 둘이 마주 선 장면이 된다. 닿는 띠도 넓다(0.34 → 1.05): 가장자리
 * 한 줄에서만 빨개지면 앞을 지나는 사람은 영영 파란 채로 지나간다.
 */
const FRONT = { x: 0.1, y: 1.05 };
/**
 * 첫 여섯이 들어오기 시작하는 때 · 서로의 간격 (ms).
 *
 * 2026-09-20까지 화면이 열리고 4200ms 뒤라는 **적어 둔 숫자**였다. 그때는
 * 인사가 한 낱말씩 셋이라 4.2초면 끝났는데, 인사가 두 줄짜리 문장 셋이
 * 되면서 8초 가까이 걸리게 됐다 — 구경꾼이 인사 도중에 들이닥쳤다.
 *
 * 이제 시계가 아니라 **메가폰트를 본다.** 인사를 마치고 옆모습으로 돌아선
 * 그 순간(charPos.greeted)부터 센다. 돌아선 다음에 사람이 들어오는 것이
 * 이 화면의 차례다 — 인사는 보는 사람에게 하는 것이고, 구경꾼은 그 뒤에
 * 오는 배경이다.
 *
 * 간격을 고르게 두면 여섯이 비슷한 때에 메가폰트 앞에 닿아 **한꺼번에
 * 빨개진다.** 그건 흐름이 아니라 신호에 맞춘 것이다. 간격을 넓게 흩는다.
 *
 * 흩되 **차례는 지킨다.** 앞사람 것에 더해 가며 쌓는다 — 저마다 제 번호에
 * 무작위를 곱하던 때는(500 + i × 0.7~2.6초) 앞사람이 큰 값을, 뒷사람이
 * 작은 값을 뽑으면 순서가 뒤집혔다. 둘이 같은 때에 나란히 들어오는 장면도
 * 생겼다. 쌓으면 다음 사람은 반드시 앞사람보다 0.7초 이상 뒤다.
 */
const JOIN_DELAY = 500, JOIN_GAP = { min: 700, max: 2600 };
/** 메가폰트 앞에서 보이는 표정의 차례 */
const MEETING: Array<{ eye: WalkerEye; ms: number }> = [
  { eye: 'look', ms: 900 },
  { eye: 'wide', ms: 700 },
  { eye: 'shut', ms: 260 },
  { eye: 'look', ms: 520 },
  { eye: 'smile', ms: 1100 }   // 여기서 빨강이 된다
];
/** 웃기 시작하는 칸 — 몸이 빨강으로 건너가는 자리 */
const TURN_AT = MEETING.length - 1;

/**
 * 메가폰트가 서 있는 층. 구경꾼은 이 값을 가운데 놓고 발끝 높이만큼
 * 위아래로 벌어진다. app.css의 .home-char와 같은 값이어야 한다.
 */
const CHAR_Z = 500;

/**
 * 발끝이 내려갈 수 있는 제일 아래.
 *
 * 버튼과 캐릭터의 **윤곽이 붙어 보이면** 둘이 한 덩어리로 읽힌다. 다리가
 * 버튼 위에 걸치거나 그림자가 버튼 어깨에 닿는 그림이 그렇다.
 *
 * 재는 기준은 캐릭터의 한가운데가 아니라 **제일 아래로 뻗는 것**이다.
 * p.y가 마침 그 선이다 — 그림자 타원의 아래 끝(cy+ry = 574.09)이 화판
 * 바닥(574.1)과 같고, 상자를 p.y에 발맞춰 놓기 때문이다. 그러니 발이든
 * 그림자든 p.y 아래로는 못 내려간다. 여기서 더 뺄 것이 없다.
 */
const GATE_GAP = 24;   /* --s6. 걸음의 오르내림까지 치면 16(--s5)으로는
                          버튼 모서리와 붙어 보였다(재서 확인) */
function groundLimit(frame: HTMLElement, h: number) {
  const gate = frame.querySelector('.home-gate')?.getBoundingClientRect();
  const top = gate ? gate.top - frame.getBoundingClientRect().top : h * 0.86;
  return Math.max(h * 0.6, top - GATE_GAP);
}

const random = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type Phase = 'walk' | 'meet' | 'leave';

export default function HomeCrowd() {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = wrap.current!;
    const frame = host.parentElement!;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches;
    const nodes = [...host.children] as HTMLElement[];
    const half = (HEIGHT * RATIO) / 2;

    type Walker = {
      el: HTMLElement; art: SVGSVGElement;
      x: number; y: number; dir: 1 | -1; speed: number;
      phase: Phase; until: number; beat: number;
      born: number; live: boolean; moving: boolean;
      /** 메가폰트가 돌아선 뒤 이만큼(ms) 있다가 들어온다 */
      wait: number;
    };

    /** 가장자리 밖에서 새로 들어온다. 파랑으로, 아직 아무것도 모른 채 */
    const spawn = (p: Walker, t: number, first = false) => {
      const w = frame.clientWidth, h = frame.clientHeight;
      const floor = groundLimit(frame, h);
      p.dir = Math.random() < 0.5 ? 1 : -1;
      p.x = p.dir > 0 ? -half - random(0, 60) : w + half + random(0, 60);
      /* 세로 띠: 위는 워드마크, 아래는 버튼이 쓴다. 그 사이에서만 논다.
         위 끝을 0.44에서 0.53으로 내렸다 — 그보다 높으면 발끝이 메가폰트의
         모자(하늘색) 높이에 오는데, 구경꾼도 하늘색이라 둘이 한 덩이로
         뭉쳐 보였다. 뒤에 서는 것은 좋지만 겹쳐 보이는 것은 다른 일이다. */
      /* 위는 원근이 정하고 아래는 버튼이 정한다(groundLimit이 잰다).
         밤 동안에는 지평선(55%) 아래에 서라고 0.57부터였다. 지평선이
         없어졌으므로 다시 0.53이다. */
      p.y = random(h * 0.53, floor);
      p.speed = random(SPEED.min, SPEED.max);
      p.phase = 'walk';
      p.beat = 0;
      p.until = 0;
      p.live = true;
      p.el.dataset.tone = 'blue';
      p.el.dataset.eye = 'look';
      p.el.dataset.face = 'side';
      p.el.style.opacity = first ? '0' : '1';
      p.born = t;
    };

    /** 다음 사람이 들어오는 때. 한 명씩 쌓아 올린다 */
    let join = JOIN_DELAY;
    const crowd: Walker[] = nodes.map((el) => {
      const p: Walker = {
        el, art: el.querySelector('svg')!,
        x: 0, y: 0, dir: 1, speed: 0, phase: 'walk',
        until: 0, beat: 0, born: 0, live: false, moving: false, wait: 0
      };
      // 걸음은 그림 안의 움직임(SMIL)이라 CSS로 못 세운다. 나올 때까지 재워 둔다
      p.art.setCurrentTime(0);
      p.art.pauseAnimations();
      // 처음 여섯은 한꺼번에 들이닥치지 않게 차례로 들어온다. 시각은
      // 메가폰트가 돌아선 뒤에 정해진다(아래 step).
      p.el.style.opacity = '0';
      p.wait = join;
      join += random(JOIN_GAP.min, JOIN_GAP.max);
      return p;
    });

    let raf = 0, last = 0;
    /** 메가폰트가 인사를 마치고 돌아선 때. 구경꾼의 시계는 여기서 0이다 */
    let turned = 0;
    const step = (t: number) => {
      const dt = Math.min((t - (last || t)) / 1000, 0.05);
      last = t;
      const w = frame.clientWidth;
      const floor = groundLimit(frame, frame.clientHeight);
      if (!turned && charPos.greeted) turned = t;

      for (const p of crowd) {
        if (!p.live) {
          // 아직 나올 때가 아니다 — 돌아서기 전이거나 제 차례가 안 됐다
          if (p.born !== -1 && (!turned || t - turned < p.wait)) continue;
          spawn(p, t);
        }

        if (!reduced) {
          if (p.phase === 'meet') {
            // 멈춰 서서 표정을 차례로 보인다
            if (t > p.until) {
              p.beat += 1;
              if (p.beat >= MEETING.length) {
                // 지나갈 수 없으니 왔던 쪽으로 되돌아 나간다
                p.phase = 'leave';
                p.dir = p.dir > 0 ? -1 : 1;
                p.el.dataset.face = 'side';   // 걸으려면 다시 옆으로 선다
              } else {
                const m = MEETING[p.beat];
                p.el.dataset.eye = m.eye;
                // 웃는 칸에서 몸이 빨강이 되고, 그때 **이쪽으로 돌아선다.**
                // 네 칸 동안 메가폰트를 보다가 마지막에 눈이 둘이 된다 —
                // 발화자가 된 것을 보는 사람에게 건네는 자리다.
                if (p.beat >= TURN_AT) {
                  p.el.dataset.tone = 'red';
                  p.el.dataset.face = 'front';
                  /* 빨개진 **그 자리**를 적어 둔다. 배경에 흐르는 말은 이제
                     시계가 아니라 여기서 시작한다 — 이 머리 위로 한 줄이
                     떠서 흘러간다(HomeVoices). 넘기는 값은 발끝이 아니라
                     머리 끝이다: 상자가 p.y - HEIGHT에 놓여 있다. */
                  said(p.x, p.y - HEIGHT);
                }
                p.until = t + m.ms;
              }
            }
          } else {
            p.x += p.dir * p.speed * dt;
            // 메가폰트에 닿으면 멈춘다. 몸을 스치지 않는 높이로 지나는
            // 사람은 걸리지 않는다 — 그래서 늘 몇은 그냥 지나간다.
            //
            // 발끝이 메가폰트보다 **아래**면 그 앞을 지나는 사람이다.
            // 가려질 일이 없으므로 정면 한가운데까지 들어온다(FRONT).
            const near = charPos.ready && p.y > charPos.ground ? FRONT : BLOCK;
            if (p.phase === 'walk' && charPos.ready &&
                Math.abs(p.y - charPos.ground) < charPos.size * near.y &&
                Math.abs(p.x - charPos.x) < charPos.size * near.x) {
              p.x = charPos.x - p.dir * charPos.size * near.x;   // 닿은 자리에 세운다
              p.phase = 'meet';
              p.beat = 0;
              p.el.dataset.eye = MEETING[0].eye;
              p.until = t + MEETING[0].ms;
            }
            // 화면을 다 건너면 사라지고, 그 자리에 새로 하나가 들어온다
            if (p.x < -half - 70 || p.x > w + half + 70) { spawn(p, t); continue; }
          }
        }

        // 나타날 때만 한 번 흐려진 데서 올라온다
        if (p.el.style.opacity !== '1') {
          const age = (t - p.born) / 420;
          p.el.style.opacity = age >= 1 ? '1' : age.toFixed(2);
        }
        const moving = !reduced && p.phase !== 'meet';
        if (moving !== p.moving) {
          p.moving = moving;
          p.el.dataset.walking = String(moving);
          // 멈출 때는 시간을 0으로 돌리고 재운다. 0프레임이 곧 작가가 그린
          // **서 있는 자세**라, 걷다 만 어정쩡한 걸음에서 멎지 않는다.
          if (moving) p.art.unpauseAnimations();
          else { p.art.setCurrentTime(0); p.art.pauseAnimations(); }
        }
        // 메가폰트 앞에 섰을 때는 그를 본다. 그림이 왼쪽을 보고 있으므로
        // 오른쪽을 보려면 뒤집는다.
        const face = p.phase === 'meet'
          ? (charPos.x > p.x ? -1 : 1)
          : (p.dir > 0 ? -1 : 1);
        // 발끝이 낮을수록 뒤, 높을수록(아래일수록) 앞. 메가폰트도 이 줄에 낀다.
        p.el.style.zIndex = String(
          charPos.ready ? clamp(Math.round(CHAR_Z + p.y - charPos.ground), 1, 999) : 1
        );
        /* 화면이 바뀌어 버튼이 올라오면 이미 서 있던 사람도 같이 물러난다.
           한 번에 옮기지 않고 조금씩 끌어올려 — 갑자기 튕기지 않는다. */
        if (p.y > floor) p.y = Math.max(floor, p.y - 60 * dt);
        p.el.style.transform =
          `translate(${(p.x - half).toFixed(1)}px, ${(p.y - HEIGHT).toFixed(1)}px) scaleX(${face})`;
      }
      raf = requestAnimationFrame(step);
    };

    const onReduced = () => { reduced = media.matches; };
    media.addEventListener('change', onReduced);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener('change', onReduced);
    };
  }, []);

  return (
    <div className="home-crowd" ref={wrap} aria-hidden="true">
      {Array.from({ length: N }, (_, i) => {
        const dur = `${walkMs(i)}ms`;
        return (
        <span
          key={i}
          className="walker"
          data-tone="blue"
          data-eye="look"
          data-face="side"
          data-walking="false"
          style={{ height: `${HEIGHT}px`, width: `${HEIGHT * RATIO}px` }}
        >
          <svg className="walker-art" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true" focusable="false">
            <defs>
              <clipPath id={`walker-clip-${i}`}><rect width={VIEW.w} height={CLIP_H} /></clipPath>
            </defs>
            {/* 자세에 따라 둘 중 하나만 보인다. 옆모습 것은 상자보다 넓어
                밖으로 비어져 나간다 — 그 폭이 걷는 쪽을 말한다 */}
            <ellipse className="w-shade w-shade-side"
              cx={SHADOW_SIDE.cx} cy={SHADOW.cy} rx={SHADOW_SIDE.rx} ry={SHADOW.ry} />
            <ellipse className="w-shade w-shade-front"
              cx={SHADOW_FRONT.cx} cy={SHADOW.cy} rx={SHADOW_FRONT.rx} ry={SHADOW.ry} />
            {/* 다리 둘은 모양째로 바뀐다. 작가가 그린 65프레임을 그대로 돈다 —
                멈춰 세울 때는 시간을 0으로 돌려 재운다(위 step) */}
            <path className="w-leg w-far" fill="currentColor" d={WALK.farRest}>
              <animate attributeName="d" dur={dur} repeatCount="indefinite"
                calcMode="linear" keyTimes={WALK.keyTimes} values={WALK.far} />
            </path>
            <path className="w-leg w-near" fill="currentColor" d={WALK.nearRest}>
              <animate attributeName="d" dur={dur} repeatCount="indefinite"
                calcMode="linear" keyTimes={WALK.keyTimes} values={WALK.near} />
            </path>
            {/* 몸은 다리와 따로 논다. 발을 디딜 때 내려앉고(바깥) 그 박자로
                기운다(안쪽) — 다리만 움직이면 미끄러지는 것으로 보인다 */}
            <g transform={`translate(${WALK.bobRest})`}>
              <animateTransform attributeName="transform" type="translate" dur={dur}
                repeatCount="indefinite" calcMode="linear" keyTimes={WALK.keyTimes} values={WALK.bob} />
            <g transform={`rotate(${WALK.tiltRest})`}>
              <animateTransform attributeName="transform" type="rotate" dur={dur}
                repeatCount="indefinite" calcMode="linear" keyTimes={WALK.keyTimes} values={WALK.tilt} />
            <g clipPath={`url(#walker-clip-${i})`}>
              <circle fill="currentColor" cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
              <path fill="currentColor" d={BODY} />
              {/* 눈 한 벌. 표정 넷을 다 그려 두고 CSS가 하나만 보여 준다 —
                  바꿀 때마다 React를 거치면 여섯이 초당 몇 번씩 다시 그려진다 */}
              <g>
                <circle fill="#fff" cx={EYE_WHITE.cx} cy={EYE_WHITE.cy} r={EYE_WHITE.r} />
                <circle className="w-eye w-eye-look" fill="currentColor" cx={EYE_LOOK.cx} cy={EYE_LOOK.cy} r={EYE_LOOK.r} />
                <circle className="w-eye w-eye-wide" fill="currentColor" cx={EYE_WIDE.cx} cy={EYE_WIDE.cy} r={EYE_WIDE.r} />
                <path className="w-eye w-eye-shut" d={EYE_SHUT} fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
                <path className="w-eye w-eye-smile" d={EYE_SMILE} fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
              </g>
              {/* 정면으로 돌 때만 보이는 반대쪽 눈. 같은 한 벌을 옮겨 놓은
                  것이라 표정도 저절로 따라온다 */}
              <g className="w-eye-far" transform={`translate(${EYE_FAR_DX} 0)`}>
                <circle fill="#fff" cx={EYE_WHITE.cx} cy={EYE_WHITE.cy} r={EYE_WHITE.r} />
                <circle className="w-eye w-eye-look" fill="currentColor" cx={EYE_LOOK.cx} cy={EYE_LOOK.cy} r={EYE_LOOK.r} />
                <circle className="w-eye w-eye-wide" fill="currentColor" cx={EYE_WIDE.cx} cy={EYE_WIDE.cy} r={EYE_WIDE.r} />
                <path className="w-eye w-eye-shut" d={EYE_SHUT} fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
                <path className="w-eye w-eye-smile" d={EYE_SMILE} fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
              </g>
            </g>
            </g>
            </g>
          </svg>
        </span>
        );
      })}
    </div>
  );
}
