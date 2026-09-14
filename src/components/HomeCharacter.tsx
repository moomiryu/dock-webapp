import { useEffect, useRef, useState } from 'react';
import {
  CANVAS, EYES, blendGeo, eyeMarkup, eyeOpacity, poseGeometry, toPathD, turnKind,
  type Eyes, type Pose, type PoseGeo
} from '../lib/characterMorph';

/** 한 포즈에서 다음 포즈로 형태가 넘어가는 데 걸리는 시간 (ms) */
const TURN_MS = 380;
/** 표정이 한 번 바뀌면 최소한 이만큼은 유지된다 (ms) */
const FACE_HOLD = 2000;
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
 * 크기는 제자리(1)가 기본이고, 가끔 한 번씩 커졌다 금세 돌아온다.
 *
 * 계속 오가게 두면 '크기가 계속 변하는 것'이 되어 버린다. 기본이 있고
 * 거기서 벗어났다 돌아와야 벗어난 것이 사건으로 읽힌다. 그래서 목표를
 * 따라가는 대신 한 번의 움직임으로 다룬다 — 부풀고, 잠깐 머물고, 돌아온다.
 */
const BURST_MAX = 2.35;
const BURST_MIN = 1.45;
const BURST_UP = 340;     // 부푸는 데 (ms)
const BURST_HOLD = 380;   // 그 크기로 머무는 동안
const BURST_BACK = 300;   // 돌아오는 데 — 올 때보다 빠르다

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
const WELCOME = ['안녕하세요', 'こんにちは', 'Hello'];
/** 한 마디가 떠 있는 시간 · 다음 마디까지의 틈 */
const WELCOME_MS = 1250, WELCOME_GAP = 220;
/** 떠오르고 자리를 잡을 틈. 곧바로 말하면 인사가 등장에 묻힌다 */
const WELCOME_DELAY = 650;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const random = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export default function HomeCharacter() {
  const ref = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const hatRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const eyeRef = useRef<SVGSVGElement>(null);
  const trailRef = useRef<SVGGElement>(null);

  // 표정만 React가 들고 있다. 벽에 닿을 때만 바뀌고 최소 2초를 버티므로
  // 리렌더가 드물다. 포즈와 위치는 매 프레임이라 DOM을 직접 만진다.
  const [eyes, setEyes] = useState<Eyes>('general');
  // 뱉은 글자. 표정과 같은 이유로 React가 들고 있다 — 몇 초에 한 번뿐이라
  // 리렌더가 드물다. 자리와 크기는 매 프레임이라 여전히 DOM을 직접 만진다.
  const [say, setSay] = useState<{ text: string; side: 'left' | 'right'; tilt: number } | null>(null);
  const api = useRef<{
    down: (e: React.PointerEvent) => void;
    move: (e: React.PointerEvent) => void;
    up: (e: React.PointerEvent, cancelled?: boolean) => void;
    key: (e: React.KeyboardEvent) => void;
  } | null>(null);

  useEffect(() => {
    const el = ref.current!;
    const frame = el.closest('.home-frame') as HTMLElement;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches;

    let pose: Pose = 'front_center';
    let from: PoseGeo = poseGeometry(pose);
    let to: PoseGeo = from;
    let now0 = 0;              // 이번 회전이 시작된 시각
    let turn: 'spin' | 'none' = 'none';
    let geo: PoseGeo = from;   // 지금 이 순간의 형태

    let w = 0, h = 0, size = 0, x = 0, y = 0;
    /** 워드마크·설명이 끝나는 높이. 글자는 그 아래에서만 뜬다 */
    let introBottom = 0;
    let vx = random(-25, 25), vy = 28, targetX = vx, targetY = vy;
    let held = false, pointer = -1, grabX = 0, grabY = 0, lastX = 0, lastY = 0, lastMove = 0;
    let nextWander = 0, lastPose = 0, lastBounce = 0, faceUntil = 0;
    let squash = 0, tilt = 0, raf = 0, lastTime = 0;
    let depth = 1;
    // 한 번 부푸는 동안의 상태. burstAt는 시작 시각, burstTo는 이번에 갈 크기.
    let burstAt = 0, burstTo = 1, nextBurst = 0;
    let nextSay = 0, sayUntil = 0;
    // 첫인사 — 세 마디를 다 하면 끝나고, 그 뒤로는 평소대로 논다.
    let welcomeIdx = 0, welcomeNext = 0, welcoming = true;
    let initialized = false, visible = !document.hidden;

    /** 표정은 사건이 있을 때만 바뀐다. 한 번 바뀌면 2초는 그 얼굴로 있는다. */
    const feel = (next: Eyes, now: number) => {
      if (now < faceUntil) return;
      faceUntil = now + FACE_HOLD;
      setEyes(next);
    };

    const setPose = (next: Pose, now: number) => {
      if (next === pose) return;
      const shape = poseGeometry(next).span;
      // 벽에 붙어 있을 때 더 큰 포즈로 바꾸면 안쪽으로 순간이동한 것처럼 보인다.
      if (x < (size * depth * shape.x) / 2 || x > w - (size * depth * shape.x) / 2 ||
          y < (size * depth * shape.y) / 2 || y > h - (size * depth * shape.y) / 2) return;
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

      const eye = eyeRef.current!;
      if (geo.eye) {
        eye.setAttribute('x', geo.eye.x.toFixed(2));
        eye.setAttribute('y', geo.eye.y.toFixed(2));
        eye.setAttribute('width', geo.eye.w.toFixed(2));
        eye.setAttribute('height', geo.eye.h.toFixed(2));
      }
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
      el.dataset.held = String(held);
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
      if (!initialized) { x = w / 2; y = h * 0.46; initialized = true; }
      contain();
      paint(1);
    };

    /**
     * 어느 쪽으로 가고 있느냐가 어느 쪽을 보느냐를 정한다.
     *
     * 문턱을 둘로 나눈 이유: 조금 흐를 때 몸까지 틀면 가만히 떠 있는 동안
     * 계속 좌우로 꺾인다. 그래서 느리면 눈만 그쪽으로 보내고(front_left·
     * front_right), 확실히 그쪽으로 갈 때만 몸을 튼다.
     * 위로 멀어질 때는 등을 보인다 — 뒷모습에는 눈이 없다.
     */
    const facing = (): Pose => {
      if (Math.hypot(vx, vy) > 360) return vx < 0 ? 'left_light' : 'right_light';
      if (vy < -40 && Math.abs(vy) > Math.abs(vx)) return vx < 0 ? 'back_left' : 'back_right';
      if (vx < -60) return 'left';
      if (vx > 60) return 'right';
      if (vx < -12) return 'front_left';
      if (vx > 12) return 'front_right';
      return 'front_center';
    };

    const step = (t: number) => {
      const dt = Math.min((t - (lastTime || t)) / 1000, 0.035);
      lastTime = t;

      // ── 첫인사 ───────────────────────────────────────────────
      // 정면·웃는 눈으로 묶어 두고 세 마디를 차례로 띄운다. 이 동안에는
      // 부풀기도 혼잣말도 돌지 않는다 — 한 번에 두 가지가 일어나면 둘 다
      // 흐려진다(부풀기와 혼잣말을 서로 막아 두는 것과 같은 이유다).
      if (welcoming && !reduced) {
        if (!welcomeNext) welcomeNext = t + WELCOME_DELAY;
        setPose('front_center', t);
        faceUntil = 0;
        setEyes('happy');
        if (!sayUntil && t > welcomeNext) {
          if (welcomeIdx >= WELCOME.length) {
            welcoming = false;
            setEyes('general');
            nextSay = t + 1200;
            nextBurst = t + 900;
          } else {
            // 양옆으로 번갈아. 두 마디가 같은 쪽에 서면 차례로 온 것이
            // 아니라 한 자리에서 글자만 바뀐 것으로 보인다.
            setSay({ text: WELCOME[welcomeIdx], side: welcomeIdx % 2 ? 'left' : 'right', tilt: welcomeIdx % 2 ? 5 : -5 });
            sayUntil = t + WELCOME_MS;
            welcomeNext = t + WELCOME_MS + WELCOME_GAP;
            welcomeIdx++;
          }
        }
      } else if (welcoming && reduced) {
        welcoming = false;
      }

      if (visible && !held && !reduced && !welcoming) {
        if (t > nextWander) {
          const angle = random(0, Math.PI * 2);
          targetX = Math.cos(angle) * random(18, 38);
          targetY = Math.sin(angle) * random(18, 38);
          nextWander = t + random(2800, 5200);
        }
        // 다음 부풀기는 언제 올지 모른다. 규칙적이면 사건이 아니라 박자가 된다.
        // 글자를 뱉는 동안에는 부풀지 않는다 — 글자가 몸을 따라 위로 밀려
        // 화면 밖으로 나가고, 한 번에 두 가지가 일어나 둘 다 흐려진다.
        if (!burstAt && !sayUntil && t > nextBurst) {
          burstAt = t;
          burstTo = random(BURST_MIN, BURST_MAX);
        }
        // 글자가 뜰 자리가 있어야 뱉는다. 셋을 본다:
        //   · 부푸는 중이면 참는다 — 뱉는 사이에 몸이 커져 글자를 밀어 올린다
        //   · 상자가 화면보다 넓으면 어디에 두든 한쪽이 잘린다
        //   · 몸 위로 글자 한 줄이 들어갈 자리가 워드마크 아래에 남아 있어야 한다
        //     (--say-floor 위로 여백 0.08 + 글자 높이 0.12 ≒ 상자의 0.2)
        const roomAbove = y - (size * depth * geo.span.y) / 2 - size * depth * 0.2;
        if (t > nextSay && !sayUntil &&
            (burstAt || size * depth > w * 0.98 || roomAbove < introBottom + 8)) {
          nextSay = t + 1500;
        } else if (t > nextSay && !sayUntil) {
          // 어느 쪽에 뱉을지는 취향이 아니라 자리 문제다 — 화면 가운데 쪽으로.
          setSay({
            text: SAY_POOL[Math.floor(Math.random() * SAY_POOL.length)],
            side: x < w / 2 ? 'right' : 'left',
            tilt: random(-14, 6)
          });
          sayUntil = t + SAY_MS;
        }
        const ease = 1 - Math.exp(-dt * 0.8);
        vx += (targetX - vx) * ease;
        vy += (targetY - vy) * ease;
        x += vx * dt;
        y += vy * dt;

        const { rx, ry } = bounds();
        let hit = false;
        if (x < rx) { x = rx; vx = Math.abs(vx) * 0.78; targetX = Math.abs(targetX); hit = true; }
        if (x > w - rx) { x = w - rx; vx = -Math.abs(vx) * 0.78; targetX = -Math.abs(targetX); hit = true; }
        if (y < ry) { y = ry; vy = Math.abs(vy) * 0.78; targetY = Math.abs(targetY); hit = true; }
        if (y > h - ry) { y = h - ry; vy = -Math.abs(vy) * 0.78; targetY = -Math.abs(targetY); hit = true; }

        // 벽에 부딪히는 것이 이 캐릭터에게 일어나는 유일한 사건이다.
        // 표정은 여기서만 바뀐다 — 가만히 떠다니는 동안은 무표정이다.
        if (hit && t - lastBounce > 450) {
          lastBounce = t;
          squash = 0.09;
          feel(Math.random() < 0.75 ? 'surprise' : 'angry', t);
        }
        if (t - lastPose > POSE_DWELL) setPose(facing(), t);
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

      // 부풀기는 목표를 쫓아가는 게 아니라 한 번 지나가는 것이다.
      // 시간으로 끊어야 '금세 돌아온다'가 지켜진다.
      if (reduced) { depth = 1; burstAt = 0; }
      else if (burstAt) {
        const age = t - burstAt;
        if (age < BURST_UP) depth = 1 + (burstTo - 1) * easeInOut(age / BURST_UP);
        else if (age < BURST_UP + BURST_HOLD) depth = burstTo;
        else if (age < BURST_UP + BURST_HOLD + BURST_BACK) {
          depth = burstTo + (1 - burstTo) * easeInOut((age - BURST_UP - BURST_HOLD) / BURST_BACK);
        } else {
          depth = 1;
          burstAt = 0;
          nextBurst = t + random(5000, 16000);
        }
      }

      squash *= Math.exp(-dt * 12);
      // 회전의 결을 몸짓으로 거든다: 좌우로 돌 때 가로로 한 번 좁아진다.
      // 형태 변화만으로는 방향이 안 읽힌다.
      const swing = raw > 0 && raw < 1 ? Math.sin(Math.PI * raw) : 0;
      const spin = turn === 'spin' ? swing * 0.22 : 0;
      const drift = reduced ? 0 : clamp(vx / 70, -4, 4);
      tilt += (drift - tilt) * (1 - Math.exp(-dt * 6));
      el.style.setProperty('--char-turn', String(1 - spin));

      paint(p);
      raf = requestAnimationFrame(step);
    };

    api.current = {
      down(e) {
        if (held || !e.isPrimary || e.button !== 0) return;
        held = true;
        pointer = e.pointerId;
        el.setPointerCapture(pointer);
        const r = frame.getBoundingClientRect();
        grabX = e.clientX - r.left - x;
        grabY = e.clientY - r.top - y;
        lastX = x; lastY = y; lastMove = performance.now();
        vx = vy = 0;
        paint(1);
      },
      move(e) {
        if (!held || e.pointerId !== pointer) return;
        const r = frame.getBoundingClientRect();
        const t = performance.now();
        x = e.clientX - r.left - grabX;
        y = e.clientY - r.top - grabY;
        contain();
        const dt = Math.max((t - lastMove) / 1000, 0.008);
        vx = vx * 0.35 + clamp((x - lastX) / dt, -1100, 1100) * 0.65;
        vy = vy * 0.35 + clamp((y - lastY) / dt, -1100, 1100) * 0.65;
        lastX = x; lastY = y; lastMove = t;
        if (!reduced && t - lastPose > POSE_DWELL) setPose(facing(), t);
        contain();
      },
      up(e, cancelled = false) {
        if (!held || e.pointerId !== pointer) return;
        held = false;
        pointer = -1;
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const t = performance.now();
        if (cancelled || reduced || t - lastMove > 120) vx = vy = 0;
        const speed = Math.hypot(vx, vy);
        if (speed > 850) { vx *= 850 / speed; vy *= 850 / speed; }
        contain();
      },
      key(e) {
        const step: Record<string, number[]> = {
          ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24]
        };
        if (step[e.key]) {
          e.preventDefault();
          const [dx, dy] = step[e.key];
          x += dx; y += dy; vx = dx; vy = dy;
          contain();
          setPose(facing(), performance.now());
        }
      }
    };

    const resize = new ResizeObserver(measure);
    resize.observe(frame);
    resize.observe(el);
    measure();
    const onVisibility = () => { visible = !document.hidden; lastTime = 0; };
    const onReduced = () => {
      reduced = media.matches;
      vx = vy = tilt = squash = 0;
      if (reduced) { depth = 1; burstAt = 0; }
      paint(1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    media.addEventListener('change', onReduced);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      api.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', onReduced);
    };
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className="home-char"
      data-eyes={eyes}
      aria-label="메가폰트 캐릭터. 드래그하거나 방향키로 움직여보세요"
      onPointerDown={(e) => api.current?.down(e)}
      onPointerMove={(e) => api.current?.move(e)}
      onPointerUp={(e) => api.current?.up(e)}
      onPointerCancel={(e) => api.current?.up(e, true)}
      onLostPointerCapture={(e) => api.current?.up(e, true)}
      onKeyDown={(e) => api.current?.key(e)}
    >
      {say && !matchMedia('(prefers-reduced-motion: reduce)').matches && (
        <span className="home-char-say" data-side={say.side} aria-hidden="true"
          style={{ '--say-tilt': `${say.tilt.toFixed(1)}deg` } as React.CSSProperties}>{say.text}</span>
      )}
      <span className="home-char-motion" aria-hidden="true">
        <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
          <g ref={trailRef} />
          <path ref={bodyRef} />
          <path ref={hatRef} />
          <circle ref={dotRef} r="0" />
          {/* 눈은 몸통 SVG 안의 중첩 svg 한 장이다. 그래서 눈알을 하나씩
              찾을 것도 없이 이 한 장을 세로로 눌러 감으면 된다(.mf-eye).
              x·y·폭·높이는 매 프레임 JS가 다시 쓰지만 transform은 안 건드리므로
              깜빡임과 다투지 않는다. */}
          <svg
            ref={eyeRef}
            className="mf-eye"
            viewBox="0 0 412.12 172.44"
            preserveAspectRatio="none"
            overflow="visible"
            dangerouslySetInnerHTML={{ __html: eyeMarkup(eyes) }}
          />
        </svg>
      </span>
    </button>
  );
}

// EYES는 아직 표정 목록으로 쓰이지만 지금은 벽 충돌에서 둘만 고른다.
void EYES;
