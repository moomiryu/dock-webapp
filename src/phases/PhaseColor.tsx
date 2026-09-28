import { useEffect, useState, type CSSProperties } from 'react';
import StepHeader from '../components/StepHeader';
import SnapSwitch from '../components/SnapSwitch';
import VoiceBubble from '../components/VoiceBubble';
import CloudBubble from '../components/CloudBubble';
import { arrangementsFor, cloudForTone, cloudShape } from '../lib/cloud';
import { bubbleAt, fillFromLegacySize, foldLines } from '../lib/fit';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { messageColors } from '../lib/messageStyle';
import { pick, useLang } from '../lib/lang';
import type { Align, ToneState } from '../types';

/* 이 화면의 말. 영어는 초안이다(2026-09-26, 영문판) */
const T = {
    back: { ko: '조율 다시', en: 'Tune again' },
    /* 색과 함께 정렬 방식도 고르게 되면서 '담기'로 묶었다(2026-09-28, 디자이너 문구).
       '포장'은 "말을 포장한다(미화)"로 먼저 읽혀서 버렸다 */
    title: { ko: '발화를 어떻게 담아볼까요?', en: 'How would you like to hold your line?' },
    lead: { ko: <>발화가 지닌 태도를 떠올리며,<br />정렬 방식과 색을 골라 말을 담을 그릇을 그려봐요.</>,
      en: <>Think of the attitude your line carries,<br />then pick an alignment and a colour to draw the vessel that holds it.</> },
    tray: { ko: '색 고르기', en: 'Choose a colour' },
    /* 칩 안의 견본 글자 — 바탕은 배경색, 이 글자는 글자색 */
    sample: { ko: '가', en: 'A' },
    next: { ko: '이렇게 담을게요', en: 'Hold it like this' },
    /* 첫 장 — 3/5와 같은 말(2026-09-28) */
    start: { ko: '화면을 누르면 시작해요', en: 'Tap the screen to start' },
    backWork: { ko: '설명 다시 보기', en: 'See the explanation again' },
    /* 조정판의 두 잣대 — 3/5의 [이름 | 잣대] 줄과 같은 꼴(2026-09-28) */
    colour: { ko: '색', en: 'Colour' },
    align: { ko: '정렬', en: 'Align' },
    /* 정렬 스위치 칸의 말 — 3/5 말투 스위치처럼 칸 안에 짧은 말로 */
    left: { ko: '왼쪽', en: 'Left' },
    center: { ko: '가운데', en: 'Centre' },
    right: { ko: '오른쪽', en: 'Right' },
    /* 성격마다 제 정렬(2026-09-28, design/landscape.md) — 나무(당당한) · 구름(다정한) */
    distribute: { ko: '균등 배분', en: 'Justify' },
    trapezoid: { ko: '사다리꼴', en: 'Trapezoid' },
    arch: { ko: '아치', en: 'Arch' },
    fan: { ko: '부채꼴', en: 'Fan' },
    smile: { ko: '미소', en: 'Smile' },
    /* 차분한(돌) — 포스터 넷(R17~R20). 이름은 일단 원론적인 이름으로(2026-09-28, 디자이너) */
    'hang-up': { ko: '올려 걸기', en: 'Hang up' },
    'hang-down': { ko: '내려 걸기', en: 'Hang down' },
    overflow: { ko: '넘치기', en: 'Overflow' }
};

/*
 * 정렬 잣대의 선택지는 성격이 정한다(cloud.ts · arrangementsFor, 2026-09-28). 차분한 · 유머있는은
 * 고전적인 셋(왼쪽 · 가운데 · 오른쪽), 당당한(나무)은 가운데 · 균등 배분 · 사다리꼴, 다정한(구름)은
 * 가운데 · 아치 · 부채꼴 · 미소. 고르면 미리보기의 형상이 그 자리에서 바뀐다 — 정렬이 곧 실루엣이다.
 * 값은 tone.align으로 저장되고 벽까지 간다.
 */
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

