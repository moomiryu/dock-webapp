import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CANVAS, EYES, blendGeo, eyeMarkup, eyeOpacity, poseGeometry, toPathD, turnKind,
  type Eyes, type Pose, type PoseGeo
} from './morph';
import { charPos } from './pos';

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
 * 처음 오는 사람에게 건네는 세 마디.
 *
 * 인사 · 여기가 어디인가 · 무엇을 하면 되는가. 차례가 그 순서다.
 *
 * 마지막 마디가 한 번 빠졌다 들어왔다. 뺐던 이유는 '버튼 둘이 바로 아래에
 * 크게 서 있는데 그걸 누르라고 말로 이르는 것은 화면을 못 믿는다는 뜻'
 * 이라는 것이었는데, 2026-09-21에 다시 넣기로 했다. 이 화면은 지나가다
 * 처음 보는 사람 앞에 서 있고, 처음 보는 사람에게는 **무엇을 누르는
 * 것인지**가 자명하지 않다.
 *
 * 줄바꿈은 **뜻이 끊기는 자리**에 직접 넣는다. 자동에 맡겼더니 390에서
 * '아래 버튼을 눌러, 발화를 / 시작해보세요.'로 끊겼다 — 쉼표가 이미
 * 끊어 준 자리를 지나쳐 낱말 사이를 갈랐다. 뒤의 두 마디는 어느 화면에서든
 * 두 줄이 되므로(390에서 한 줄이 356px, 상자 상한이 359px이다) 어디서
 * 끊을지를 정해 두는 편이 낫다.
 *
 * 머무는 시간은 글자 수를 따라간다. 찍히는 데만 초당 22자로 0.8~1초가
 * 드니(TYPE_CPS), 다 찍힌 뒤 읽을 짬이 1.5초쯤 남게 잡았다.
 */
const WELCOME: Array<{ text: string; ms: number }> = [
  { text: '안녕하세요.', ms: 1400 },
  { text: '메가폰트 웹앱에 오신 걸\n환영해요.', ms: 2600 },
  { text: '아래 버튼을 눌러,\n발화를 시작해보세요.', ms: 2900 }
];
/** 다음 마디까지의 틈. 떠 있는 시간은 마디마다 다르다 — 길면 읽을 짬이 든다 */
const WELCOME_GAP = 220;
/**
 * 깨어나는 차례.
 *
 * 화면이 열리면 거기 있는 것은 **눈도 없는 빨강 한 덩어리**다. 그 덩어리가
 * 세 번 끔뻑이고 눈을 뜬다. 얼굴이 나타나는 것이 이 화면의 첫 사건이다.
 *
 * 2026-09-20까지는 '눈을 감고 있다'였고 감은 눈을 twinkle(◡)로 그렸는데,
 * 그건 흰자가 그대로 보이는 얼굴이라 덩어리가 아니라 **이미 얼굴**이었다.
 * 흰 동그라미 둘이 먼저 눈에 들어왔다. 눈을 아예 지워야 빨강에서 얼굴이
 * 나타나는 것이 된다.
 *
 * 첫 칸이 1300ms다. 그만큼은 덩어리인 채로 서 있어야 '눈이 없었다'가
 * 보인다. 같은 날 앞서 이 값은 빨강 막이 꺼지는 900ms를 품고 있었는데,
 * 그 막(00 Splash)이 없어졌으므로 이제 1300 전부가 덩어리의 시간이다.
 *
 * 뜨는 시간이 칸마다 길어진다. 같은 길이로 세 번 깜빡이면 신호등이지
 * 깨어나는 것이 아니다.
 */
