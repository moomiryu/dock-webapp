import { useEffect, useRef, useState } from 'react';
import {
  CANVAS, EYES, blendGeo, eyeMarkup, eyeOpacity, poseGeometry, toPathD, turnKind,
  type Eyes, type Pose, type PoseGeo
} from '../lib/characterMorph';
import { charPos } from '../lib/charPos';

/**
 * 캐릭터가 처음 서는 자리 — 화면 높이에 대한 비율. 가로는 늘 한가운데다.
 *
 * 0.46이었다. 캐릭터가 가끔 한 마디를 뱉는데 그 말이 **머리 위**에 뜨므로,
 * 46%에서는 말이 워드마크 쪽으로 올라붙었다. 말이 설 자리를 미리 비워 둔다.
 *
 * 00에서 01로 건너갈 때 빨강 막이 내려앉는 자리도 이 값을 쓴다(App.tsx) —
 * 두 곳에 따로 적으면 그중 하나가 반드시 어긋난다.
 */
export const REST_Y = 0.52;

/**
 * 실루엣 바닥에서 그림자까지의 틈 — 상자 한 변에 대한 비율.
 *
 * 이 캐릭터는 바닥에 선 것이 아니라 **떠 있다.** 붙이면 선 것이 되고
 * 너무 멀면 딴 물건이 된다.
 *
 * 자리를 상자에 대고 고정했더니(88%) 포즈마다 어긋났다 — 옆모습은 실루엣이
 * 좁고 짧은데 그림자는 그대로라 몸 밖에 떠 있었다. 이제 **실루엣**을 따라
 * 간다: 폭은 실루엣 폭에, 높이는 실루엣 바닥에 이 틈을 더한 자리에.
 */
export const SHADE_GAP = 0.06;
/** 그림자 폭 — 실루엣 폭에 대한 비율 */
const SHADE_W = 0.62;

/** 한 포즈에서 다음 포즈로 형태가 넘어가는 데 걸리는 시간 (ms) */
const TURN_MS = 380;
/** 포즈가 방향을 따라 바뀌더라도 이 간격보다 자주 바뀌지 않는다 (ms) */
const POSE_DWELL = 900;

/**
 * 멀고 가까움. 상자(272px)를 1로 놓은 배수다.
 *
 * 2026-09-15 스케치 넉 장에서 캐릭터를 눈 지름으로 재서 나온 값이다 —
 * 홈_3이 상자 170px, 홈_1이 390px, 홈_2가 607px(화면에 잘려 나갈 만큼 가깝다).
 * 272로 나누면 0.63 · 1.43 · 2.23. 그 폭을 그대로 쓴다.
 */
/**
 * 가끔 캐릭터가 한 마디를 뱉는다.
 *
 * 홈_4 스케치에서 'AaBbCc'가 캐릭터 옆에 비스듬히 떠 있었다(잉크 109.6×50.9,
 * 상자 312 기준 높이의 0.163배). 거기서 자란 목록이다.
 *
 * 두 갈래다. **견본**은 글자로 된 것이 글자를 보여주는 것이고, **혼잣말**은
 * 말이 되다 만 것이다. 둘 다 'AaBbCc'와 'I think…' 만한 분량으로 묶었다 —
 * 더 길면 읽는 동안 1.6초가 끝나고, 더 짧으면 뭐가 지나갔는지 모른다.
 *
 * 권유는 넣지 않는다. `design/instructions.md`가 "참여해보세요 같은 권유는
 * 쓰지 않는다"고 못박아 두었고, 무엇을 쓰라는 말도 넣지 않는다 — 편집권은
 * 발화자에게 있다. 이건 캐릭터의 군소리지 안내가 아니다.
 *
 * 말끝도 붙이지 않는다. 어휘 원칙의 해요체·합니다체는 장치가 사용자에게
 * 말할 때의 것이고, 이건 혼잣말이라 토막으로 둔다.
 */
const SAY_POOL = [
  'AaBbCc', '가나다라', '한글 Aa', 'Rr Ss Tt', '0123',
  'I think…', '음…', '그러니까', '있잖아', '아 맞다', '어?', '!'
];
const SAY_MS = 1600;

