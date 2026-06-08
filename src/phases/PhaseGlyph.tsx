import { useEffect, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import type { ToneState } from '../types';

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

interface Props {
  initialTone?: PartialTone | null;
  /** Tone preset from the voice intro (or null if skipped). Shows a small badge. */
  voicePreset?: Pick<ToneState, 'font' | 'wght'> | null;
  onBack: () => void;
  onNext: (partialTone: PartialTone) => void;
}

// Glyph tuning happens before the message is written, so we shape a single
// representative sample character. The full sentence is composed in the next step.
const SAMPLE_CHAR = '가';

const DEFAULT = {
  font: 'gothic' as const,
  tone: 1.0,
  wght: 400,
  slnt: 0,
  size: 80
};

const FONT_OPTIONS: Array<{ val: ToneState['font']; label: string }> = [
  { val: 'gothic', label: '외침' },
  { val: 'mono', label: '선언' },
  { val: 'myeongjo', label: '속삭임' },
  { val: 'song', label: '노래' }
];
const TONE_OPTIONS = [
  { val: 0.7, label: '좁게' },
  { val: 1.0, label: '보통' },
  { val: 1.3, label: '넓게' }
];
const WGHT_OPTIONS = [
  { val: 100, label: '여리게' },
  { val: 400, label: '보통' },
  { val: 700, label: '세게' },
  { val: 900, label: '아주세게' }
];
const SLNT_OPTIONS = [
  { val: 0, label: '곧게' },
  { val: -8, label: '흘림' }
];

const VOICE_LABELS: Record<ToneState['font'], { kr: string; en: string }> = {
  gothic: { kr: '외침', en: 'CRY' },
  mono: { kr: '선언', en: 'STATE' },
  myeongjo: { kr: '속삭임', en: 'HUSH' },
  song: { kr: '노래', en: 'SONG' }
};

const AXIS_LABELS: Record<string, { kr: string; en: string }> = {
  FONT: { kr: '발화', en: 'VOICE' },
  WGHT: { kr: '무게', en: 'WGHT' },
  TONE: { kr: '폭', en: 'WDTH' },
  SLNT: { kr: '기울기', en: 'SLNT' },
  SIZE: { kr: '크기', en: 'SIZE' }
};

const Z_MOOD = moods.find((m) => m.id === 'night')!;

export default function PhaseGlyph({ initialTone, voicePreset, onBack, onNext }: Props) {
  const [tone, setTone] = useState({
    font: initialTone?.font ?? DEFAULT.font,
    tone: initialTone?.tone ?? DEFAULT.tone,
    wght: initialTone?.wght ?? DEFAULT.wght,
    slnt: initialTone?.slnt ?? DEFAULT.slnt,
    size: initialTone?.size ?? DEFAULT.size
  });

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', Z_MOOD.bg);
  }, []);

  const voiceLabel = voicePreset ? VOICE_LABELS[voicePreset.font] : null;

  return (
    <div
      className="z-frame z1 has-content"
      style={{
        ['--bg' as string]: Z_MOOD.bg,
        ['--text' as string]: Z_MOOD.text,
        ['--graphic' as string]: Z_MOOD.graphic,
        ['--blend' as string]: Z_MOOD.blend,
        background: Z_MOOD.bg,
        color: Z_MOOD.text
      }}
    >
      <div className="z-header">
        <button className="z-back" onClick={onBack} aria-label="음성으로 돌아가기">
          ← 음성 다시
        </button>
        <span>1 / 3 · 자형 정하기</span>
      </div>

      {voiceLabel && (
        <div className="z-voice-badge">
          <span className="z-voice-badge-label">지금 음성</span>
          <span
            className="z-voice-badge-value"
            style={{ fontFamily: fontMap[voicePreset!.font] }}
          >
            {voiceLabel.kr} <span className="z-voice-badge-en">{voiceLabel.en}</span>
          </span>
        </div>
      )}

      <div className="z-glyph-stage">
        <div
          className="z-glyph"
          data-glyph={SAMPLE_CHAR}
          style={{
            fontFamily: fontMap[tone.font],
            fontWeight: tone.wght,
            fontVariationSettings: `"wght" ${tone.wght}`,
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            fontSize: tone.size * 3 + 'px',
            color: Z_MOOD.text
          }}
        >
          {SAMPLE_CHAR}
        </div>
        <div className="z-glyph-caption">한 글자로 형태를 정해요</div>
      </div>

      <div className="z-axes">
        <CompactRow
          axisKey="FONT"
          options={FONT_OPTIONS.map((o) => ({
            val: o.val as unknown as number,
            label: o.label,
            active: tone.font === o.val
          }))}
          onPick={(_v, i) => setTone((t) => ({ ...t, font: FONT_OPTIONS[i].val }))}
        />
        <CompactRow
          axisKey="WGHT"
          options={WGHT_OPTIONS.map((o) => ({
            val: o.val,
            label: o.label,
            active: tone.wght === o.val
          }))}
          onPick={(v) => setTone((t) => ({ ...t, wght: v }))}
        />
        <CompactRow
          axisKey="TONE"
          options={TONE_OPTIONS.map((o) => ({
            val: o.val,
            label: o.label,
            active: tone.tone === o.val
          }))}
          onPick={(v) => setTone((t) => ({ ...t, tone: v }))}
        />
        <CompactRow
          axisKey="SLNT"
          options={SLNT_OPTIONS.map((o) => ({
            val: o.val,
            label: o.label,
            active: tone.slnt === o.val
          }))}
          onPick={(v) => setTone((t) => ({ ...t, slnt: v }))}
        />
        <div className="z-axis-line">
          <span className="z-axis-label">
            <span className="z-axis-label-kr">{AXIS_LABELS.SIZE.kr}</span>
            <span className="z-axis-label-en">{AXIS_LABELS.SIZE.en}</span>
          </span>
          <span className="z-size-end">작게</span>
          <input
            type="range"
            min={40}
            max={180}
            step={2}
            value={tone.size}
            onChange={(e) => setTone((t) => ({ ...t, size: parseInt(e.target.value, 10) }))}
          />
          <span className="z-size-end">크게</span>
        </div>
      </div>

      <button className="primary-action" onClick={() => onNext(tone)}>
        <span>이 자형으로, 다음 →</span>
      </button>

      <div className="z-progress">
        <span className="dot on" />
        <span className="dot" />
        <span className="dot" />
        <span className="z-progress-label">자형 → 효과 → 미리보기</span>
      </div>
    </div>
  );
}

function CompactRow({
  axisKey,
  options,
  onPick
}: {
  axisKey: keyof typeof AXIS_LABELS;
  options: Array<{ val: number; label: string; active: boolean }>;
  onPick: (v: number, i: number) => void;
}) {
  const { kr, en } = AXIS_LABELS[axisKey];
  return (
    <div className="z-axis-line">
      <span className="z-axis-label">
        <span className="z-axis-label-kr">{kr}</span>
        <span className="z-axis-label-en">{en}</span>
      </span>
      <div className="z-axis-options">
        {options.map((o, i) => (
          <button
            key={i}
            className={'z-axis-opt ' + (o.active ? 'on' : '')}
            onClick={() => onPick(o.val, i)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