/**
 * 첫 장의 시연(2026-09-28, 사용자) — 3/5에서 다듬은 내 글이 위에서 굴러 떨어져
 * 가운데 말풍선에 들어가고, 그 말풍선이 색 짝을 차례로 갈아입는다.
 *
 * 떨어져 들어가는 움직임은 CSS(app.css · colorDemoFall · colorDemoInk)가 하고(말풍선은
 * 처음부터 서 있다), 색은 이 부품의 제 상태가 돈다 — 참여자가 고른 색(bg · fg)에는 닿지 않는다. 열 짝을
 * 같은 시간씩 차례로 도므로 어느 색도 권하지 않는다(절대원칙). 시작은 지금 색이다.
 * 움직임 줄이기를 켠 사람에게는 떨어지지도 돌지도 않는다.
 */
function ColorDemo({ lines, tone, cloud, box, from }: {
    lines: string[]; tone: ToneState; cloud: ReturnType<typeof cloudForTone>; box: ReturnType<typeof bubbleAt>; from: number;
}) {
    const [i, setI] = useState(from);
    useEffect(() => {
        if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        /* 박자는 토큰에서 읽는다 — 떨어져 자리 잡는 동안(--t-hold × 2.4)은 첫 색 그대로,
           그 뒤 --t-hold × 1.5마다 한 짝씩 */
        const hold = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-hold')) || 700;
        let iv = 0;
        const t = window.setTimeout(() => {
            iv = window.setInterval(() => setI((k) => (k + 1) % moods.length), hold * 1.5);
        }, hold * 2.4);
        return () => { window.clearTimeout(t); window.clearInterval(iv); };
    }, []);
    const m = moods[i];
    return <CloudBubble cloud={cloud} box={box} side="var(--color-area)" color={m.bg} still>
     <VoiceBubble text={lines.join('\n')} bg={m.bg} color={m.text} fontFamily={fontMap[tone.font]} font={tone.font}
       weight={tone.wght} width={tone.tone} slant={tone.slnt} align={tone.align} size={tone.size} manner={tone.manner}
       speed={tone.speed} weightPos={tone.weight}
       fontSize={`calc(var(--color-area) * ${box.unit.toFixed(4)})`} />
    </CloudBubble>;
}

