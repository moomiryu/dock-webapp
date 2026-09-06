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

    let pose: Pose = 'Front';
    let from: PoseGeo = poseGeometry(pose);
    let to: PoseGeo = from;
    let now0 = 0;              // 이번 회전이 시작된 시각
    let turn: 'spin' | 'roll' | 'none' = 'none';
    let turnDir = 1;
    let geo: PoseGeo = from;   // 지금 이 순간의 형태

    let w = 0, h = 0, size = 0, x = 0, y = 0;
    let vx = random(-25, 25), vy = 28, targetX = vx, targetY = vy;
    let held = false, pointer = -1, grabX = 0, grabY = 0, lastX = 0, lastY = 0, lastMove = 0;
    let nextWander = 0, lastPose = 0, lastBounce = 0, faceUntil = 0;
    let squash = 0, tilt = 0, raf = 0, lastTime = 0;
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
      if (x < (size * shape.x) / 2 || x > w - (size * shape.x) / 2 ||
          y < (size * shape.y) / 2 || y > h - (size * shape.y) / 2) return;
      turn = turnKind(pose, next);
      turnDir = /Left/.test(next) ? -1 : 1;
      from = geo;                    // 돌던 도중이면 지금 모습에서 이어서 돈다
      to = poseGeometry(next);
      now0 = now;
      pose = next;
      lastPose = now;
    };

    const bounds = () => ({
      rx: Math.min(w / 2, (size * geo.span.x) / 2 + 2),
      ry: Math.min(h / 2, (size * geo.span.y) / 2 + 2)
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

      el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
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
      if (!initialized) { x = w / 2; y = h * 0.46; initialized = true; }
      contain();
      paint(1);
    };

    /** 어느 쪽으로 가고 있느냐가 어느 쪽을 보느냐를 정한다 */
    const facing = (): Pose => {
      if (Math.abs(vy) > Math.abs(vx) * 1.5)
        return vy < 0 ? 'Vertical Front' : vx < 0 ? 'Vertical Left' : 'Vertical Right';
      if (Math.hypot(vx, vy) > 360) return vx < 0 ? 'Light Right' : 'Light Left';
      if (vx < -12) return 'Left';
      if (vx > 12) return 'Front';
      return pose;
    };

    const step = (t: number) => {
      const dt = Math.min((t - (lastTime || t)) / 1000, 0.035);
      lastTime = t;

      if (visible && !held && !reduced) {
        if (t > nextWander) {
          const angle = random(0, Math.PI * 2);
          targetX = Math.cos(angle) * random(18, 38);
          targetY = Math.sin(angle) * random(18, 38);
          nextWander = t + random(2800, 5200);
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

      // 형태 보간
      const raw = to === from ? 1 : clamp((t - now0) / TURN_MS, 0, 1);
      const p = easeInOut(raw);
      geo = raw >= 1 ? to : blendGeo(from, to, p);

      squash *= Math.exp(-dt * 12);
      // 회전의 결을 몸짓으로 거든다: 좌우로 돌면 가로로 한 번 좁아지고,
      // 눕거나 서면 그쪽으로 한 번 기운다. 형태 변화만으로는 방향이 안 읽힌다.
      const swing = raw > 0 && raw < 1 ? Math.sin(Math.PI * raw) : 0;
      const spin = turn === 'spin' ? swing * 0.22 : 0;
      const roll = turn === 'roll' ? swing * 10 * turnDir : 0;
      const drift = reduced ? 0 : clamp(vx / 70, -4, 4);
      tilt += (drift + roll - tilt) * (1 - Math.exp(-dt * 6));
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
    const onReduced = () => { reduced = media.matches; vx = vy = tilt = squash = 0; paint(1); };
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
      <span className="home-char-motion" aria-hidden="true">
        <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
          <g ref={trailRef} />
          <path ref={bodyRef} />
          <path ref={hatRef} />
          <circle ref={dotRef} r="0" />
          <svg
            ref={eyeRef}
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