/**
 * 첫인사. 캐릭터가 떠오르고 자리를 잡는 동안만 나온다.
 *
 * 여기서만 캐릭터가 **정해진 대로** 움직인다 — 정면을 보고, 웃는 눈으로,
 * 세 마디를 양옆으로 번갈아 하나씩 띄운다. 나머지 시간의 SAY_POOL은
 * 혼잣말이라 무엇이 언제 나올지 모르는 것이 요점인데, 처음 만나는
 * 순간까지 그러면 인사가 아니라 잡음이 된다. 환영은 정해져 있어야 한다.
 *
 * 세 나라 말인 이유: 캠퍼스에 한국어만 쓰는 사람만 있지 않다.
 */
/**
 * 첫인사. 마지막 한 마디는 인사가 아니라 **할 일**이라 작게 적는다 —
 * 같은 크기로 두면 'Hello' 다음에 온 또 하나의 인사로 읽힌다.
 * 열한 자를 0.12배(32px)로 찍으면 한 줄이 390 화면을 넘는다(nowrap이다).
 */
const WELCOME: Array<{ text: string; small?: boolean }> = [
  { text: '안녕하세요' }, { text: 'こんにちは' }, { text: 'Hello' },
  { text: '아래 버튼을 눌러보세요', small: true }
];
/** 한 마디가 떠 있는 시간 · 다음 마디까지의 틈 */
const WELCOME_MS = 1250, WELCOME_GAP = 220;
/**
 * 처음에 눈을 감고 있는 동안.
 *
 * 등을 보이고 있다가 돌아서게 해 봤는데, 돌아오는 그 한 순간의 눈이
 * 어떻게 해도 어색했다 — 투명도로 올리면 허공에서 떠오르고, 눌러 뒀다
 * 켜면 툭 켜지고, 가로로 열면 획이 깨져 보인다. 뒷모습을 빼고 **처음부터
 * 정면, 눈만 감은 채**로 둔다. 뜨는 것은 눈꺼풀이 하는 일이지 회전이
 * 하는 일이 아니다.
 *
 * 00에서 넘어온 빨강 막이 꺼지는 데 900ms가 걸리므로(App.tsx · splashLand)
 * 그보다 넉넉히 길어야 '감고 있었다'가 보인다 — 막이 몸과 같은 빨강이라
 * 그동안은 얼굴 자리가 통째로 가려져 있다(그걸 모르고 눈 자산을 한참
 * 의심했다).
 */
