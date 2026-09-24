import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import { fontMap, opticalFix, opticalStroke } from '../lib/palettes';
import { foldLines } from '../lib/fit';
import { DEFAULT_TONE, STYLE_OPTIONS, type PartialTone } from '../lib/tone';
import type { ToneState } from '../types';

interface Props {
  /** 앞 화면에서 쓴 한 줄. 고르고 나면 이게 통째로 뜬다 */
  text: string;
  initialTone?: PartialTone | null;
  onBack: () => void;
  onNext: (tone: PartialTone) => void;
}

/**
 * 02 성격 — 두 걸음이다.
 *
 * **고르는 걸음.** 네 칸에 **내 글의 앞부분**을 그 서체로 세운다
 * (2026-09-25). 성격 이름은 칸 왼쪽 위의 작은 이름표로 물러난다.
 *
 * 이름만 찍던 동안은 서체를 고르면서 제 문장이 어떻게 보일지는 상상해야
 * 했다. 2026-09-19에도 문장을 넣어 봤다가 접었는데, 그때는 **열두 자를
 * 다 넣으려고** 글자를 줄였기 때문이다(칸 195px에서 19px). 이번에는 크기를
 * 지키고 글을 덜어 낸다. 비교표를 세 번 거쳐 고른 규칙:
 *
 *   · 크기는 이름이 쓰던 그 크기(--fs-h1 × 서체 보정)다. 네 칸이 같다 —
 *     크기가 다르면 서체를 공정하게 견줄 수 없다. 44·52px도 봤는데
 *     차분한·다정한이 '오늘' 한 낱말로 줄어 견줄 거리가 없어졌다.
 *   · 두 줄까지. 띄어쓰기에서만 접으므로 낱말이 중간에서 잘리지 않는다 —
 *     셋째 줄부터는 보이지 않을 뿐이다. 폭이 좁은 서체는 낱말이 더 들어간다.
 *   · 보이는 두 줄 안의 낱말이 칸 폭보다 넓으면 **네 칸을 같이** 줄인다
 *     (sampleScale). 한 칸만 줄이면 서체를 견줄 수 없고, 그대로 두면 낱말이
 *     잘린다 — 360 화면에서 다정한의 '캠퍼스는'이 '캠퍼스'로 보였다.
 *     줄이는 바닥은 --fs-h3(이름 크기 --fs-h1에 대한 비)이다.
 *   · 바닥까지 줄여도 안 들어가는 낱말만 글자에서 자른다. 바닥 없이 다 넣으려
 *     하면 띄어쓰기 없는 18자 한 덩어리가 8px까지 내려앉았다.
 *
 * **확인하는 걸음.** 고르면 **그 칸이 아래를 통째로 차지하고** 내 글 전문이
 * 그 얼굴로 선다. 다른 화면으로 갈아타는 것이 아니라 누른 칸이 그대로
 * 커진 것이라, 무엇을 눌렀는지가 손에 남는다.
 *
 * 격자를 지우고 새 판을 그리는 대신 **칸 크기만 0으로 접는다** — 고른 칸의
 * 줄과 칸만 1fr로 남기고 나머지를 0fr로 보낸다. 같은 요소가 자리를 넓힌
 * 것이라 글자도 이어진다.
 *
 * **자라는 과정은 보이지 않는다(2026-09-20).** 한동안 그 사이를 이어
 * 붙였다(460 → 680 → 1360ms, 4080ms에 튕기는 것까지). 한 칸이 화면이 되는
 * 큰 움직임이라 무엇을 해도 급하게 밀어붙이는 인상이 남았다 — 고르는 일은
 * 조용한 일인데 화면이 먼저 서둘렀다. 지금은 누른 그 프레임에 바뀐다.
 * 무엇이 골라졌는지는 움직임이 아니라 색이 말한다. (app.css · .style-cards)
 */
