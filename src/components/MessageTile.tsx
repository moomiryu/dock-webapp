import { useEffect, useRef } from 'react';
import { fontMap } from '../lib/palettes';
import { graphics as graphicsV2 } from '../lib/graphics-v2';
import { moodAt } from '../lib/palettes-v2';
import type { ToneState } from '../types';

interface Props {
  text: string;
  tone: ToneState | null;
}

const FALLBACK_TONE: ToneState = {
  font: 'botong',
  tone: 1.0,
  wght: 400,
  slnt: 0,
  size: 32,
  paletteIdx: 0,
  graphicIdx: -1
};

export default function MessageTile({ text, tone }: Props) {
  const t = tone ?? FALLBACK_TONE;
  const m = moodAt(t.paletteIdx);
  const gfxRef = useRef<HTMLDivElement>(null);
  const txtRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gfxRef.current && t.graphicIdx >= 0 && t.graphicIdx < graphicsV2.length) {
      gfxRef.current.innerHTML = graphicsV2[t.graphicIdx];
      gfxRef.current.classList.add('active');
    }
    // Pulse animation per tile — start a small interval to highlight one word at a time
    if (!txtRef.current) return;
    const el = txtRef.current;
    el.innerHTML = text
      .trim()
      .split('\n')
      .map((line) =>
        line
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => `<span class="word">${escapeHtml(w)}</span>`)
          .join(' ')
      )
      .join('<br>');
    let idx = 0;
    const spans = el.querySelectorAll<HTMLSpanElement>('.word');

    // detect lines
    let curTop: number | null = null;
    let curLine = -1;
    spans.forEach((s) => {
      const top = Math.round(s.getBoundingClientRect().top);
      if (curTop === null || Math.abs(top - curTop) > 5) {
        curLine++;
        curTop = top;
      }
      s.dataset.line = String(curLine);
    });
    const lineCount = curLine + 1;
    if (lineCount === 0) return;

    function tick() {
      spans.forEach((s) => {
        s.classList.toggle('active', parseInt(s.dataset.line ?? '-1', 10) === idx);
      });
      idx = (idx + 1) % lineCount;
    }
    tick();
    // Each tile gets a random start offset so the wall isn't synchronized
    const offset = Math.random() * 2400;
    const timeoutId = window.setTimeout(() => {
      tick();
      const interval = window.setInterval(tick, 2400);
      el.dataset.intervalId = String(interval);
    }, offset);
    return () => {
      clearTimeout(timeoutId);
      const iid = el.dataset.intervalId;
      if (iid) clearInterval(parseInt(iid, 10));
    };
  }, [text, t.graphicIdx]);

  const low = Math.max(100, Math.round(t.wght * 0.5));

  return (
    <div
      className="msg-tile"
      style={{
        ['--bg' as string]: m.bg,
        ['--text' as string]: m.text,
        ['--graphic' as string]: m.graphic,
        ['--blend' as string]: m.blend,
        background: m.bg,
        color: m.text
      }}
    >
      <div className="msg-tile__preview">
        <div className="graphic-layer" ref={gfxRef} />
        <div
          className="preview-text"
          ref={txtRef}
          style={{
            fontFamily: fontMap[t.font],
            fontSize: Math.min(t.size, 30) + 'px',
            transform: `scaleX(${t.tone}) skewX(${t.slnt}deg)`,
            ['--wght-base' as string]: String(low),
            ['--wght-active' as string]: String(t.wght)
          }}
        />
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
