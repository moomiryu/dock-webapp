import { useEffect, useRef, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { graphics as graphicsV2 } from '../lib/graphics-v2';
import { moods } from '../lib/palettes-v2';
import type { ToneState } from '../types';

interface Props {
  text: string;
  partialTone: Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;
  initialPaletteIdx?: number;
  initialGraphicIdx?: number;
  onBack: () => void;
  onSubmit: (text: string, tone: ToneState) => void;
}

export default function PhaseZ2Compose({
  text,
  partialTone,
  initialPaletteIdx,
  initialGraphicIdx,
  onBack,
  onSubmit
}: Props) {
  const [moodIdx, setMoodIdx] = useState(initialPaletteIdx ?? 0);
  const [graphicIdx, setGraphicIdx] = useState(initialGraphicIdx ?? -1);

  const previewRef = useRef<HTMLDivElement>(null);
  const gfxRef = useRef<HTMLDivElement>(null);

  const mood = moods[moodIdx % moods.length];

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', mood.bg);
  }, [mood.bg]);

  // Build word spans + line pulse
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
  }, [text, partialTone.font, partialTone.tone, partialTone.wght, partialTone.slnt, partialTone.size]);

  // Graphic layer
  useEffect(() => {
    if (!gfxRef.current) return;
    if (graphicIdx >= 0 && graphicIdx < graphicsV2.length) {
      gfxRef.current.innerHTML = graphicsV2[graphicIdx];
      gfxRef.current.classList.add('active');
    } else {
      gfxRef.current.classList.remove('active');
      setTimeout(() => {
        if (gfxRef.current && graphicIdx === -1) gfxRef.current.innerHTML = '';
      }, 500);
    }
  }, [graphicIdx]);

  // Swatch direct-select replaces cycle: user sees all options + taps one.

  function handleSubmit() {
    onSubmit(text, {
      ...partialTone,
      paletteIdx: moodIdx,
      graphicIdx
    });
  }

  const lowWght = Math.max(100, Math.round(partialTone.wght * 0.5));

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
        <button className="z-back" onClick={onBack} aria-label="음성 다시 정하기">
          ← 음성 다시
        </button>
        <span>2 / 2 · 색·그래픽 · {mood.nameLatin}</span>
      </div>

      <div className="z-full-stage">
        <div className="graphic-layer" ref={gfxRef} />
        <div
          className="z-full-text"
          ref={previewRef}
          style={{
            fontFamily: fontMap[partialTone.font],
            fontSize: partialTone.size + 'px',
            transform: `scaleX(${partialTone.tone}) skewX(${partialTone.slnt}deg)`,
            ['--wght-base' as string]: String(lowWght),
            ['--wght-active' as string]: String(partialTone.wght),
            color: mood.text
          }}
        />
      </div>

      <div className="z-picker">
        <div className="z-picker-label">COLOR</div>
        <div className="z-swatch-row">
          {moods.map((m, i) => (
            <button
              key={m.id}
              className={'z-swatch ' + (i === moodIdx ? 'on' : '')}
              onClick={() => setMoodIdx(i)}
              aria-label={m.nameLatin}
              style={{
                background: m.bg,
                color: m.text,
                borderColor: i === moodIdx ? m.graphic : 'transparent'
              }}
            >
              <span className="z-swatch-label">{m.nameLatin}</span>
              <span className="z-swatch-dot" style={{ background: m.graphic }} />
            </button>
          ))}
        </div>
      </div>

      <div className="z-picker">
        <div className="z-picker-header">
          <span className="z-picker-label">STAR</span>
          <button
            className={'z-off-btn ' + (graphicIdx === -1 ? 'on' : '')}
            onClick={() => setGraphicIdx(-1)}
          >
            OFF
          </button>
        </div>
        <div className="z-graphic-row">
          {graphicsV2.map((svg, i) => (
            <button
              key={i}
              className={'z-graphic-tile ' + (graphicIdx === i ? 'on' : '')}
              onClick={() => setGraphicIdx(i)}
              aria-label={`그래픽 ${i + 1}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ))}
        </div>
      </div>

      <button className="primary-action" onClick={handleSubmit}>
        <span>풍경에 맡기기</span>
      </button>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