export default function PhaseColor({ text, tone, onBack, onHome, onNext }: Props) {
    const initial = messageColors(tone);
    const lang = useLang();
    const lines = foldLines(text);
    const [bg, setBg] = useState(initial.bg);
    const [fg, setFg] = useState(initial.text);
    /* 정렬 — 조정판의 둘째 잣대(2026-09-28). 전에 고른 값이 이 성격의 것이면 그것, 아니면 가운데
       (다른 성격에서 고른 '아치'를 들고 돌에 오면 가운데로 선다) */
    const ALIGNS = arrangementsFor(tone.font);
    const [align, setAlign] = useState<Align>(tone.align && ALIGNS.includes(tone.align) ? tone.align : 'center');
    const current = { ...tone, align, backgroundColor: bg, textColor: fg };
    // 벽과 같은 구름이어야 미리보기가 거짓말이 아니다 — 씨앗은 글 자체(cloud.ts). 정렬이 형상을 바꾸므로 고른 정렬로 짓는다
    const cloud = cloudForTone(lines, current);
    const box = bubbleAt(lines, cloudShape(cloud), fillFromLegacySize(tone.size));
    /* 두 장(2026-09-28, 3/5와 같은 흐름): 'intro' = 설명과 시연 · 'work' = 고르는 장.
       moved는 한 번이라도 넘긴 뒤인지 — 처음 들어올 때는 둘째 장이 움직이지 않고 숨어 있다 */
    const [step, setStep] = useState<'intro' | 'work'>('intro');
    const [moved, setMoved] = useState(false);
    const [visit, setVisit] = useState(0);
    const go = (s: 'intro' | 'work') => { setMoved(true); if (s === 'intro') setVisit((v) => v + 1); setStep(s); };
    const fromMood = Math.max(0, moods.findIndex((m) => m.bg.toUpperCase() === bg.toUpperCase() && m.text.toUpperCase() === fg.toUpperCase()));
    return <div className="z-frame compose-screen color-choice is-pulled"
      data-step={step} data-moved={moved ? '' : undefined}
      style={{ '--pane-bg': bg, '--chrome-ink': fg } as CSSProperties}>
 {/* ── 첫 장: 무엇을 하는 자리인지 + 시연 (2026-09-28) ──────────────────
     3/5의 첫 장과 같은 흐름이다. 장 전체가 넘기는 손짓이되 버튼 위는 아니다
     (머리줄의 뒤로가기를 누른 탭이 넘김까지 돌리면 안 된다). 아래의 고르는
     장은 그대로 두고 이 장이 위를 덮는다 — 누르면 위로 빠지고 고르는 장이
     아래에서 올라온다(app.css · .color-intro). */}
 <section className="color-intro" onClick={e => { if (!(e.target as HTMLElement).closest('button')) go('work'); }}>
  <StepHeader at={4} back={{ label: pick(T.back, lang), onClick: () => onBack(current) }} onHome={onHome} />
  <div className="z-ask">
   <h1>{pick(T.title, lang)}</h1>
   <p>{pick(T.lead, lang)}</p>
  </div>
  <div className="color-stage color-demo" style={{ '--color-area': AREA } as CSSProperties}>
   {/* 늘 달아 둔다 — 넘길 때 위로 빠지는 장에 시연이 그대로 실려 간다. 되돌아오면
       key가 바뀌어 처음부터 다시 떨어진다 */}
   <ColorDemo key={visit} lines={lines} tone={tone} cloud={cloud} box={box} from={fromMood} />
  </div>
  <button type="button" className="tone-more" onClick={() => go('work')}>{pick(T.start, lang)}</button>
 </section>
 <div className="proj-stage is-bleed"><div className="proj-fit">
  <div className="proj-frame compose-editor is-pulled">
   <StepHeader className="compose-chrome" at={4} back={{ label: pick(T.backWork, lang), onClick: () => go('intro') }} onHome={onHome} />
   {/* 제목과 안내는 첫 장으로 옮겼다(2026-09-28) — 3/5처럼 고르는 장은 위가
       미리보기, 아래가 조정판이다. 무엇을 하는 자리인지는 첫 장이 말한다 */}
   <div className="color-stage" style={{ '--color-area': AREA } as CSSProperties}>
    <CloudBubble cloud={cloud} box={box} side="var(--color-area)" color={bg}>
     <VoiceBubble text={lines.join('\n')} bg={bg} color={fg} fontFamily={fontMap[tone.font]} font={tone.font}
       weight={tone.wght} width={tone.tone} slant={tone.slnt} align={align} size={tone.size} manner={tone.manner}
       speed={tone.speed} weightPos={tone.weight}
       fontSize={`calc(var(--color-area) * ${box.unit.toFixed(4)})`} />
    </CloudBubble>
   </div>
  </div>
 </div></div>
 {/* ── 조정판 (2026-09-28) — 3/5와 같은 회색 판, [이름 | 잣대] 두 줄 ──────── */}
 <div className="tone-panel color-panel">
  {/* 열 조합. 배경과 글자가 한 짝이라 따로 고르지 않는다 — 네모 하나가
      그 짝을 통째로 보여 준다(바탕은 배경색, 안의 '가'는 글자색). */}
  <div className="tslider">
   <span className="tslider-name" id="color-name">{pick(T.colour, lang)}</span>
   <div className="color-tray" role="group" aria-labelledby="color-name">
    {moods.map(m => {
        const on = m.bg.toUpperCase() === bg.toUpperCase() && m.text.toUpperCase() === fg.toUpperCase();
        return <button key={m.id} type="button" className={'color-chip' + (on ? ' on' : '')}
          style={{ background: m.bg, color: m.text }} aria-pressed={on} aria-label={pick(m.name, lang)}
          onClick={() => { setBg(m.bg); setFg(m.text); }}>{pick(T.sample, lang)}</button>;
    })}
   </div>
  </div>
  <div className="tslider">
   <span className="tslider-name" id="align-name">{pick(T.align, lang)}</span>
   {/* 3/5 말투 스위치와 같은 부품이다(2026-09-28, 사용자 — "3단계 UI를 적극 활용",
       같은 앱이니 같은 분위기) — 칸 수는 성격의 정렬 수(셋 또는 넷) */}
   <SnapSwitch labels={ALIGNS.map((a) => pick(T[a], lang))} at={ALIGNS.indexOf(align)}
     onPick={(i) => setAlign(ALIGNS[i])} labelledBy="align-name" />
  </div>
  <button className="primary-action" onClick={() => onNext(current)}>{pick(T.next, lang)}</button>
 </div></div>;
}