const WAKE: Array<{ open: boolean; ms: number }> = [
  { open: false, ms: 1300 },
  { open: true, ms: 80 }, { open: false, ms: 190 },
  { open: true, ms: 120 }, { open: false, ms: 160 },
  { open: true, ms: 170 }, { open: false, ms: 130 }
];
/** 눈을 뜨고 터지는 '!' — 놀란 뒤에 웃는다 */
const BANG_MS = 900;
/**
 * 한 글자가 찍히는 빠르기 (초당 글자 수).
 *
 * 22자면 '메가폰트 웹에 오신 걸 / 환영합니다.' 열일곱 자가 0.77초에 다
 * 찍힌다. 그 마디가 1.9초 떠 있으므로 찍히고 나서 읽을 짬이 1.1초 남는다.
 * 더 빠르면 찍히는 것으로 안 보이고, 더 느리면 다 읽기 전에 사라진다.
 */
const TYPE_CPS = 22;

/**
 * 이 글자들을 Lineal이 그리는가.
 *
 * 한글·가나·한자가 하나라도 있으면 Pretendard로 떨어진다. 두 얼굴은 같은
 * 굵기 이름에서 줄기 두께가 다르므로(app.css의 .home-char-say) 어느 쪽이
 * 그리는지에 따라 굵기를 달리 준다.
 */
