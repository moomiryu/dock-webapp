import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BackButton from '../components/BackButton';
import StepRail from '../components/StepRail';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { STAY_DAYS } from '../lib/wall';
import { fitFontSize } from '../lib/fit';
import MetaballFilter, { STROKE_EM, useGoo } from '../components/MetaballFilter';
import { SAMPLE_MESSAGES } from '../lib/samples';
import type { ToneState } from '../types';

interface Props {
  text: string;
  tone: ToneState;
  onConfirm: () => void;
  onBack: () => void;
}

// 04는 03과 그림이 같으면 존재할 이유가 없다.
// 여기서 보여줄 것은 '어떻게 생겼나'가 아니라 '어떻게 나타났다 사라지나'다.
//
//   빈 벽 → 아래에서 튀어올라 크게(꽂혀 있는 동안) → 작아져 풍경으로 들어감
//   → 다른 말들과 함께 사흘을 떠다님
//
// 검정 스크린 위에서 메시지 박스의 배경색과 글자색을 유지한다.
type Stage = 'empty' | 'burst' | 'hold' | 'settle' | 'ambient';

const SCRIPT: Array<{ to: Stage; after: number }> = [
  { to: 'burst', after: 600 },
  { to: 'hold', after: 1050 },
  { to: 'settle', after: 1600 },
  { to: 'ambient', after: 950 }
];

// 내 글은 가운데 트랙에 자리 잡고, 이웃들은 위아래 두 트랙에만 선다.
// 이렇게 나눠야 방금 쓴 글이 남의 글에 가려지지 않는다.
const TRACK_Y = [20, 50, 80];
const CROWD_TRACKS = [20, 80];
/** 트랙마다 같은 속도로 돌리고 위상을 균등하게 갈라 서로 겹치지 않게 한다 */
const CROWD_DURATION = [30, 38];

/** 미리보기에서 윤곽이 일렁이는 폭 — 벽에서 벌어질 일을 여기서 미리 보여준다 */
const PREVIEW_WAVE_RATIO = 0.22;

