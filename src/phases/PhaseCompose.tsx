import { useEffect, useMemo, useRef, useState } from 'react';
import BackButton from '../components/BackButton';
import StepRail from '../components/StepRail';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { fitFontSize } from '../lib/fit';
import type { ToneState } from '../types';

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

interface Props {
  initialText: string;
  partialTone: PartialTone;
  initialPaletteIdx?: number;
  onBack: (text: string, tone: ToneState) => void;
  onSubmit: (text: string, tone: ToneState) => void;
}

const MAX = 60;
// 자판을 여는 것이 이 화면의 첫 동작이다. 안내는 그 동작을 그대로 말한다.
const PLACEHOLDER = '여기를 눌러 쓰세요';

// 효과(배경 그래픽) 기능은 걷어냈다 — 벽 풍경에서는 렌더되지 않아
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
  const moodIdx = initialPaletteIdx ?? 0;

  const renderRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 이 화면의 첫 동작은 자판을 여는 것이다. 열 수 있는 곳에서는 열어 둔다.
  // (iOS는 손짓 없이 자판을 올리지 않는다 — 그래서 안내 문구도 같이 둔다)
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const mood = moods[moodIdx % moods.length];
  const empty = !text.trim();

  // 쓰는 만큼 글자가 작아진다 — 벽 액자는 정해진 크기라서.
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
        <BackButton label="말투 다듬기로" onClick={() => onBack(text, { ...partialTone, paletteIdx: moodIdx, graphicIdx: GRAPHIC_OFF })} />
        <span>Step 3 / 5 · Write</span>
      </div>
      <StepRail step={3} />

      <div className="proj-stage is-bleed">
        {/* 미리보기 화면과 같은 16:10 액자. 여기서는 그 안에 직접 쓴다 */}
        <div className="proj-frame" style={{ background: '#000000', color: mood.text }}>
          <div className="proj-tracks" aria-hidden>
            <span style={{ top: '20%' }} />
            <span style={{ top: '50%' }} />
            <span style={{ top: '80%' }} />
          </div>

          <div className="compose-bubble" style={{ background: mood.bg }}>
          <div
            className="live-wrap"
            style={{
              fontFamily: fontMap[partialTone.font],
              fontSize: `calc(${fitSize} * 0.65 / ${Math.max(1, partialTone.tone) + Math.abs(Math.tan(partialTone.slnt * Math.PI / 180))})`,
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
              ref={inputRef}
              className="live-input"
              value={text}
              maxLength={MAX}
              aria-label="벽에 올릴 한 줄"
              spellCheck={false}
              style={{ caretColor: mood.text }}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
            />
          </div>
          </div>
        </div>

        <div className="proj-meta">
          <span>실제 스크린 비율이에요.</span>
          {/* 한계에 가까워지면 미리 알린다 — 60자에서 조용히 잘리면
              어디까지 저장됐는지 알 수 없다 */}
          <span className={'proj-meta-end ' + (text.length >= MAX - 10 ? 'is-near' : '')}>
            {text.length}
            <span>/{MAX}</span>
            {text.length >= MAX && <span className="proj-meta-full"> 여기까지예요</span>}
          </span>
        </div>


      </div>

      <button className="primary-action" disabled={empty} onClick={handleSubmit}>
        <span>
          다음<em>색 고르기</em>
        </span>
      </button>

    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
