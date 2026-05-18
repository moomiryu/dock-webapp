import { useEffect, useMemo, useRef, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { graphics as graphicsV2 } from '../lib/graphics-v2';
import { moods, nextMoodIndex } from '../lib/palettes-v2';
import type { ToneState } from '../types';

interface Props {
  initialText: string;
  initialTone?: ToneState | null;
  onSubmit: (text: string, tone: ToneState) => void;
}

const MAX = 60;
const DEFAULT_TONE: ToneState = {
  font: 'gothic',
  tone: 1.0,
  wght: 400,
  slnt: 0,
  size: 40,
  paletteIdx: 0,
  graphicIdx: -1
};

// Reduced control sets — Option Z prefers fewer choices, bigger consequences.
const FONT_OPTIONS: Array<{ val: ToneState['font']; label: string }> = [
  { val: 'mono', label: '모노' },
  { val: 'gothic', label: '고딕' },
  { val: 'myeongjo', label: '명조' }
];
const TONE_OPTIONS = [
  { val: 0.7, label: '장' },
  { val: 1.0, label: '평' },
  { val: 1.3, label: '평체' }
];
const WGHT_OPTIONS = [
  { val: 100, label: 'THIN' },
  { val: 400, label: 'RGLR' },
  { val: 700, label: 'BOLD' },
  { val: 900, label: 'BLAK' }
];
const SLNT_OPTIONS = [
  { val: 0, label: 'UPRT' },
  { val: -8, label: 'OBLQ' }
];

export default function PhaseZUnified({ initialText, initialTone, onSubmit }: Props) {
  const [text, setText] = useState(initialText);
  const [moodIdx, setMoodIdx] = useState(initialTone?.paletteIdx ?? 0);
  const [graphicIdx, setGraphicIdx] = useState(initialTone?.graphicIdx ?? -1);
  const [tone, setTone] = useState<Omit<ToneState, 'paletteIdx' | 'graphicIdx'>>({
    font: initialTone?.font ?? DEFAULT_TONE.font,
    tone: initialTone?.tone ?? DEFAULT_TONE.tone,
    wght: initialTone?.wght ?? DEFAULT_TONE.wght,
    slnt: initialTone?.slnt ?? DEFAULT_TONE.slnt,
    size: initialTone?.size ?? DEFAULT_TONE.size
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const gfxRef = useRef<HTMLDivElement>(null);

  const mood = moods[moodIdx % moods.length];

  // Apply mood to body so it bleeds beyond the frame on mobile too
  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', mood.bg);
  }, [mood.bg]);

  // Last character — handles trailing whitespace by ignoring it
  const lastChar = useMemo(() => {
    const trimmed = text.replace(/\s+$/u, '');
    return trimmed.length > 0 ? trimmed.slice(-1) : '말';
  }, [text]);

  // Mini preview pulse — port the line-detection logic but lightweight
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

  function cycleMood() {
    setMoodIdx((i) => nextMoodIndex(i));
  }

  function cycleGraphic() {
    let n = graphicIdx;
    do {
      n = Math.floor(Math.random() * graphicsV2.length);
    } while (n === graphicIdx && graphicsV2.length > 1);
    if (graphicIdx !== -1 && Math.random() < 0.15) {
      setGraphicIdx(-1);
    } else {
      setGraphicIdx(n);
    }
  }

  function handleSubmit() {
    const final = text.trim().slice(0, MAX);
    if (!final) return;
    onSubmit(final, {
      ...tone,
      paletteIdx: moodIdx,
      graphicIdx
    });
  }

  const lowWght = Math.max(100, Math.round(tone.wght * 0.5));

  return (
    <div
      className="z-frame"
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
        <span>DOCK</span>
        <span>{mood.nameLatin} · 말 + 톤</span>
      </div>

      <div className="z-controls">
        <ControlRow
          label="FONT"
          options={FONT_OPTIONS.map((o) => ({ val: o.val as unknown as number, label: o.label, active: tone.font === o.val }))}
          onPick={(_v, i) => setTone((t) => ({ ...t, font: FONT_OPTIONS[i].val }))}
        />
        <ControlRow
          label="WGHT"
          options={WGHT_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.wght === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, wght: v }))}
        />
        <ControlRow
          label="TONE"
          options={TONE_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.tone === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, tone: v }))}
        />
        <ControlRow
          label="SLNT"
          options={SLNT_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.slnt === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, slnt: v }))}
        />
      </div>

      <div className="z-glyph-stage">
        <div className="graphic-layer" ref={gfxRef} />
        <div
          className="z-glyph"
          data-glyph={lastChar}
          style={{
            fontFamily: fontMap[tone.font],
            fontWeight: tone.wght,
            fontVariationSettings: `"wght" ${tone.wght}`,
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            color: mood.text
          }}
        >
          {lastChar}
        </div>
      </div>

      <div className="z-preview-wrap">
        <div
          className="z-preview"
          ref={previewRef}
          style={{
            fontFamily: fontMap[tone.font],
            fontSize: Math.min(tone.size, 22) + 'px',
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            ['--wght-base' as string]: String(lowWght),
            ['--wght-active' as string]: String(tone.wght),
            color: mood.text
          }}
        />
        <div className="z-counter">{text.length} / {MAX}</div>
      </div>

      <textarea
        ref={textareaRef}
        className="z-input"
        value={text}
        maxLength={MAX}
        placeholder="여기에 적어주세요 — 마지막 글자가 위에 떠올라요"
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        autoFocus
      />

      <div className="z-actions">
        <button className="pill" onClick={cycleGraphic}>
          <span>★ STAR</span>
        </button>
        <button className="pill" onClick={cycleMood}>
          <span>COLOR · {mood.nameLatin}</span>
        </button>
      </div>

      <button className="primary-action" disabled={!text.trim()} onClick={handleSubmit}>
        <span>맡 기 기</span>
      </button>
    </div>
  );
}

function ControlRow({
  label,
  options,
  onPick
}: {
  label: string;
  options: Array<{ val: number; label: string; active: boolean }>;
  onPick: (v: number, i: number) => void;
}) {
  return (
    <div className="z-ctrl">
      <div className="z-ctrl-label">{label}</div>
      <div className="z-ctrl-row">
        {options.map((o, i) => (
          <button
            key={i}
            className={'pill ' + (o.active ? 'on' : '')}
            onClick={() => onPick(o.val, i)}
          >
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
