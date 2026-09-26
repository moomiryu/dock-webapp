import { useState, type CSSProperties } from 'react';
import StepHeader from '../components/StepHeader';
import VoiceBubble from '../components/VoiceBubble';
import CloudBubble from '../components/CloudBubble';
import { cloudForTone, cloudShape } from '../lib/cloud';
import { bubbleAt, fillFromLegacySize, foldLines } from '../lib/fit';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { messageColors } from '../lib/messageStyle';
import { pick, useLang } from '../lib/lang';
import type { ToneState } from '../types';

/* 이 화면의 말. 영어는 초안이다(2026-09-26, 영문판) */
const T = {
    back: { ko: '조율 다시', en: 'Tune again' },
    title: { ko: '발화의 색을 정해주세요', en: 'Choose a colour for your line' },
    tray: { ko: '색 고르기', en: 'Choose a colour' },
    /* 칩 안의 견본 글자 — 바탕은 배경색, 이 글자는 글자색 */
    sample: { ko: '가', en: 'A' },
    next: { ko: '이 색으로 할게요', en: 'Use this colour' }
};
interface Props {
    text: string;
    tone: ToneState;
    onBack: (tone: ToneState) => void;
    /** 초기 화면으로. 초안은 지우지 않는다 */
    onHome: () => void;
    onNext: (tone: ToneState) => void;
}
/**
 * 04 색.
 *
 * 화면은 03이 **물러선 그 모습** 그대로다 — 검은 화면에 한 덩이가 놓이고
 * 가장자리에서 물결이 번진다. 03에서 자판을 내려 그 형태를 보고 있었는데,
 * 04로 넘어왔다고 다른 액자로 갈아타면 방금 본 것이 사라진다. 여기서는
 * 쓰지 않으니 자판이 올라올 일도 없다 — 물러선 상태가 이 화면의 기본이다.
 *
 * 16:10 액자에 줄여 보여 주던 '실제 스크린 비율'은 걷어냈다. 그건 벽에서
 * 어떻게 보이는지를 묻는 화면(05)이 할 일인데 여기서 먼저 답해 버리면,
 * 색을 고르는 동안 글이 손톱만 해져서 정작 고르려는 색이 안 보인다.
 *
 * 이 단계에서 달라지는 것은 하나뿐이다: **색판이 아래에서 올라온다.**
 * 그래서 단계가 넘어간 게 아니라 색만 꺼내 든 것으로 읽힌다.
 *
 * ── 말풍선이 여기서 처음 나온다 ───────────────────────────────────────
 * 한때 조율 화면부터 도형을 세워 봤는데, 축 셋을 만지는 자리에 도형까지
 * 올라오니 무엇을 조절하는 중인지가 흐려졌다. 여기는 **면이 주인공**인
 * 화면이라 도형이 제 일을 한다 — 고른 색이 그 윤곽을 입는다.
 *
 * 크기는 fit.ts가 준다. 정사각 상자가 아니라 글이 정한 비례를 그대로
 * 입으므로, 여기서 보는 모양이 벽에 뜰 모양과 같다.
 */
/**
 * 말풍선이 쓸 수 있는 가장 큰 자리 — **제 자리를 재서 정한다.**
 *
 * 'min(80vw, 316px)'이었다. 옛 정사각 상자의 치수를 그대로 물려받은
 * 것인데, 그건 **화면 가로 폭만 보고** 정한 값이라 이 자리가 실제로 얼마나
 * 되는지와 상관이 없었다. 재 보니 자리는 358×716인데 말풍선은 200×90이라
 * 세로의 87%가 빈 채였고, 60자짜리 긴 글이 11.1px까지 내려앉아 읽히지
 * 않았다(2026-09-20).
 *
 * 이제 .color-stage에게 직접 묻는다. 세로가 가로의 두 배라 여전히 가로가
 * 먼저 걸리지만 — 한 줄 열두 자가 폭을 다 먹는다 — 적어도 자리의 몫을
 * 다 쓴다.
 */
const AREA = 'min(96cqw, 96cqh)';

export default function PhaseColor({ text, tone, onBack, onHome, onNext }: Props) {
    const initial = messageColors(tone);
    const lang = useLang();
    const lines = foldLines(text);
    // 벽과 같은 구름이어야 미리보기가 거짓말이 아니다 — 씨앗은 글 자체(cloud.ts)
    const cloud = cloudForTone(lines, tone);
    const box = bubbleAt(lines, cloudShape(cloud), fillFromLegacySize(tone.size));
    const [bg, setBg] = useState(initial.bg);
    const [fg, setFg] = useState(initial.text);
    const current = { ...tone, backgroundColor: bg, textColor: fg };
    return <div className="z-frame compose-screen color-choice is-pulled"
      style={{ '--pane-bg': bg, '--chrome-ink': fg } as CSSProperties}>
 <div className="proj-stage is-bleed"><div className="proj-fit">
  <div className="proj-frame compose-editor is-pulled">
   <StepHeader className="compose-chrome" at={4} back={{ label: pick(T.back, lang), onClick: () => onBack(current) }} onHome={onHome} />
   {/* 03에서 자판을 내렸을 때 선 제목이 그 자리 그대로 글자만 바뀐다.
       화면이 갈린 게 아니라 묻는 것이 바뀐 것으로 읽혀야 한다. */}
   <div className="z-ask compose-ask">
    <h1>{pick(T.title, lang)}</h1>
   </div>
   <div className="color-stage" style={{ '--color-area': AREA } as CSSProperties}>
    <CloudBubble cloud={cloud} box={box} side="var(--color-area)" color={bg}>
     <VoiceBubble text={lines.join('\n')} bg={bg} color={fg} fontFamily={fontMap[tone.font]} font={tone.font}
       weight={tone.wght} width={tone.tone} slant={tone.slnt} align={tone.align} size={tone.size} manner={tone.manner}
       speed={tone.speed} weightPos={tone.weight}
       fontSize={`calc(var(--color-area) * ${box.unit.toFixed(4)})`} />
    </CloudBubble>
   </div>
  </div>
 </div></div>
 {/* 열 조합. 배경과 글자가 한 짝이라 따로 고르지 않는다 — 네모 하나가
     그 짝을 통째로 보여 준다(바탕은 배경색, 안의 '가'는 글자색). */}
 <div className="color-tray" role="group" aria-label={pick(T.tray, lang)}>
  {moods.map(m => {
      const on = m.bg.toUpperCase() === bg.toUpperCase() && m.text.toUpperCase() === fg.toUpperCase();
      return <button key={m.id} type="button" className={'color-chip' + (on ? ' on' : '')}
        style={{ background: m.bg, color: m.text }} aria-pressed={on} aria-label={pick(m.name, lang)}
        onClick={() => { setBg(m.bg); setFg(m.text); }}>{pick(T.sample, lang)}</button>;
  })}
 </div>
 <button className="primary-action" onClick={() => onNext(current)}>{pick(T.next, lang)}</button></div>;
}