const isLatin = (t: string) => !/[぀-ヿ㐀-鿿가-힯＀-￯]/.test(t);

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
  const [eyes, setEyes] = useState<Eyes>('general');
  /**
   * 눈이 아예 없는 동안. 첫 프레임부터 그래야 빨강 덩어리로 보인다.
   *
   * 감은 눈을 그리지 않고 눈판을 통째로 숨긴다 — 흰자가 한 점이라도
   * 보이면 그건 덩어리가 아니라 얼굴이다(WAKE).
   */
  /**
   * 이 탭에서 이미 인사를 했는가.
   *
   * 인사는 **처음 온 사람에게 하는 것**이다. 소개를 보고 오거나 쓰다 말고
   * 뒤로 온 사람에게 다시 "안녕하세요"라고 하면, 화면이 그 사람을 기억
   * 못 하는 것이 된다.
   *
   * sessionStorage인 이유: 새로고침해도 이어지되 탭을 새로 열면 다시
   * 인사한다. 설치물 앞에 다음 사람이 서는 것이 곧 새 탭이다.
   */
  const greetedOnce = typeof sessionStorage !== 'undefined'
    && sessionStorage.getItem('mf-greeted') === '1';
  const [blind, setBlind] = useState(!greetedOnce);
  // 뱉은 글자. 표정과 같은 이유로 React가 들고 있다 — 몇 초에 한 번뿐이라
  // 리렌더가 드물다. 자리와 크기는 매 프레임이라 여전히 DOM을 직접 만진다.
  const [say, setSay] = useState<{
    text: string;
    /** 이 마디가 떠 있는 시간(ms). 뜨고 지는 결의 길이도 이것이다 */ ms: number;
  } | null>(null);
  /** 찍히는 중인 글자를 프레임마다 적는 자리. React를 거치지 않는다 */
  const sayEl = useRef<HTMLSpanElement>(null);
  /**
   * 안내 문구를 **액자에 직접** 건다.
   *
   * 캐릭터 안에 두면 캐릭터가 움직이고 기울 때 같이 흔들린다 — 읽을 것이
   * 생긴 이상 그러면 안 된다. 액자로 내보내면 캐릭터가 무엇을 하든 밤하늘
   * 한 자리에 가만히 선다.
   */
  const [frame, setFrame] = useState<HTMLElement | null>(null);

  useEffect(() => { setFrame((ref.current?.closest('.home-frame') as HTMLElement) ?? null); }, []);

  /* 인사를 건너뛰면 깨어나는 연출도 없다 — 눈을 뜬 채로 시작한다 */
  useEffect(() => { if (greetedOnce) setEyes('general'); }, [greetedOnce]);

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
    /** 액자에 마지막으로 적어 준 실루엣 자리. 안 바뀌었으면 다시 안 적는다 */
    let saidX = Infinity, saidY = Infinity;
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
    let sayUntil = 0;
    /** 지금 찍고 있는 마디. 한 글자씩 늘려 적는다 */
    let typing: { text: string; from: number; built?: boolean; shown?: number } | null = null;
    /**
     * 첫인사의 차례. 등 → 돌아섬 → '!' → 웃음 → 인사 넉 마디 → 평소.
     * 이 동안에는 떠다니지도 부풀지도 않는다.
     */
    let intro: 'wake' | 'bang' | 'welcome' | null = greetedOnce ? null : 'wake';
    if (greetedOnce) charPos.greeted = true;   // 구경꾼과 배경 글이 곧바로 시작한다
    let introAt = 0;
    let wakeIdx = 0;

    let welcomeIdx = 0, welcomeNext = 0;
    let initialized = false, visible = !document.hidden;

    const setPose = (next: Pose, now: number) => {
      if (next === pose) return;
      /* 가장자리 검사를 걷어냈다(2026-09-20).
         "벽에 붙어 있을 때 더 큰 포즈로 바꾸면 안쪽으로 순간이동한 것처럼
         보인다"를 막던 장치인데, 캐릭터가 떠다니지 않게 되면서 벽에 붙는
         일 자체가 없어졌다. 남겨 두니 **가운데에서도 넓은 포즈를 거절**해서
         소리가 뻗는 옆모습이 영영 안 나왔다 — 있는 것처럼 보이고 실제로는
         안 나오는 상태였다. */
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

      /* 글자가 앉을 자리 — 실루엣에서 직접 잰다.
         span으로 셈하던 때는 **실루엣이 상자 한가운데 있다고 치고** 있었다.
         옆모습은 몸이 한쪽으로 쏠려 있어서 그 가정이 깨지고, 글자가 몸에서
         동떨어진 데에 떴다. 왼쪽 끝·오른쪽 끝·윗변을 그때그때 잰다.

         **몸통과 모자를 같이 본다.** 몸통만 재면 윗변이 삼각형 꼭지가 되는데
         그 위에 모자가 한 뼘 더 서 있어서, 인사할 때 글자가 모자와 겹쳤다. */
      let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity;
      for (const part of [geo.body, geo.hat]) {
        for (let i = 0; i < part.length; i += 2) {
          const px = part[i], py = part[i + 1];
          if (px < bx0) bx0 = px;
          if (px > bx1) bx1 = px;
          if (py < by0) by0 = py;
        }
      }
      /* 같은 자리를 **액자 좌표로도** 적어 둔다.
         인사 문구는 액자에 직접 걸려 있어서(아래 createPortal) 캐릭터
         상자 안의 좌표를 읽을 수 없다. 상자는 (x-size/2, y-size/2)로
         옮겨진 뒤 가운데를 붙든 채 depth배 되므로, 상자 안의 점 p는
         액자에서 x + (p - size/2) * depth 자리에 온다.

         매 프레임 쓰지 않는다 — 값이 바뀌는 것은 포즈가 건너갈 때뿐인데
         (두둥실은 CSS가 맡는다), 액자에 변수를 쓰면 그 변수를 읽는 모든
         것이 다시 계산된다. 반 픽셀 넘게 움직였을 때만 적는다. */
      const cx = x + ((size * (bx0 + bx1)) / 2 / CANVAS - size / 2) * depth;
      const ty = y + ((size * by0) / CANVAS - size / 2) * depth;
      if (Math.abs(cx - saidX) > 0.5) { saidX = cx; frame.style.setProperty('--say-cx', `${cx.toFixed(1)}px`); }
      if (Math.abs(ty - saidY) > 0.5) { saidY = ty; frame.style.setProperty('--say-top', `${ty.toFixed(1)}px`); }

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
      // 나팔이 향한 쪽. 'left'는 입이 왼쪽이라 소리가 오른쪽으로 나간다.
      charPos.voice = pose.startsWith('left') ? 1 : -1;
      charPos.ready = initialized;
    };

    const measure = () => {
      w = frame.clientWidth;
      h = frame.clientHeight;
      size = el.offsetWidth;
      el.style.setProperty('--char-box', `${size}px`);
      if (!initialized) { x = w / 2; y = h * REST_Y; initialized = true; }
      contain();
      paint(1);
    };

    /**
     * 첫인사가 끝나면 **옆모습으로 돌아서고, 그 뒤로는 옆모습만 쓴다.**
     *
     * 정면(삼각형)은 인사하는 얼굴이다 — 눈을 맞추고 말을 건네는 자리.
     * 인사가 끝나면 이 물건은 다시 **메가폰**이 된다. 옆에서 본 꼴이
     * 그것이고, 홈에 서 있는 동안의 기본은 그쪽이다.
     *
     * 고를 수 있는 옆모습은 왼쪽·오른쪽 둘뿐이라 변화는 방향을 바꾸는 것
     * 하나다. 그래서 **반드시 반대쪽으로** 돈다 — 무작위로 고르면 절반은
     * 같은 쪽이 나와 setPose가 조용히 되돌아가고, 실제로는 한 방향으로
     * 굳어 버린다(26초를 지켜봤더니 내내 오른쪽이었다).
     * 대신 오래 머문다. 몇 초마다 돌아서면 두리번거리는 것이 되어 가만히
     * 서 있는 것으로 안 읽힌다.
     *
     * 소리가 뻗는 옆모습(_light) 둘도 같은 식구다. 넷 중에서 고르되
     * **방향은 반드시 바꾼다** — 왼쪽에 서 있었으면 오른쪽 둘 중 하나로.
     * 소리가 뻗는 쪽은 가끔만 나온다. 늘 뻗고 있으면 그건 상태지 사건이
     * 아니다.
     */
    const idlePose = (): Pose => {
      const toRight = pose === 'left' || pose === 'left_light';
      const loud = Math.random() < 0.35;
      return toRight
        ? (loud ? 'right_light' : 'right')
        : (loud ? 'left_light' : 'left');
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
        if (intro === 'wake') {
          // 빨강 덩어리에서 세 번 끔뻑이고 눈을 뜬다. '!'는 **마지막으로
          // 뜨는** 그 순간에 터진다 — 중간의 끔뻑임에 붙이면 아직 깨는
          // 중인데 놀란 것이 되어 차례가 무너진다.
          if (t - introAt > WAKE[wakeIdx].ms) {
            wakeIdx += 1;
            introAt = t;
            if (wakeIdx >= WAKE.length) {
              setBlind(false);
              setSay({ text: '!', ms: BANG_MS });
              typing = { text: '!', from: t };
              sayUntil = t + BANG_MS;
              intro = 'bang';
            } else {
              setBlind(!WAKE[wakeIdx].open);
            }
          }
        } else if (intro === 'bang') {
          // 놀란 다음에 웃는다. 순서가 뒤집히면 인사가 먼저 와서 '!'가
          // 무엇에 놀란 것인지 알 수 없다.
          if (t > sayUntil) {
            sayUntil = 0; setSay(null); typing = null;
            setEyes('happy');
            intro = 'welcome'; welcomeNext = t + WELCOME_GAP;
          }
        } else if (!sayUntil && t > welcomeNext) {
          if (welcomeIdx >= WELCOME.length) {
            intro = null;
            charPos.greeted = true;      // 이제 나팔에서 남의 말이 나온다
            try { sessionStorage.setItem('mf-greeted', '1'); } catch { /* 사파리 비공개 */ }
            setEyes('general');
            // 인사가 끝나면 곧바로 돌아선다. 정면은 인사하는 얼굴이었다.
            setPose(idlePose(), t);
            nextPose = t + random(5000, 9000);
          } else {
            // 양옆으로 번갈아. 두 마디가 같은 쪽에 서면 차례로 온 것이
            // 아니라 한 자리에서 글자만 바뀐 것으로 보인다.
            const w = WELCOME[welcomeIdx];
            setSay({ text: w.text, ms: w.ms });
            typing = { text: w.text, from: t };
            sayUntil = t + w.ms;
            welcomeNext = t + w.ms + WELCOME_GAP;
            welcomeIdx++;
          }
        }
      } else if (intro && reduced) {
        // 움직임을 끈 사람에게는 차례가 없다 — 곧바로 정면으로, 눈을 뜬 채.
        // 여기서 눈을 안 돌려주면 그 사람에게는 영영 덩어리로 남는다.
        setPose('front_center', t);
        setBlind(false);
        intro = null;
      }

      if (visible && !reduced && !intro) {
        // 이따금 고개를 돌린다. 부풀거나 말하는 중에는 가만히 둔다 —
        // 한 번에 두 가지가 일어나면 둘 다 흐려진다.
        if (t > nextPose && !sayUntil && t - lastPose > POSE_DWELL) {
          setPose(idlePose(), t);
          nextPose = t + random(5000, 9000);
        }
        contain();
      }

      // 2초가 지나면 조용히 무표정으로 돌아온다
      if (t > faceUntil && faceUntil > 0) {
        faceUntil = 0;
        setEyes('general');
      }
      // 인사 한 마디는 제 시간을 다 살면 사라진다. 그 뒤로 이 캐릭터가
      // 뱉는 글자는 없다 — 나팔에서 나오는 남의 말이 그 자리를 맡는다.
      /* 한 글자씩 찍는다. 글자를 다루는 물건이 제 입으로 말하는 자리라
         한꺼번에 떠오르는 것보다 찍히는 편이 이 화면의 말투에 맞는다.
         React를 거치지 않고 여기서 바로 적는다 — 초당 스물두 번씩 상태를
         갈면 홈 전체가 그만큼 다시 그려진다. 읽는 도구에는 이 글자가
         안 보이므로(aria-hidden) 덜 찍힌 글이 읽힐 걱정은 없다. */
      if (typing && sayEl.current) {
        /* 글자는 **처음부터 다 심어 두고** 안 보이게만 둔다. 한 글자씩
           이어 붙이면 상자가 글자마다 넓어지는데, 가운데 정렬이라 이미
           찍힌 글자가 매번 왼쪽으로 밀린다 — 읽던 자리가 흔들린다.
           visibility는 자리를 남기므로 줄바꿈도 처음부터 제자리다. */
        if (!typing.built) {
          sayEl.current.textContent = '';
          for (const ch of typing.text) {
            const one = document.createElement('span');
            one.textContent = ch;
            one.style.visibility = 'hidden';
            sayEl.current.appendChild(one);
          }
          typing.built = true;
          typing.shown = 0;
        }
        const n = Math.min(typing.text.length, Math.max(0, Math.floor(((t - typing.from) * TYPE_CPS) / 1000)));
        for (let i = typing.shown ?? 0; i < n; i++) {
          (sayEl.current.children[i] as HTMLElement | undefined)?.style.setProperty('visibility', 'visible');
        }
        typing.shown = n;
        if (n >= typing.text.length) typing = null;
      }

      if (sayUntil && t > sayUntil) {
        sayUntil = 0;
        setSay(null); typing = null;
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
      data-blind={blind ? 'true' : undefined}
      role="img"
      aria-label="메가폰트 캐릭터"
    >
      {frame && say && !matchMedia('(prefers-reduced-motion: reduce)').matches && createPortal(
        /* 글자는 비워 둔다 — 찍는 쪽(rAF)이 프레임마다 채운다. 여기에
           {say.text}를 적어 두면 React가 다시 그릴 때마다 다 찍힌 글로
           되돌아간다. */
        <span className="home-char-say" aria-hidden="true" ref={sayEl}
          data-latin={isLatin(say.text) ? 'true' : undefined}
          style={{ '--say-life': `${say.ms}ms` } as React.CSSProperties} />, frame)}
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