export default function PhasePreview({ text, tone, onConfirm, onBack }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  // 아래층은 위층과 같은 낱말 조각을 그대로 받아 쓴다. 두 층이 다른 글을
  // 담으면 덩어리가 글자를 놓친다.
  const blobRef = useRef<HTMLDivElement>(null);
  const goo = useGoo(PREVIEW_WAVE_RATIO);
  const [stage, setStage] = useState<Stage>('empty');
  const [run, setRun] = useState(0);

  const mood = moods[tone.paletteIdx % moods.length];
  const emphasised = stage === 'burst' || stage === 'hold';

  // 쓰기 화면과 같은 계산(lib/fit). 액자가 정해진 크기라 긴 문장은 작게 들어간다.
  const fitSize = useMemo(() => `calc(${fitFontSize(text)} * 0.65 / ${Math.max(1, tone.tone) + Math.abs(Math.tan(tone.slnt * Math.PI / 180))})`, [text, tone.tone, tone.slnt]);

  // 시퀀스. 모션을 끈 사용자에게는 읽을 수 있는 자리(크게 떠 있는 상태)에서 멈춘다 —
  // 풍경 크기로 줄여놓고 끝내면 자기 글을 못 읽는다.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStage('hold');
      return;
    }
    setStage('empty');
    const timers: number[] = [];
    let t = 0;
    for (const step of SCRIPT) {
      t += step.after;
      timers.push(window.setTimeout(() => setStage(step.to), t));
    }
    return () => timers.forEach((id) => clearTimeout(id));
  }, [run]);

  const replay = useCallback(() => setRun((n) => n + 1), []);

  // 줄 펄스 — 쓰기 화면·실제 벽과 같은 리듬
  useEffect(() => {
    if (!previewRef.current) return;
    const el = previewRef.current;
    const visible = text.trim();
    if (!visible) {
      el.innerHTML = '';
      if (blobRef.current) blobRef.current.innerHTML = '';
      return;
    }
    const markup = visible
      .split('\n')
      .map((line) =>
        line
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => `<span class="word">${escapeHtml(w)}</span>`)
          .join(' ')
      )
      .join('<br>');
    el.innerHTML = markup;
    if (blobRef.current) blobRef.current.innerHTML = markup;
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
        <BackButton label="색 다시 고르기" onClick={onBack} />
        <span>5 / 5 · 벽에서 보기</span>
      </div>
      <StepRail step={5} />

      <div className="proj-stage">
        <div className={`sim is-${stage}`}>
          {/* 실제 벽과 같은 16:10 액자 */}
          <div
            className="sim-frame"
            style={{ background: '#000000' }}
          >
            <div className="sim-tracks" aria-hidden>
              {TRACK_Y.map((y) => (
                <span key={y} style={{ top: `${y}%` }} />
              ))}
            </div>

            {/* 사흘을 함께 떠다닐 이웃들 */}
            <div className="sim-crowd" aria-hidden>
              {SAMPLE_MESSAGES.map((s, i) => {
                const lane = i % CROWD_TRACKS.length;
                const slot = Math.floor(i / CROWD_TRACKS.length);
                const perLane = Math.ceil(SAMPLE_MESSAGES.length / CROWD_TRACKS.length);
                const dur = CROWD_DURATION[lane];
                return (
                <div
                  key={i}
                  className="sim-lane"
                  style={{
                    top: `${CROWD_TRACKS[lane]}%`,
                    animationDuration: `${dur}s`,
                    animationDelay: `${-((slot * dur) / perLane).toFixed(2)}s`
                  }}
                >
                  <span
                    className="sim-crowd-item"
                    style={{
                      color: moods[s.tone.paletteIdx % moods.length].text,
                      background: moods[s.tone.paletteIdx % moods.length].bg,
                      fontFamily: fontMap[s.tone.font],
                      fontWeight: s.tone.wght
                    }}
                  >
                    {s.text}
                  </span>
                </div>
                );
              })}
            </div>

            {/* 내 한 줄 — 가로 흐름은 lane이, 등장·축소는 mine이 맡는다 */}
            <div className="sim-mine-lane">
              <div
                ref={goo.hostRef}
                className="sim-mine voice-bubble"
                style={{ ['--blob' as string]: mood.bg, color: mood.text, fontSize: fitSize }}
              >
                <MetaballFilter id={goo.filterId} blur={goo.blur} wave={goo.wave} freq={goo.freq} />

                {/* 아래층 -- 덩어리. 줄 펄스는 위층만 타므로 여기는 늘 굵은
                    쪽으로 고정한다. 얇은 쪽에 맞춰 두면 펄스가 지나갈 때
                    글자가 덩어리보다 굵어져 밖으로 삐져나온다. */}
                <div className="voice-blob" style={{ filter: `url(#${goo.filterId})` }} aria-hidden>
                  <div
                    className="sim-mine-tone"
                    style={{ transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)` }}
                  >
                    <div
                      className="proj-text"
                      ref={blobRef}
                      style={{
                        fontFamily: fontMap[tone.font],
                        fontSize: fitSize,
                        WebkitTextStrokeWidth: `${STROKE_EM}em`,
                        ['--wght-base' as string]: String(tone.wght),
                        ['--wght-active' as string]: String(tone.wght)
                      }}
                    />
                  </div>
                </div>

                <div
                  className="sim-mine-tone"
                  style={{ transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)` }}
                >
                  <div
                    className="proj-text"
                    ref={previewRef}
                    style={{
                      fontFamily: fontMap[tone.font],
                      fontSize: fitSize,
                      color: mood.text,
                      ['--wght-base' as string]: String(lowWght),
                      ['--wght-active' as string]: String(tone.wght)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 지금 무엇을 보고 있는지 — 모션만으로는 단계가 이름을 갖지 못한다 */}
          <div className="sim-legend">
            <span className={emphasised ? 'on' : ''}>꽂혀 있는 동안</span>
            <span className={stage === 'settle' || stage === 'ambient' ? 'on' : ''}>
              그 뒤 {STAY_DAYS}일
            </span>
            <button type="button" className="sim-replay" onClick={replay}>
              다시 보기
            </button>
          </div>
        </div>

        <div className="proj-meta">
          당신의 한 줄이 벽 한가운데 떠오른 후, {STAY_DAYS}일간 메아리로 남습니다.
        </div>
      </div>

      {/* 이 버튼만 사람을 일으켜 세운다. 발화는 여기서 일어나지 않는다 --
          꽂아야 일어난다. 그래서 이름이 다음에 할 몸짓을 그대로 말한다. */}
      <button className="primary-action" onClick={onConfirm}>
        <span>꽂으러 갈게요</span>
      </button>

    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
