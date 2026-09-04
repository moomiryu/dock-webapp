import { useEffect, useMemo, useRef, useState } from 'react';
import BackButton from '../components/BackButton';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { fitFontSize } from '../lib/fit';
import type { ToneState } from '../types';

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

interface Props {
  initialText: string;
  partialTone: PartialTone;
  initialPaletteIdx?: number;
  onBack: () => void;
  onSubmit: (text: string, tone: ToneState) => void;
}

const MAX = 60;
const PLACEHOLDER = '여기에 말을 적어보세요';

// 효과(배경 그래픽) 기능은 걷어냈다 — 외벽 풍경에서는 렌더되지 않아
// 머무는 내내가 아니라 10초만 보였고, 라벨(받치기·감싸기)이 약속하는 '글자에 하는 행위'와
// 실제 구현(화면을 덮는 배경 도형)이 어긋나 있었다.
// Firestore 스키마는 유지하되 항상 꺼진 값으로 저장한다.
const GRAPHIC_OFF = -1;

export default function PhaseCompose({
  initialText,
  partialTone,
  initialPaletteIdx,
  onBack,
  onSubmit
}: Props) {
  const [text, setText] = useState(initialText);
  const [moodIdx, setMoodIdx] = useState(initialPaletteIdx ?? 0);

  const renderRef = useRef<HTMLDivElement>(null);

  const mood = moods[moodIdx % moods.length];
  const empty = !text.trim();

  // 쓰는 만큼 글자가 작아진다 — 외벽 액자는 정해진 크기라서.
  // 미리보기 화면과 같은 공식을 쓰되, 편집 중에는 읽을 수 있어야 하므로
  // 최소치를 조금 높게 잡는다.
  const fitSize = useMemo(
    () => fitFontSize(empty ? PLACEHOLDER : text, { min: 13 }),
    [text, empty]
  );

  // 입력창과 미리보기는 한 몸이다. 아래에 실제 렌더(줄 펄스 포함)를 깔고
  // 그 위에 투명 textarea를 겹쳐 커서와 선택만 textarea 것을 쓴다.
  // 둘은 같은 부모에서 폰트·자간·정렬·변형을 물려받아야 글자가 어긋나지 않는다.
  useEffect(() => {
    if (!renderRef.current) return;
    const el = renderRef.current;
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
  }, [text, partialTone.font, partialTone.tone, partialTone.wght, partialTone.slnt]);

  function handleSubmit() {
    onSubmit(text.trim().slice(0, MAX), {
      ...partialTone,
      paletteIdx: moodIdx,
      graphicIdx: GRAPHIC_OFF
    });
  }

  const lowWght = Math.max(100, Math.round(partialTone.wght * 0.5));

  return (
    <div className="z-frame">
      <div className="z-header">
        <BackButton label="자형 다시 정하기" onClick={onBack} />
        <span>2 / 3 · 메시지</span>
      </div>

      <div className="proj-stage">
        {/* 미리보기 화면과 같은 16:10 액자. 여기서는 그 안에 직접 쓴다 */}
        <div className="proj-frame" style={{ background: mood.bg, color: mood.text }}>
          <div className="proj-tracks" aria-hidden>
            <span style={{ top: '20%' }} />
            <span style={{ top: '50%' }} />
            <span style={{ top: '80%' }} />
          </div>

          <div
            className="live-wrap"
            style={{
              fontFamily: fontMap[partialTone.font],
              fontSize: fitSize,
              transform: `scaleX(${partialTone.tone}) skewX(${partialTone.slnt}deg)`,
              ['--wght-base' as string]: String(lowWght),
              ['--wght-active' as string]: String(partialTone.wght)
            }}
          >
            {/* 아래층 — 실제로 보이는 글자 */}
            <div className="live-text" ref={renderRef} aria-hidden />
            {empty && (
              <div className="live-placeholder" aria-hidden>
                {PLACEHOLDER}
              </div>
            )}

            {/* 위층 — 보이지 않는 입력. 커서만 남는다 */}
            <textarea
              className="live-input"
              value={text}
              maxLength={MAX}
              aria-label="외벽에 올릴 한 줄"
              spellCheck={false}
              style={{ caretColor: mood.text }}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
            />
          </div>
        </div>

        <div className="proj-meta">
          <span>외벽에서 이렇게 보여요</span>
          <span className="proj-meta-end">
            {text.length}
            <span>/{MAX}</span>
          </span>
        </div>
      </div>

      {/* 색 — 무대가 이미 색을 보여주므로 버튼은 몇 번째인지만 센다 */}
      <button
        type="button"
        className="z-cycle"
        onClick={() => setMoodIdx((i) => (i + 1) % moods.length)}
        aria-label={`색 바꾸기 — 지금 ${moodIdx + 1}번째, 모두 ${moods.length}가지`}
      >
        <span className="z-cycle-count">
          {String(moodIdx + 1).padStart(2, '0')}
          <span> / {moods.length}</span>
        </span>
      </button>

      <button className="primary-action" disabled={empty} onClick={handleSubmit}>
        <span>미리보기</span>
      </button>

      <div className="z-progress">
        <span className="dot on" />
        <span className="dot on" />
        <span className="dot" />
        <span className="z-progress-label">자형 · 색 · 미리보기</span>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
