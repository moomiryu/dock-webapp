import { useEffect, useRef } from 'react';
import { fontMap } from '../lib/palettes';
import { graphics as graphicsV2 } from '../lib/graphics-v2';
import { moods } from '../lib/palettes-v2';
import type { ToneState } from '../types';

interface Props {
  text: string;
  tone: ToneState;
  onConfirm: () => void;
  onBack: () => void;
}

export default function PhasePreview({ text, tone, onConfirm, onBack }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const gfxRef = useRef<HTMLDivElement>(null);

  const mood = moods[tone.paletteIdx % moods.length];

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', mood.bg);
  }, [mood.bg]);

  // Build word spans + line pulse (same rhythm as the compose stage / wall)
  useEffect(() => {
    if (!previewRef.current) return;
    const el = previewRef.current;
    const visible = text.trim();
    if (!visible) {
      el.innerHTML = '';
      return;
    }
    const words = visible.split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="word">${escapeHtml(w)}</span>`).join(' ');
    const spans = el.querySelectorAll<HTMLSpanElement>('.word');

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

    let idx = 0;
    function tick() {
      spans.forEach((s) => {
        s.classList.toggle('active', parseInt(s.dataset.line ?? '-1', 10) === idx);
      });
      idx = (idx + 1) % lineCount;
    }
    tick();
    const interval = window.setInterval(tick, 2400);
    return () => clearInterval(interval);
  }, [text, tone.font, tone.tone, tone.wght, tone.slnt, tone.size]);

  // Graphic layer
  useEffect(() => {
    if (!gfxRef.current) return;
    if (tone.graphicIdx >= 0 && tone.graphicIdx < graphicsV2.length) {
      gfxRef.current.innerHTML = graphicsV2[tone.graphicIdx];
      gfxRef.current.classList.add('active');
    } else {
      gfxRef.current.classList.remove('active');
      gfxRef.current.innerHTML = '';
    }
  }, [tone.graphicIdx]);

  const lowWght = Math.max(100, Math.round(tone.wght * 0.5));

  return (
    <div
      className="z-frame z2"
      style={{
        ['--bg' as string]: mood.bg,
        ['--text' as string]: mood.text,
        ['--graphic' as string]: mood.graphic,
        ['--blend' as string]: mood.blend,
        background: mood.bg,
        color: mood.text
      }}
    >
      <div className="z-header">
        <button className="z-back" onClick={onBack} aria-label="다시 손보기">
          ← 다시 손보기
        </button>
        <span>3 / 3 · 미리보기</span>
      </div>

      <div className="z-full-stage">
        <div className="z-stage-tracks" aria-hidden>
          <span style={{ top: '20%' }} />
          <span style={{ top: '50%' }} />
          <span style={{ top: '80%' }} />
        </div>
        <div className="graphic-layer" ref={gfxRef} />
        <div
          className="z-full-text"
          ref={previewRef}
          style={{
            fontFamily: fontMap[tone.font],
            fontSize: tone.size + 'px',
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            ['--wght-base' as string]: String(lowWght),
            ['--wght-active' as string]: String(tone.wght),
            color: mood.text
          }}
        />
        <div className="z-stage-caption">이대로 외벽에 올라가요</div>
      </div>

      <button className="primary-action" onClick={onConfirm}>
        <span>이대로 맡기기</span>
      </button>

      <button className="z-back z-preview-redo" onClick={onBack}>
        다시 손보기
      </button>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
