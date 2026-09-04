import { useEffect, useMemo, useRef } from 'react';
import BackButton from '../components/BackButton';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import type { ToneState } from '../types';

interface Props {
  text: string;
  tone: ToneState;
  onConfirm: () => void;
  onBack: () => void;
}

// 실제 외벽 디스플레이 — 2.4 × 1.5 m (16:10)
export const WALL_W_M = 2.4;
export const WALL_H_M = 1.5;

export default function PhasePreview({ text, tone, onConfirm, onBack }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);

  const mood = moods[tone.paletteIdx % moods.length];
  const lines = useMemo(() => text.split('\n'), [text]);

  // /wall의 강조 렌더와 같은 자동 맞춤 공식. 단위만 뷰포트(vw/vh)에서
  // 컨테이너(cqw/cqh)로 바꿔, 이 작은 액자가 실제 외벽과 같은 비율로 글자를 키운다.
  // 가장 긴 줄이 폭의 88%, 전체 줄이 높이의 82%에 맞춰진다.
  const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
  const fitSize = `clamp(6px, min(${(88 / longest).toFixed(2)}cqw, ${(
    82 /
    (lines.length * 1.25)
  ).toFixed(2)}cqh), 200px)`;

  // 그 글자가 실제 외벽에서 몇 cm가 되는지 — 스케일을 숫자로 붙여준다.
  const glyphCm = Math.round(((WALL_W_M * 100) / longest) * 0.88);

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
          <span>글자 약 {glyphCm}cm</span>
          <span>7일간</span>
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
