import { useEffect, useMemo, useRef, useState } from 'react';
import { characterArtwork, poseSize, type Pose, type Eyes, EYES } from '../lib/characterArtwork';

type Face = { pose: Pose; eyes: Eyes };
const random = (low: number, high: number) => low + Math.random() * (high - low);
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export default function HomeCharacter() {
  const ref = useRef<HTMLButtonElement>(null);
  const [face, setFace] = useState<Face>({ pose: 'Front', eyes: 'general' });
  const [previous, setPrevious] = useState<Face | null>(null);
  const api = useRef<{ down: (e: React.PointerEvent) => void; move: (e: React.PointerEvent) => void;
    up: (e: React.PointerEvent, cancelled?: boolean) => void; key: (e: React.KeyboardEvent) => void } | null>(null);
  const art = useMemo(() => characterArtwork(face.pose, face.eyes), [face]);
  const oldArt = useMemo(() => previous ? characterArtwork(previous.pose, previous.eyes) : '', [previous]);

  useEffect(() => {
    const el = ref.current!;
    const frame = el.closest('.home-frame') as HTMLElement;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches;
    let current: Face = { pose: 'Front', eyes: 'general' };
    let w = 0, h = 0, size = 0, x = 0, y = 0, vx = random(-25, 25), vy = 28;
    let held = false, pointer = -1, grabX = 0, grabY = 0, lastX = 0, lastY = 0, lastMove = 0;
    let targetX = vx, targetY = vy, nextWander = 0, nextFace = 0, expressionUntil = 0;
    let lastPose = 0, lastBounce = 0, squash = 0, tilt = 0, raf = 0, lastTime = 0, fadeTimer = 0;
    let initialized = false, visible = !document.hidden;
    const change = (pose: Pose, eyes: Eyes, now = performance.now()) => {
      // Do not teleport inward when a taller pose is requested beside an edge.
      const shape = poseSize(pose);
      if (x < size * shape.x / 2 || x > w - size * shape.x / 2 ||
          y < size * shape.y / 2 || y > h - size * shape.y / 2) pose = current.pose;
      if (pose === current.pose && eyes === current.eyes) return;
      clearTimeout(fadeTimer);
      setPrevious(reduced ? null : current);
      current = { pose, eyes };
      setFace(current);
      lastPose = now;
      fadeTimer = window.setTimeout(() => setPrevious(null), 240);
    };
    const bounds = () => {
      const shape = poseSize(current.pose);
      return { rx: Math.min(w / 2, size * shape.x / 2 + 2), ry: Math.min(h / 2, size * shape.y / 2 + 2) };
    };
    const contain = () => {
      const { rx, ry } = bounds();
      x = clamp(x, rx, w - rx); y = clamp(y, ry, h - ry);
    };
    const paint = () => {
      // Position and deformation stay on separate layers: the rectangle stays easy to grab.
      el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
      el.style.setProperty('--char-tilt', `${tilt}deg`);
      el.style.setProperty('--char-squash', String(1 - squash));
      el.style.setProperty('--char-stretch', String(1 + squash * 0.45));
      el.dataset.pose = current.pose; el.dataset.eyes = current.eyes;
      el.dataset.held = String(held);
    };
    const measure = () => {
      w = frame.clientWidth; h = frame.clientHeight; size = el.offsetWidth;
      if (!initialized) { x = w / 2; y = h * .46; initialized = true; }
      contain(); paint();
    };
    const directionPose = (): Pose => {
      if (Math.abs(vy) > Math.abs(vx) * 1.5) return vy < 0 ? 'Vertical Front' : (vx < 0 ? 'Vertical Left' : 'Vertical Right');
      if (Math.hypot(vx, vy) > 360) return vx < 0 ? 'Light Right' : 'Light Left';
      return vx < -12 ? 'Left' : vx > 12 ? 'Front' : 'Vertical Front';
    };
    const react = (now: number) => {
      if (now - lastBounce < 450) return;
      lastBounce = now; squash = reduced ? 0 : .09;
      expressionUntil = now + 850;
      change(directionPose(), Math.random() < .8 ? 'surprise' : 'angry', now);
    };
    const step = (now: number) => {
      const dt = Math.min((now - (lastTime || now)) / 1000, .035); lastTime = now;
      if (visible && !held && !reduced) {
        if (now > nextWander) {
          const angle = random(0, Math.PI * 2);
          targetX = Math.cos(angle) * random(18, 38); targetY = Math.sin(angle) * random(18, 38);
          nextWander = now + random(2800, 5200);
        }
        const ease = 1 - Math.exp(-dt * .8);
        vx += (targetX - vx) * ease; vy += (targetY - vy) * ease;
        x += vx * dt; y += vy * dt;
        const { rx, ry } = bounds();
        let hit = false;
        if (x < rx) { x = rx; vx = Math.abs(vx) * .78; targetX = Math.abs(targetX); hit = true; }
        if (x > w - rx) { x = w - rx; vx = -Math.abs(vx) * .78; targetX = -Math.abs(targetX); hit = true; }
        if (y < ry) { y = ry; vy = Math.abs(vy) * .78; targetY = Math.abs(targetY); hit = true; }
        if (y > h - ry) { y = h - ry; vy = -Math.abs(vy) * .78; targetY = -Math.abs(targetY); hit = true; }
        if (hit) react(now);
        if (now > nextFace && now > expressionUntil && now - lastPose > 1200) {
          let pose = directionPose();
          if (Math.random() < .22) pose = Math.random() < .5 ? 'Back Left' : 'Back Right';
          else if (Math.random() < .12) pose = 'Right';
          change(pose, EYES[Math.floor(random(0, EYES.length))], now);
          nextFace = now + random(2300, 4800);
        }
        contain();
      }
      squash *= Math.exp(-dt * 12);
      // A small tilt responds to velocity without uncontrolled spinning.
      tilt += ((reduced ? 0 : clamp(vx / 70, -4, 4)) - tilt) * (1 - Math.exp(-dt * 6));
      paint(); raf = requestAnimationFrame(step);
    };
    api.current = {
      down(e) {
        if (held || !e.isPrimary || e.button !== 0) return;
        held = true; pointer = e.pointerId; el.setPointerCapture(pointer);
        const r = frame.getBoundingClientRect();
        grabX = e.clientX - r.left - x; grabY = e.clientY - r.top - y;
        lastX = x; lastY = y; lastMove = performance.now(); vx = vy = 0;
        change('Front', 'happy'); paint();
      },
      move(e) {
        if (!held || e.pointerId !== pointer) return;
        const r = frame.getBoundingClientRect(), now = performance.now();
        x = e.clientX - r.left - grabX; y = e.clientY - r.top - grabY;
        contain();
        const dt = Math.max((now - lastMove) / 1000, .008);
        vx = vx * .35 + clamp((x - lastX) / dt, -1100, 1100) * .65;
        vy = vy * .35 + clamp((y - lastY) / dt, -1100, 1100) * .65;
        lastX = x; lastY = y; lastMove = now;
        if (!reduced && now - lastPose > 600) change(directionPose(), vx < 0 ? 'see left' : 'see right', now);
        contain(); paint();
      },
      up(e, cancelled = false) {
        if (!held || e.pointerId !== pointer) return;
        held = false; pointer = -1;
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        const now = performance.now();
        if (cancelled || reduced || now - lastMove > 120) vx = vy = 0;
        const speed = Math.hypot(vx, vy), limit = 850;
        if (speed > limit) { vx *= limit / speed; vy *= limit / speed; }
        change(reduced ? current.pose : directionPose(), speed > 220 && !cancelled ? 'surprise' : 'twinkle', now);
        expressionUntil = now + 1000; nextFace = now + 1500;
        contain(); paint();
      },
      key(e) {
        const vectors: Record<string, number[]> = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
        if (vectors[e.key]) { e.preventDefault(); const [dx, dy] = vectors[e.key]; x += dx; y += dy; vx = dx; vy = dy; contain(); paint(); }
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); change('Front', EYES[Math.floor(random(0, EYES.length))]); }
      }
    };
    const resize = new ResizeObserver(measure); resize.observe(frame); resize.observe(el); measure();
    const onVisibility = () => { visible = !document.hidden; lastTime = 0; };
    const onReduced = () => { reduced = media.matches; vx = vy = tilt = squash = 0; paint(); };
    document.addEventListener('visibilitychange', onVisibility); media.addEventListener('change', onReduced);
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); clearTimeout(fadeTimer); resize.disconnect(); api.current = null;
      document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener('change', onReduced); };
  }, []);

  return (
    <button ref={ref} type="button" className="home-char" aria-label="메가폰트 캐릭터. 드래그하거나 방향키로 움직여보세요"
      onPointerDown={e => api.current?.down(e)} onPointerMove={e => api.current?.move(e)}
      onPointerUp={e => api.current?.up(e)} onPointerCancel={e => api.current?.up(e, true)}
      onLostPointerCapture={e => api.current?.up(e, true)} onKeyDown={e => api.current?.key(e)}>
      <span className="home-char-motion" aria-hidden="true">
        {previous && <span className="home-char-art is-leaving" key={'old-' + previous.pose + previous.eyes} dangerouslySetInnerHTML={{ __html: oldArt }} />}
        <span className="home-char-art" key={face.pose + face.eyes} dangerouslySetInnerHTML={{ __html: art }} />
      </span>
    </button>
  );
}