const SHUT_MS = 1600;
/** 눈을 뜨고 터지는 '!' — 놀란 뒤에 웃는다 */
const BANG_MS = 900;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const random = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export default function HomeCharacter() {
  const ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const hatRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const eyeRef = useRef<SVGSVGElement>(null);
  const trailRef = useRef<SVGGElement>(null);

  // 표정만 React가 들고 있다. 벽에 닿을 때만 바뀌고 최소 2초를 버티므로
  // 리렌더가 드물다. 포즈와 위치는 매 프레임이라 DOM을 직접 만진다.
  /**
   * 처음에는 눈을 감고 있다. 첫 프레임부터 그래야 뜨는 것이 사건이 된다.
   *
   * 감은 눈은 'twinkle'(◡)이다. 아홉 표정을 몸 색 위에 한 장으로 놓고
   * 골랐다 — 'tired'는 이름과 달리 흰자가 반쯤 잘린 접시 모양이라
   * 감은 눈으로 안 읽힌다.
   */
  const [eyes, setEyes] = useState<Eyes>('twinkle');
  // 뱉은 글자. 표정과 같은 이유로 React가 들고 있다 — 몇 초에 한 번뿐이라
  // 리렌더가 드물다. 자리와 크기는 매 프레임이라 여전히 DOM을 직접 만진다.
  const [say, setSay] = useState<{
    text: string; side: 'left' | 'right'; tilt: number;
    /** 인사가 아니라 할 일. 작게 적는다 */ small?: boolean;
    /** '!'처럼 짧게 터지는 것 — 뜨고 지는 시간도 짧다 */ quick?: boolean;
  } | null>(null);

  useEffect(() => {
    const el = ref.current!;
    const frame = el.closest('.home-frame') as HTMLElement;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches;

    /**
     * 처음부터 정면이다. 돌아서지 않는다 — 감은 눈을 뜨는 것으로 충분하다.
     */
    let pose: Pose = 'front_center';
    let from: PoseGeo = poseGeometry(pose);
    let to: PoseGeo = from;
    let now0 = 0;              // 이번 회전이 시작된 시각
    let turn: 'spin' | 'none' = 'none';
    let geo: PoseGeo = from;   // 지금 이 순간의 형태

    let w = 0, h = 0, size = 0, x = 0, y = 0;
    /** 워드마크·설명이 끝나는 높이. 글자는 그 아래에서만 뜬다 */
    let introBottom = 0;
    /**
     * 이 캐릭터는 이제 **움직이지 않는다.**
     *
     * 끌어 옮기고 벽에 튕기던 것을 걷어냈다. 그 움직임이 있는 동안에는
     * 홈에서 일어나는 일이 전부 이 캐릭터의 일이었는데, 이제 배경을
     * 오가는 구경꾼들이 그 자리를 맡는다. 메가폰트는 제자리에 서서
     * **모습만 바꾼다** — 포즈·표정·한 마디.
     */
    let lastPose = 0, nextPose = 0, faceUntil = 0;
    let squash = 0, tilt = 0, raf = 0, lastTime = 0;
    /**
     * 크기는 늘 1이다.
     *
     * 가끔 한 번씩 부풀었다 돌아오는 움직임이 있었는데 걷어냈다. 그것은
     * 캐릭터가 화면을 떠다니던 시절, 가만히 있는 동안에도 무언가 일어나게
     * 하려던 장치였다. 이제 배경에 오가는 사람들이 그 일을 하므로, 한가운데
     * 것까지 들썩이면 볼 데가 둘이 된다.
     */
    const depth = 1;
    let nextSay = 0, sayUntil = 0;
    /**
     * 첫인사의 차례. 등 → 돌아섬 → '!' → 웃음 → 인사 넉 마디 → 평소.
     * 이 동안에는 떠다니지도 부풀지도 않는다.
     */
    let intro: 'shut' | 'bang' | 'welcome' | null = 'shut';
    let introAt = 0;

    let welcomeIdx = 0, welcomeNext = 0;
    let initialized = false, visible = !document.hidden;

    const setPose = (next: Pose, now: number) => {
      if (next === pose) return;
      const shape = poseGeometry(next).span;
      // 벽에 붙어 있을 때 더 큰 포즈로 바꾸면 안쪽으로 순간이동한 것처럼 보인다.
      if (x < (size * depth * shape.x) / 2 || x > w - (size * depth * shape.x) / 2 ||
          y < (size * depth * shape.y) / 2 || y > h - (size * depth * shape.y) / 2) return;
      void 0;
      turn = turnKind(pose, next);
      from = geo;                    // 돌던 도중이면 지금 모습에서 이어서 돈다
      to = poseGeometry(next);
      now0 = now;
      pose = next;
      lastPose = now;
    };

    const bounds = () => ({
      rx: Math.min(w / 2, (size * depth * geo.span.x) / 2 + 2),
      ry: Math.min(h / 2, (size * depth * geo.span.y) / 2 + 2)
    });
    const contain = () => {
      const { rx, ry } = bounds();
      x = clamp(x, rx, w - rx);
      y = clamp(y, ry, h - ry);
    };

    const paint = (progress: number) => {
      bodyRef.current!.setAttribute('d', toPathD(geo.body));
      hatRef.current!.setAttribute('d', toPathD(geo.hat));
      bodyRef.current!.setAttribute('fill', geo.bodyFill);
      hatRef.current!.setAttribute('fill', geo.hatFill);

      const dot = dotRef.current!;
      dot.setAttribute('cx', geo.dot.cx.toFixed(2));
      dot.setAttribute('cy', geo.dot.cy.toFixed(2));
      dot.setAttribute('r', geo.dot.r.toFixed(2));
      dot.setAttribute('fill', geo.bodyFill);
      // 도는 중간에는 감춘다. 뒷모습의 혹이 줄어드는 동안 몸은 가로로
      // 좁아지는데 이 점은 제자리라, 한가운데 즈음에서 **몸에서 떨어진
      // 점**으로 보인다. 도는 결의 한복판에서 0이 된다.
      const swing = progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) : 0;
      dot.setAttribute('opacity', (1 - swing).toFixed(3));

      const eye = eyeRef.current!;
      if (geo.eye) {
        eye.setAttribute('x', geo.eye.x.toFixed(2));
        eye.setAttribute('y', geo.eye.y.toFixed(2));
        eye.setAttribute('width', geo.eye.w.toFixed(2));
        eye.setAttribute('height', geo.eye.h.toFixed(2));
      }
      /* 눈을 가로로 열어 봤다가 걷어냈다(2026-09-20). 뒷모습에서 정면으로
         도는 그 한 순간을 위한 것이었는데, 배율로 눌린 획이 **벡터가 깨진
         것처럼** 보였다. 첫 화면이 뒷모습을 거치지 않게 되면서 그 순간
         자체가 없어졌고 — 앞모습과 옆모습은 둘 다 눈을 갖고 있어 늘 1이다. */
      eye.style.opacity = String(eyeOpacity(from, to, progress));

      const trail = trailRef.current!;
      const wanted = geo.trail ?? '';
      if (trail.dataset.key !== wanted) {
        trail.innerHTML = wanted;
        trail.dataset.key = wanted;
      }

      // 글자가 앉을 선 — 실루엣의 맨 윗변. 포즈마다 다르므로 매 프레임 준다.
      // 앞모습은 상자의 18.5% 지점, 옆모습은 상자 꼭대기(0)다.
      el.style.setProperty('--say-floor', `${size * (0.5 - geo.span.y / 2)}px`);

      // scale이 translate 뒤에 와야 상자 가운데를 붙든 채 커진다.
      el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) scale(${depth.toFixed(3)})`;
      el.style.setProperty('--char-tilt', `${tilt}deg`);
      el.style.setProperty('--char-squash', String(1 - squash));
      el.style.setProperty('--char-stretch', String(1 + squash * 0.45));
      el.dataset.pose = pose;

      // 그림자는 실루엣을 따라간다. 포즈마다 폭도 바닥도 다르다.
      const floor = geo.span.y / 2 + SHADE_GAP;
      el.style.setProperty('--shade-w', (geo.span.x * SHADE_W).toFixed(3));
      el.style.setProperty('--shade-y', (0.5 + floor).toFixed(3));

      // 구경꾼들이 따라올 수 있게 자리를 적어 둔다. 상태로 올리면 초당
      // 예순 번 홈 전체가 다시 그려진다 — 그래서 모듈 하나를 같이 쓴다.
      charPos.x = x;
      charPos.y = y;
      charPos.size = size * depth;
      charPos.ground = y + size * depth * floor;   // 그림자가 놓인 줄이 바닥이다
      charPos.ready = initialized;
    };

    const measure = () => {
      w = frame.clientWidth;
      h = frame.clientHeight;
      size = el.offsetWidth;
      el.style.setProperty('--char-box', `${size}px`);
      const intro = frame.querySelector('.home-intro');
      introBottom = intro
        ? intro.getBoundingClientRect().bottom - frame.getBoundingClientRect().top
        : 0;
      if (!initialized) { x = w / 2; y = h * REST_Y; initialized = true; }
      contain();
      paint(1);
    };

    /**
     * 가만히 서서 이따금 고개를 돌린다.
     *
     * 움직이던 시절에는 가는 쪽이 보는 쪽을 정했다. 이제 갈 데가 없으므로
     * 제 안에서 고른다. 정면에 오래 머물고 옆은 잠깐씩만 본다 — 반대로
     * 두면 두리번거리는 것이 되어 가만히 있는 것으로 안 읽힌다.
     * 등은 돌리지 않는다. 첫인사에서 한 번 돌아선 뒤로는 사람을 본다.
     */
    const idlePose = (): Pose => {
      const r = Math.random();
      if (r < 0.52) return 'front_center';
      if (r < 0.68) return 'front_left';
      if (r < 0.84) return 'front_right';
      return r < 0.92 ? 'left' : 'right';
    };

    const step = (t: number) => {
      const dt = Math.min((t - (lastTime || t)) / 1000, 0.035);
      lastTime = t;

      // ── 첫인사 ───────────────────────────────────────────────
      // 등을 보이고 있다가 돌아서고, 정면이 되는 순간 놀라고('!'), 그제야
      // 웃으면서 인사한다. 이 동안에는 떠다니지도 부풀지도 혼잣말하지도
      // 않는다 — 한 번에 두 가지가 일어나면 둘 다 흐려진다.
      if (intro && !reduced) {
        if (!introAt) introAt = t;
        faceUntil = 0;
        if (intro === 'shut') {
          // 감았던 눈을 뜨는 그 순간에 '!'가 터진다. 둘이 같은 사건이다.
          if (t - introAt > SHUT_MS) {
            setEyes('general');
            setSay({ text: '!', side: 'right', tilt: -8, quick: true });
            sayUntil = t + BANG_MS;
            intro = 'bang'; introAt = t;
          }
        } else if (intro === 'bang') {
          // 놀란 다음에 웃는다. 순서가 뒤집히면 인사가 먼저 와서 '!'가
          // 무엇에 놀란 것인지 알 수 없다.
          if (t > sayUntil) {
            sayUntil = 0; setSay(null);
            setEyes('happy');
            intro = 'welcome'; welcomeNext = t + WELCOME_GAP;
          }
        } else if (!sayUntil && t > welcomeNext) {
          if (welcomeIdx >= WELCOME.length) {
            intro = null;
            setEyes('general');
            nextSay = t + 1200;
          } else {
            // 양옆으로 번갈아. 두 마디가 같은 쪽에 서면 차례로 온 것이
            // 아니라 한 자리에서 글자만 바뀐 것으로 보인다.
            const w = WELCOME[welcomeIdx];
            setSay({ text: w.text, small: w.small, side: welcomeIdx % 2 ? 'left' : 'right', tilt: welcomeIdx % 2 ? 5 : -5 });
            sayUntil = t + WELCOME_MS;
            welcomeNext = t + WELCOME_MS + WELCOME_GAP;
            welcomeIdx++;
          }
        }
      } else if (intro && reduced) {
        // 움직임을 끈 사람에게는 차례가 없다 — 곧바로 정면으로 선다.
        setPose('front_center', t);
        intro = null;
      }

      if (visible && !reduced && !intro) {
        // 글자가 뜰 자리가 있어야 뱉는다. 둘을 본다:
        //   · 상자가 화면보다 넓으면 어디에 두든 한쪽이 잘린다
        //   · 몸 위로 글자 한 줄이 들어갈 자리가 워드마크 아래에 남아 있어야 한다
        const roomAbove = y - (size * depth * geo.span.y) / 2 - size * depth * 0.2;
        if (t > nextSay && !sayUntil &&
            (size * depth > w * 0.98 || roomAbove < introBottom + 8)) {
          nextSay = t + 1500;
        } else if (t > nextSay && !sayUntil) {
          setSay({
            text: SAY_POOL[Math.floor(Math.random() * SAY_POOL.length)],
            side: x < w / 2 ? 'right' : 'left',
            tilt: random(-14, 6)
          });
          sayUntil = t + SAY_MS;
        }
        // 이따금 고개를 돌린다. 부풀거나 말하는 중에는 가만히 둔다 —
        // 한 번에 두 가지가 일어나면 둘 다 흐려진다.
        if (t > nextPose && !sayUntil && t - lastPose > POSE_DWELL) {
          setPose(idlePose(), t);
          nextPose = t + random(2600, 6200);
        }
        contain();
      }

      // 2초가 지나면 조용히 무표정으로 돌아온다
      if (t > faceUntil && faceUntil > 0) {
        faceUntil = 0;
        setEyes('general');
      }
      // 글자는 제 시간을 다 살면 사라지고, 다음 것은 한참 뒤에 온다
      if (sayUntil && t > sayUntil) {
        sayUntil = 0;
        nextSay = t + random(7000, 15000);
        setSay(null);
      }

      // 형태 보간
      const raw = to === from ? 1 : clamp((t - now0) / TURN_MS, 0, 1);
      const p = easeInOut(raw);
      geo = raw >= 1 ? to : blendGeo(from, to, p);

      squash *= Math.exp(-dt * 12);
      // 회전의 결을 몸짓으로 거든다: 좌우로 돌 때 가로로 한 번 좁아진다.
      // 형태 변화만으로는 방향이 안 읽힌다.
      const swing = raw > 0 && raw < 1 ? Math.sin(Math.PI * raw) : 0;
      const spin = turn === 'spin' ? swing * 0.22 : 0;
      // 기울기는 흐르던 속도를 따라갔다. 이제 흐르지 않으므로 늘 곧게 선다.
      tilt += (0 - tilt) * (1 - Math.exp(-dt * 6));
      el.style.setProperty('--char-turn', String(1 - spin));

      paint(p);
      raf = requestAnimationFrame(step);
    };

    const resize = new ResizeObserver(measure);
    resize.observe(frame);
    resize.observe(el);
    measure();
    const onVisibility = () => { visible = !document.hidden; lastTime = 0; };
    const onReduced = () => {
      reduced = media.matches;
      tilt = squash = 0;
      paint(1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    media.addEventListener('change', onReduced);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', onReduced);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="home-char"
      data-eyes={eyes}
      role="img"
      aria-label="메가폰트 캐릭터"
    >
      {say && !matchMedia('(prefers-reduced-motion: reduce)').matches && (
        <span className="home-char-say" data-side={say.side} aria-hidden="true"
          data-small={say.small ? 'true' : undefined} data-quick={say.quick ? 'true' : undefined}
          style={{ '--say-tilt': `${say.tilt.toFixed(1)}deg` } as React.CSSProperties}>{say.text}</span>
      )}
      {/* 떠 있다는 것은 그림자가 말한다. 몸보다 아래, 몸보다 작게. */}
      <span className="home-char-shade" aria-hidden="true" />
      <span className="home-char-motion" aria-hidden="true">
        <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
          <g ref={trailRef} />
          <path ref={bodyRef} />
          <path ref={hatRef} />
          <circle ref={dotRef} r="0" />
          {/* 눈은 몸통 SVG 안의 중첩 svg 한 장이다. x·y·폭·높이는 매 프레임
              JS가 다시 쓴다.

              그 안에 표정이 두 겹으로 들어 있다 — 지금 짓고 있는 얼굴과,
              깜빡일 때의 얼굴(twinkle) 하나. 깜빡임은 둘을 **갈아 끼우는**
              것이다. 전에는 이 판을 통째로 세로로 눌렀는데(.mf-eye), 그건
              눈을 감은 게 아니라 눈이 납작해진 것으로 보였다 — 작가의 그림에서
              감은 눈은 눌린 동그라미가 아니라 아래로 굽은 활이다.

              두 겹을 미리 그려 두고 CSS가 투명도만 바꾸므로, 깜빡이는 동안
              React가 다시 그리지 않는다. 표정이 무엇이든 그 위로 깜빡인다. */}
          <svg
            className="home-char-eye"
            ref={eyeRef}
            viewBox="0 0 412.12 172.44"
            preserveAspectRatio="none"
            overflow="visible"
          >
            <g className="mf-eye-face" dangerouslySetInnerHTML={{ __html: eyeMarkup(eyes) }} />
            {/* 짓고 있는 얼굴이 이미 twinkle이면 갈아 끼울 것이 없다 —
                같은 마크업을 두 벌 넣을 이유가 없다. */}
            {eyes !== 'twinkle' && (
              <g className="mf-eye-wink" dangerouslySetInnerHTML={{ __html: eyeMarkup('twinkle') }} />
            )}
          </svg>
        </svg>
      </span>
    </div>
  );
}

// EYES는 아직 표정 목록으로 쓰이지만 지금은 벽 충돌에서 둘만 고른다.
void EYES;