export default function PhaseGlyph({ text, initialTone, onBack, onNext }: Props) {
  const [font, setFont] = useState<ToneState['font'] | null>(initialTone?.font ?? null);
  const at = font ? STYLE_OPTIONS.findIndex(s => s.val === font) : -1;
  const lines = text.trim() ? foldLines(text) : ['발화'];
  const longest = Math.max(1, ...lines.map(l => Array.from(l).length));
  // 전문이 붉은 면 폭의 82%에 들어가되, 줄이 많아지면 높이가 먼저 걸린다.
  // 높이는 vh로 잰다 — cqh를 쓰려면 container-type: size가 필요한데, 그러면
  // 붉은 면이 제 내용으로 높이를 못 정해 글자 크기가 0으로 풀린다.
  const guess = `min(${(82 / longest).toFixed(1)}cqw, ${(52 / lines.length).toFixed(1)}vh, 44px)`;
  /**
   * 고른 카드의 견본은 **잰 폭**으로 채운다(2026-09-22).
   *
   * 위의 guess는 한 글자를 1em으로 치는 어림이라 — 03과 같은 문제 — 실제
   * 자폭(0.5~0.8em)에서는 카드 폭의 35%만 썼다. 그린 것을 재서 카드 폭의
   * 86%, 높이의 55%에 먼저 닿는 쪽으로 맞춘다. 1% 안의 흔들림은 버린다
   * (PhaseTone과 같은 결).
   *
   * ── 몇 번까지만 맞춘다 (2026-09-21) ────────────────────────────────
   * "자폭은 크기에 정비례하므로 한 번 재면 끝"이라고 적어 두었는데, **줄이
   * 안 바뀔 때만** 맞는 말이었다. 크기가 달라지면서 줄이 다시 나뉘면 높이가
   * 뛴다. 그러면 A에서 잰 답이 B이고 B에서 잰 답이 A인 자리가 생겨 둘이
   * 서로를 끝없이 부른다 — React가 'Maximum update depth'로 끊고 **화면이
   * 통째로 하얘졌다.** 차분한(Source Han Serif)에서 360·380·430 폭이 그랬다
   * (폭 열 가지 × 성격 넷을 훑어 확인. 다른 셋은 어느 폭에서도 멀쩡했다).
   *
   * 그래서 고쳐 잡는 횟수를 넷으로 묶는다. 정비례가 성립하는 보통의 경우는
   * 첫 번에 끝나므로 이 마개에 닿지도 않는다. 닿을 때는 **본 것 중 제일
   * 작은 값**을 쓴다 — 두 값을 오가는 자리에서 큰 쪽에 멈추면 글이 칸을
   * 넘치기 때문이다.
   *
   * 재는 조건(성격·글·칸 크기)이 달라지면 셈을 처음부터 다시 시작한다.
   */
  const full = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const tries = useRef(0);
  const seen = useRef('');
  const least = useRef(Infinity);
  useLayoutEffect(() => {
    const el = full.current;
    if (!el) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const card = el.parentElement as HTMLElement;
    if (!fs || !card) return;
    const key = `${font}|${text}|${card.clientWidth}x${card.clientHeight}`;
    if (seen.current !== key) { seen.current = key; tries.current = 0; least.current = Infinity; }
    if (tries.current >= 4) return;
    const per = { w: el.offsetWidth / fs, h: el.offsetHeight / fs };
    const next = Math.min((card.clientWidth * 0.86) / per.w, (card.clientHeight * 0.55) / per.h);
    if (!(next > 0)) return;
    least.current = Math.min(least.current, next);
    const want = tries.current < 3 ? next : least.current;
    if (fit === null || Math.abs(want - fit) / want > 0.01) { tries.current += 1; setFit(want); }
  });
  const size = fit === null ? guess : `${fit.toFixed(1)}px`;

  /**
   * 네 견본이 함께 쓰는 배율. 1이면 이름이 쓰던 크기 그대로다.
   *
   * 칸마다 낱말 폭을 **재서**(서체·보정·획이 다 들어간 그린 폭) 두 줄에
   * 어떻게 앉을지 흉내 낸다. 보이는 두 줄에 칸보다 넓은 낱말이 있으면 그
   * 낱말이 들어갈 만큼 줄인다 — 줄이면 줄에 더 들어오는 낱말이 생기므로 몇 번
   * 되짚는다. 넷 중 가장 작은 값을 넷이 같이 쓴다.
   *
   * 잰 폭은 지금 배율로 나눠 **배율 1의 폭**으로 바꿔 쓴다. 그래서 답이 지금
   * 배율에 기대지 않고, 한 번 맞추면 다시 재도 같은 답이 나온다.
   */
  const samples = useRef<Array<HTMLSpanElement | null>>([]);
  const [scale, setScale] = useState(1);
  const [remeasure, setRemeasure] = useState(0);
  useEffect(() => {
    const again = () => setRemeasure((n) => n + 1);
    window.addEventListener('resize', again);
    void document.fonts?.ready.then(again);
    return () => window.removeEventListener('resize', again);
  }, []);
  useLayoutEffect(() => {
    if (at >= 0) return;
    const root = getComputedStyle(document.documentElement);
    const floor = parseFloat(root.getPropertyValue('--fs-h3')) / parseFloat(root.getPropertyValue('--fs-h1'));
    const gapToken = parseFloat(root.getPropertyValue('--s2')) || 0;
    let shared = 1;
    for (const el of samples.current) {
      const card = el?.parentElement;
      if (!el || !card) continue;
      /* 폭과 높이는 **칸**에게 묻는다. 견본 자신은 제 글만큼만 넓어서(칸이
         가운데 정렬) 그걸 재면 짧은 글이 '제 폭보다 넓다'고 읽혀 바닥까지
         줄었다. 폭은 3% 덜어 쓴다 — 딱 맞게 줄였더니 반올림 1px 차이로
         '캠퍼스는'이 도로 '캠퍼스'가 됐다(360 · 다정한). */
      const box = getComputedStyle(card);
      const pt = parseFloat(box.paddingTop);
      const W = (card.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)) * 0.97;
      /* 견본은 칸 한가운데에 선다. 이름표 밑으로 --s2만큼 띄우려면 위아래로
         같은 몫을 비워야 한다 — 칸을 늘려 자리를 만들면 320 화면이 3px
         스크롤됐다. 칸은 그대로 두고 글이 줄어든다. */
      const label = card.querySelector<HTMLElement>('.style-card-label');
      const clear = label ? Math.max(0, label.offsetTop + label.offsetHeight + gapToken - pt) : 0;
      const H = card.clientHeight - pt - parseFloat(box.paddingBottom) - 2 * clear;
      const lineH = parseFloat(getComputedStyle(el).lineHeight) / scale;
      if (!W || !H || !lineH) continue;
      const probe = document.createElement('span');
      probe.style.whiteSpace = 'pre';
      el.appendChild(probe);
      const widthOf = (t: string) => { probe.textContent = t; return probe.getBoundingClientRect().width / scale; };
      const gap = widthOf('a a') - widthOf('aa');
      const rows = (text.trim() || '발화').split('\n').map((l) => l.split(/\s+/).filter(Boolean).map(widthOf));
      el.removeChild(probe);
      let k = 1;
      for (let round = 0; round < 4; round++) {
        // k 배율에서 앞 두 줄에 앉는 낱말들과 쓰이는 줄 수
        const seen: number[] = [];
        let line = 0;
        let used = 0;
        for (const row of rows) {
          let cur = 0;
          for (const w of row) {
            if (cur > 0 && cur + (gap + w) * k > W) { line += 1; cur = 0; }
            if (line >= 2) break;
            seen.push(w);
            used = line + 1;
            cur += (cur > 0 ? gap * k : 0) + w * k;
          }
          if (line >= 2) break;
          line += 1;
          if (line >= 2) break;
        }
        // 높이도 본다 — 이름표 밑 여백을 비우고 남은 자리에 쓰는 줄이 들어가야 한다
        const need = Math.min(1, W / Math.max(1, ...seen), H / (Math.max(1, used) * lineH));
        if (need >= k - 0.001) break;
        k = need;
      }
      shared = Math.min(shared, k);
    }
    shared = Math.max(floor || 0, shared);
    if (Math.abs(shared - scale) > 0.005) setScale(shared);
  }, [at, text, scale, remeasure]);
  // 고른 칸의 줄·칸만 남기고 나머지를 0으로 접는다 (0·1번 = 윗줄, 0·2번 = 왼칸)
  const grid: CSSProperties | undefined = at < 0 ? undefined : {
    gridTemplateColumns: at % 2 === 0 ? '1fr 0fr' : '0fr 1fr',
    gridTemplateRows: at < 2 ? '1fr 0fr' : '0fr 1fr'
  };

  return (
    <div className={'z-frame z1 tone-choice' + (at >= 0 ? ' is-picked' : '')}>
      <div className="z-header">
        <BackButton label="한 줄 다시 쓰기" onClick={onBack} />
        <span className="z-step-of">2 / 5 · 성격</span>
      </div>
      <div className="z-ask">
        <h1>어떤 성격으로<br />말해볼까요?</h1>
        {at < 0 && <p>마음에 드는 것을 골라주세요.</p>}
      </div>

      <div className="style-cards" role="group" aria-label="성격 고르기"
        style={{ ...grid, '--sample-scale': scale } as CSSProperties}>
        {/* '다른 성격 보기'는 제목 밑에 혼자 서 있었다 — 무엇을 되무르는지와
            떨어져 있어 독립된 버튼처럼 읽혔다. 되무를 대상(붉은 카드) 위에
            올린다. 옷은 색이 바뀌는 면 위에 앉는 보조 버튼의 그것이다
            (반투명 알약 --face-scrim에 흰 글자). 03에도 같은 옷이 있었는데
            2026-09-22에 그쪽 버튼 둘이 없어졌다(비교는 견본을 누르고,
            되돌리기는 아이콘이 됐다) — 여기 것은 남는다. 머리줄의 뒤로가기는
            **단계**를 되돌리고, 이건 이 안의 걸음을 되돌린다. */}
        {at >= 0 && <button type="button" className="glyph-reset" onClick={() => setFont(null)}>다른 성격 보기</button>}
        {STYLE_OPTIONS.map((s, i) => (
          <button key={s.val} type="button" className={'style-card ' + (at === i ? 'on' : '')}
            aria-pressed={at === i} aria-label={s.label} onClick={() => setFont(s.val)}>
            {at === i ? (
              <div ref={full} className="glyph-full-text" style={{
                fontFamily: fontMap[s.val],
                fontSize: size,
                '--optical-stroke': opticalStroke(s.val, 400),
                translate: `0 ${opticalFix[s.val]?.shift ?? 0}em`
              } as CSSProperties}>
                {lines.join('\n')}
              </div>
            ) : (
              /* 서체마다 잉크가 차지하는 높이도 굵기도 달라 같은 크기·같은
                 굵기로 안 보인다. 잰 값은 palettes.ts에 있다. 이름은 낭독기가
                 버튼 이름(aria-label)으로 읽으므로 이름표는 가린다. */
              <>
              <span className="style-card-label" aria-hidden>{s.label}</span>
              <span ref={(el) => { samples.current[i] = el; }} className="style-card-name is-sample" aria-hidden style={{
                fontFamily: fontMap[s.val],
                '--optical': opticalFix[s.val]?.scale ?? 1,
                /* 이 카드는 무게를 고르는 자리가 아니다 — CSS가 400으로 찍는다. */
                '--optical-stroke': opticalStroke(s.val, 400),
                '--optical-shift': (opticalFix[s.val]?.shift ?? 0) + 'em'
              } as CSSProperties}>
                {text.trim() || s.label}
              </span>
              </>
            )}
          </button>
        ))}
      </div>

      <button className="primary-action" disabled={!font}
        onClick={() => font && onNext({ ...(initialTone ?? DEFAULT_TONE), font })}>이 성격으로 할게요</button>
    </div>
  );
}
