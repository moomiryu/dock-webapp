import { useRef, useState, type CSSProperties, type Ref } from 'react';

/**
 * 짧은 진동 — 막대가 칸을 지날 때, 두 칸 스위치가 쪽을 바꿀 때.
 * 브라우저의 진동 기능이 있으면(안드로이드) 그걸 쓴다.
 *
 * 아이폰 사파리는 그 기능을 주지 않아 우회한다(사용자 결정, 2026-09-25).
 * iOS 18부터 사파리는 켜기/끄기 스위치(checkbox switch)가 바뀔 때 짧게
 * 진동하므로, 화면에 안 보이는 스위치 하나를 두고 칸을 지날 때마다 대신
 * 누른다. 정식 기능이 아니다 — 애플이 막거나 그 전 iOS면 조용히 안 울리고,
 * 조작은 그대로 된다. 스위치는 머리(head)에 두어 앱의 어떤 칸에도 닿지 않는다.
 */
let hiddenSwitch: HTMLLabelElement | null = null;
export function tick() {
    if (typeof navigator === 'undefined') return;
    if ('vibrate' in navigator) { navigator.vibrate(8); return; }
    try {
        if (!hiddenSwitch) {
            hiddenSwitch = document.createElement('label');
            hiddenSwitch.setAttribute('aria-hidden', 'true');
            hiddenSwitch.style.display = 'none';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.setAttribute('switch', '');
            input.tabIndex = -1;
            hiddenSwitch.appendChild(input);
            document.head.appendChild(hiddenSwitch);
        }
        hiddenSwitch.click();
    } catch { /* 못 울려도 조작은 그대로 */ }
}

/**
 * 두 칸 스위치 — 반으로 나눈 한 칸, 말은 칸 안에(2026-09-27).
 * 3/5 말투와 언어 창(`한국어 | English`)이 같이 쓴다. 켜고 끄기가 아니라
 * 대등한 둘이다(R12의 원리).
 *
 * 고른 쪽을 채운 판(.tseg-thumb)이 **자석처럼** 움직인다: 누르면 그쪽으로
 * 미끄러져 붙고, 끌면 손가락을 따라오다 가운데를 넘는 순간 진동(tick)과
 * 함께 바뀌고, 놓으면 가까운 쪽에 붙는다 — 3/5 막대들과 같은 손맛.
 * 자판·낭독기는 두 radio 단추로 고른다 — 표준 radiogroup처럼 Tab은 한 번만
 * 멈추고(고른 쪽), 화살표로 옮기며 고른다. Enter·Space도 된다. 모양은 app.css .tseg.
 * 손가락은 **처음 닿은 하나만** 따른다 — 둘째 손가락이 끼어들면 판이 두 손가락
 * 사이를 오가며 진동이 연달아 울렸다(2026-09-27 검토에서 재현).
 *
 * langs: 단추마다 lang 속성(언어 창 — 'English'는 lang="en"이라 Whois로 찍힌다).
 * focusRef: 지금 고른 단추에 걸린다(창이 열리면 거기로 초점을 옮기려고).
 */
export default function SnapSwitch({ labels, at, onPick, labelledBy, langs, focusRef }: {
    labels: readonly [string, string];
    at: 0 | 1;
    onPick: (i: 0 | 1) => void;
    labelledBy: string;
    langs?: readonly [string, string];
    focusRef?: Ref<HTMLButtonElement>;
}) {
    const box = useRef<HTMLDivElement>(null);
    /** 끄는 동안 판의 자리(0 = 왼쪽 칸, 1 = 오른쪽 칸). 끌지 않을 때는 null */
    const [drag, setDrag] = useState<number | null>(null);
    const press = useRef<{ id: number; x: number; moved: boolean } | null>(null);
    const radios = useRef<Array<HTMLButtonElement | null>>([]);
    const side = (p: number): 0 | 1 => (p >= 0.5 ? 1 : 0);
    const pickSide = (i: 0 | 1) => { if (i !== at) { tick(); onPick(i); } };
    /* 판의 가운데는 왼쪽 칸 가운데(1/4)에서 오른쪽 칸 가운데(3/4)까지 오간다 */
    const posAt = (x: number) => {
        const r = box.current!.getBoundingClientRect();
        return Math.min(1, Math.max(0, (x - r.left - r.width / 4) / (r.width / 2)));
    };
    const down = (e: React.PointerEvent) => {
        if (press.current) return;                                // 이미 한 손가락이 잡고 있다
        press.current = { id: e.pointerId, x: e.clientX, moved: false };
        box.current?.setPointerCapture(e.pointerId);
    };
    const moveTo = (e: React.PointerEvent) => {
        const p = press.current;
        if (!p || e.pointerId !== p.id) return;
        if (!p.moved && Math.abs(e.clientX - p.x) < 6) return;   // 누르기와 끌기를 가른다
        p.moved = true;
        const pos = posAt(e.clientX);
        setDrag(pos);
        pickSide(side(pos));
    };
    const up = (e: React.PointerEvent) => {
        const p = press.current;
        if (!p || e.pointerId !== p.id) return;
        press.current = null;
        if (p.moved) setDrag(null);                               // 놓으면 가까운 쪽에 붙는다
        else pickSide(side(posAt(e.clientX)));                    // 누르면 그쪽으로 미끄러진다
    };
    /* 화살표: 왼쪽·위 → 첫째, 오른쪽·아래 → 둘째. 고르고 초점도 옮긴다 */
    const key = (e: React.KeyboardEvent) => {
        const to = ({ ArrowLeft: 0, ArrowUp: 0, ArrowRight: 1, ArrowDown: 1 } as Record<string, 0 | 1>)[e.key];
        if (to === undefined) return;
        e.preventDefault();
        pickSide(to);
        radios.current[to]?.focus();
    };
    const shown = drag ?? at;
    /* 겉(.tseg)은 손을 받고, 안(.tseg-box)은 보이는 칸이다(2026-09-27). 3/5에서는
       안쪽 칸만 게이지와 같은 둥근 틀을 입는다 — 언어 창은 네모 그대로(app.css) */
    return <div ref={box} className={'tseg' + (drag !== null ? ' is-moving' : '')}
      role="radiogroup" aria-labelledby={labelledBy}
      onPointerDown={down} onPointerMove={moveTo} onPointerUp={up}
      onPointerCancel={(e) => { if (press.current?.id === e.pointerId) { press.current = null; setDrag(null); } }}
      /* 떼는 신호를 놓쳐도(붙잡기가 풀리면) '누르는 중'에 머물지 않게 */
      onLostPointerCapture={(e) => { if (press.current?.id === e.pointerId) { press.current = null; setDrag(null); } }}
      onKeyDown={key}>
     <div className="tseg-box">
     <i className="tseg-thumb" style={{ '--pos': shown } as CSSProperties} aria-hidden />
     {labels.map((label, n) => {
         const i = n as 0 | 1;
         return <button key={i} type="button" role="radio" aria-checked={at === i}
           tabIndex={at === i ? 0 : -1}
           lang={langs?.[i]}
           ref={(el) => {
               radios.current[i] = el;
               if (at === i && focusRef) {
                   if (typeof focusRef === 'function') focusRef(el);
                   else (focusRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
               }
           }}
           className={'tseg-side' + (side(shown) === i ? ' on' : '')}
           /* 자판(Enter·Space)과 낭독기로 고를 때. 손가락은 위 pointer가 맡는다 */
           onClick={(e) => { if (e.detail === 0) pickSide(i); }}>
           {label}
         </button>;
     })}
     </div>
    </div>;
}
