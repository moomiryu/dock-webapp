import { useEffect, useMemo, useRef } from 'react';
import BackButton from '../components/BackButton';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { STAY_DAYS, WALL_H_M, WALL_W_M } from '../lib/wall';
import { fitFontSize, glyphCm } from '../lib/fit';
import type { ToneState } from '../types';

interface Props {
  text: string;
  tone: ToneState;
  onConfirm: () => void;
  onBack: () => void;
}

export default function PhasePreview({ text, tone, onConfirm, onBack }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);

  const mood = moods[tone.paletteIdx % moods.length];

  // 쓰기 화면과 같은 계산(lib/fit). 액자가 정해진 크기라 긴 문장은 작게 들어간다.
  const fitSize = useMemo(() => fitFontSize(text), [text]);
  const cm = useMemo(() => glyphCm(text, WALL_W_M), [text]);

  // Build word spans + line pulse (same rhythm as the compose stage / wall)
  useEffect(() => {
    if (!previewRef.current) return;
    const el = previewRef.current;
    const visible = text.trim();
    if (!visible) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = visible
      .split('\n')
      .map((line) =>
        line
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => `<span class="word">${escapeHtml(w)}</span>`)
          .join(' ')
      )
      .join('<br>');
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
  }, [text, tone.font, tone.tone, tone.wght, tone.slnt]);

  const lowWght = Math.max(100, Math.round(tone.wght * 0.5));

  return (
    <div className="z-frame">
      <div className="z-header">
        <BackButton label="다시 손보기" onClick={onBack} />
        <span>3 / 3 · 미리보기</span>
      </div>

      <div className="proj-stage">
        {/* 실제 외벽과 같은 16:10 액자 */}
        <div className="proj-frame" style={{ background: mood.bg, color: mood.text }}>
          <div className="proj-tracks" aria-hidden>
            <span style={{ top: '20%' }} />
            <span style={{ top: '50%' }} />
            <span style={{ top: '80%' }} />
          </div>
          <div
            className="proj-text"
            ref={previewRef}
            style={{
              fontFamily: fontMap[tone.font],
              fontSize: fitSize,
              transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
              ['--wght-base' as string]: String(lowWght),
              ['--wght-active' as string]: String(tone.wght)
            }}
          />
        </div>

        <div className="proj-meta">
          <span>
            {WALL_W_M} × {WALL_H_M} m
          </span>
          <span>글자 약 {cm}cm</span>
          <span>{STAY_DAYS}일간</span>
        </div>
      </div>

      <button className="primary-action" onClick={onConfirm}>
        <span>이대로 맡기기</span>
      </button>

      <div className="z-progress">
        <span className="dot on" />
        <span className="dot on" />
        <span className="dot on" />
        <span className="z-progress-label">자형 · 색 · 미리보기</span>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
