import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import BackButton from './BackButton';
import { HomeX } from './StepHeader';
import { aboutSvg, chainSvg, scopeSvg, slideSvg, withGround } from '../lib/svgAsset';

// 작가가 삽화를 컷으로 나눠 준다. 컷 사이를 이어 도는 일은 svgAsset이 한다.
//
//   About   두 컷(불 켜진 벽 · 다 모인 밤)으로 **세 걸음**을 짓는다.
//           ① 불빛이 켜지고 ② '내 생각은…'이 뜨고 ③ 구경꾼이 걸어 들어온다.
//           가운데 걸음은 그림에 없다 — 둘째 컷을 벽면 안팎으로 쪼개 만든다.
//
//   Step 2  네 컷을 1→2→3→4→3→2→1로 오간다. 되짚어 돌아오는 것이 중요하다:
//           손잡이가 끝에서 처음으로 순간 이동하면 "손잡이를 움직이면 글자가
//           따라 바뀐다"는 이 장의 내용이 그 순간 거짓이 된다.
//
//   Step 3  세 컷을 1→2→3→2→1로 오간다. 메가폰트만 서 있다가, 사람이
//           걸어와 폰을 꽂고, 느낌표가 터진다. 되짚어 돌아오는 것이 거짓이
//           아니다 — 실제로도 폰을 도로 빼면 그 큰 목소리가 거기서 끝난다.
//
// 같은 폴더의 `Artboard size_*.pdf`는 번들에 넣지 않는다. 화면이 아니라
// **기준**이다 — 그 페이지 크기(390×603)가 곧 삽화의 화판이고, 화면에서
// 어디까지 보이고 어디가 잘려야 하는지를 그것이 정한다(app.css · --focus).
import artAboutLit from '../../by_moomiryu/Renewal_v1/Tutorial/example_about_1.svg?raw';
import artAboutFull from '../../by_moomiryu/Renewal_v1/Tutorial/example_about_2.svg?raw';
import artRule1 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step1_1_1.svg?raw';
import artRule2 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step_1_2.svg?raw';
import artRule3 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step1_3_1.svg?raw';
import artGlyphs1 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step2_1.svg?raw';
import artGlyphs2 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step2_2.svg?raw';
import artGlyphs3 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step2_3.svg?raw';
import artGlyphs4 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step2_4.svg?raw';
import artDock2 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step3_2.svg?raw';
import artDock3 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step3_3.svg?raw';
import artDock4 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step3_4.svg?raw';

interface Props { onClose: () => void; onStart: () => void; }

/**
 * 한 장에 한 가지.
 *
 * 2026-09-20까지는 여섯 장이 세로로 이어진 스크롤이었다. 넘기는 것이
 * 손가락에 달려 있으니 어디까지 읽었는지가 흐릿하고, 한 장이 화면보다
 * 길어지면 다음 장이 위로 비어져 들어와 **두 생각이 한 화면에 겹쳤다.**
 * 이제 한 번에 한 장만 서고 '다음'이 넘긴다 — 읽을 것이 언제나 하나다.
 */
export default function InfoOverlay({ onClose, onStart }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const last = idx === SLIDES.length - 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // 장이 바뀌면 그 장으로 초점을 옮긴다 — 읽는 도구에 새 내용이 왔다고 알린다
  useEffect(() => { trackRef.current?.focus({ preventScroll: true }); }, [idx]);

  // 좌상단은 한 걸음씩 되돌린다. 첫 장에서만 이 화면을 닫는다 — 여러 장을
  // 읽고 나서 한 장 앞을 다시 보려면 되돌아갈 데가 있어야 한다.
  const back = () => (idx === 0 ? onClose() : setIdx(idx - 1));
  const s = SLIDES[idx];
  return (
    /* 밤 장면은 화면이 통째로 검정이다. 어느 장이 그런지는 삽화가 아니라
       **그 장 자신**이 정한다 — 도입 두 장은 삽화가 없고 검정도 아니다
       (app.css · is-dark) */
    <div className={'info-overlay' + (s.dark ? ' is-dark' : '')}
      aria-label="메가폰트 소개">
      {/* 단계명은 머리줄에 둔다. 제목 위에 제 줄을 차지하던 때는 제목이
          작성 화면보다 27px 아래에 섰다(84 대 111, 390×844 실측). 그 줄이
          올라오면서 제목이 작성 화면과 같은 높이에 선다. */}
      <div className="info-head">
        <BackButton label={idx === 0 ? '처음으로' : '이전 설명'} onClick={back} />
        {/* '1/7' 같은 전체 진행 숫자는 뺐다(2026-09-22). 남은 장을 세게
            만드는 정보였고, 단계명이 하려는 말과도 겹쳤다. 이름 하나만
            남기고 그 이름을 **이 장이 무엇인가**를 말하는 섹션 제목으로
            올린다 — 화면 한가운데에, 뒤로가기보다 진하게. 가운데 정렬은
            흐름(flex)이 아니라 절대 자리로 잡는다. 흐름으로 두면 왼쪽
            아이콘의 폭만큼 밀려서 '거의 가운데'가 된다(app.css). */}
        <span className="info-where">{s.step}</span>
        {/* 오른쪽 X — 어느 장에서든 곧장 첫 화면으로(2026-09-25). 뒤로가기는
            한 장씩 되짚고, X는 소개를 통째로 닫는다. 네 장 모두 같은 자리다. */}
        <HomeX onClick={onClose} />
      </div>
      <div className="info-track" ref={trackRef} tabIndex={-1} role="region"
        aria-live="polite" aria-label="메가폰트 사용 안내">
        {/* key가 바뀌면 장이 새로 서고, 그때 들어오는 결(infoSlideIn)이 돈다 */}
        <section className="info-slide" key={idx} aria-label={s.title}>
          {/* 줄바꿈이 적힌 제목은 그 자리를 지킨다(data-break). 나머지는
              balance가 알아서 두 줄을 고르게 나눈다 — 둘은 같이 못 쓴다. */}
          <h2 data-break={s.title.includes('\n') ? 'true' : undefined}>{s.title}</h2>
          <div className="info-said">{s.body}</div>
          {/* 도입 두 장(Problem · Solution)에는 삽화가 없다. 빈 칸을 남기지
              않고 아예 안 세운다 — 테두리만 남은 상자는 '그림이 안 떴다'로
              읽힌다. 글의 자리는 그대로다(제목은 다른 장과 같은 높이). */}
          {s.relay ? <Relay legs={s.relay} />
            : s.art && <div className={'info-art ' + (s.artClass ?? '')} aria-hidden>{s.art}</div>}
        </section>
      </div>
      <div className="info-nav">
        <button type="button" className="primary-action"
          onClick={last ? onStart : () => setIdx(idx + 1)}>
          {last ? '시작하기' : '다음'}
        </button>
      </div>
    </div>
  );
}


// ─── 슬라이드 ────────────────────────────────────────────────
// 본문은 장당 40자 안쪽. 넘기는 형식은 한 장에 한 생각일 때만 살아 있다.
//
// 삽화는 한동안 선 하나로만 그렸다 — "색은 사용자가 만든 말에만 산다"는
// 이유였다. 2026-09-15에 작가가 About·Step 2·Step 3 셋을 색 있는 그림으로
// 그려 오면서 그 원칙은 이 화면에서 풀렸다. 나머지 셋(Step 2 · On the wall ·
// Afterwards)은 아직 선 그림이라, 지금 이 화면은 두 결이 섞여 있다.


// 짝지어 온 삽화. 한 번 만들어 두고 다시 쓴다 — 매 렌더마다 두 장을 파싱해
// 뼈대를 맞출 이유가 없다. 모션을 끈 사람에게는 나중 컷만 준다.
const morphed = new Map<string, string>();

/** 한 번 지어 두고 다시 쓴다. 모션을 끈 사람에게는 멈춘 한 컷만 준다 */
function Built({ name, still, make }: { name: string; still: string; make: (key: string) => string }) {
  const off = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const key = off ? `${name}-still` : name;
  if (!morphed.has(key)) morphed.set(key, off ? scopeSvg(still, key) : make(key));
  return <span dangerouslySetInnerHTML={{ __html: morphed.get(key)! }} />;
}


type Leg = { art: ReactNode; artClass: string; sec: number };

/**
 * 삽화 둘을 차례로 돈다 — 한 그림이 제 바퀴(sec)를 마치면 다음 그림이 선다.
 * 새로 서는 그림은 제 시계를 0부터 탄다(SMIL은 svg가 문서에 들어온 순간
 * 시작한다). 모션을 끈 사람에게는 넘기지 않고 첫 그림의 멈춘 컷만 준다.
 */
function Relay({ legs }: { legs: Leg[] }) {
  const [i, setI] = useState(0);
  const off = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (off) return;
    const t = setTimeout(() => setI((i + 1) % legs.length), legs[i].sec * 1000);
    return () => clearTimeout(t);
  }, [i, off, legs]);
  const leg = legs[i];
  return <div key={i} className={'info-art is-relay ' + leg.artClass} aria-hidden>{leg.art}</div>;
}

const SLIDES: Array<{ step: string; title: string; body: ReactNode; art?: ReactNode; artClass?: string; relay?: Leg[]; dark?: boolean }> = [
  /* 사용법보다 **왜**가 먼저다(2026-09-22). 그때 문턱(Problem)과 그래서
     둔 것(Solution)을 두 장으로 나눴는데, 2026-09-24에 한 장으로 합쳤다.
     조작을 배우기 전에 읽을 장이 둘이면 '왜'가 설명의 절반을 먹는다.
     문장은 두 장에 있던 것을 그대로 잇고 새로 쓰지 않았다(초안). 삽화는 없다 —
     있는 그림을 빌려 오면 이 장의 말이 아닌 것이 선다. */
  {
    step: 'About',
    title: '말을 꺼내는 또 하나의 방식',
    body: (
      <>
        <p>
          대자보, 에브리타임, 공청회.<br />
          말을 전할 통로는 있지만,<br />
          형식과 절차, 주변의 시선은<br />
          자유롭게 말하기를 어렵게 합니다.
        </p>
        <p>
          메가폰트는 글을 빛으로 띄우는 카트입니다.<br />
          내가 다듬은 한 줄을 밤의 벽에 펼치고,<br />
          그 말을 본 사람도 한마디를 보탤 수 있습니다.
        </p>
      </>
    )
  },
  {
    /* 쓰기와 성격 정하기를 한 장으로(2026-09-24). 실제로도 한 자리에서
       이어지는 일이고, 둘 다 '폰 안에서 하는 일'이다 — 폰 밖(꽂기·벽)과
       갈리는 선이 여기다. 삽화 둘은 그대로 두고 **차례로 잇는다**(Relay):
       작성판 세 컷이 한 번 돌고, 이어서 캐릭터가 한 번 오간다. */
    step: 'Step 1',
    title: '메시지를 쓰고,\n성격을 정합니다.',
    body: (
      <p>
        최대 60자까지 쓰고, 크기와 빠르기, 무게로<br />
        나만의 목소리를 만들어보세요.<br />
        <b>비속어 및 타인을 해치는 표현은 사용할 수 없습니다.</b>
      </p>
    ),
    relay: [
      /* 세 컷은 한 동작의 앞뒤가 아니라 차례로 읽을 목록이라 옆으로 넘긴다
         (slideSvg). 한 자리에서 갈아 끼우던 때는 건너가는 동안 두 판의
         글이 반투명으로 겹쳤다. is-lowered: 이 그림만 작성판이 다른 삽화
         보다 71~115px 위에 떠 있어 큰 화면에서 한 단 내린다(app.css).

         6.36초 — 한 바퀴(8.18초) 중 셋째 판이 다 선 순간. 거기서 넘겨야
         첫 판으로 돌아가는 1.8초를 건너뛰고 곧바로 다음 그림이 온다. */
      {
        art: <Built name="rules" still={artRule1}
          make={(k) => slideSvg([artRule1, artRule2, artRule3], k, 10, [1, 0.7, 0.7])} />,
        artClass: 'is-wide is-lowered', sec: 6.36
      },
      /* 네 컷을 1→2→3→4→3→2→1로 되짚는다. 손잡이가 끝에서 처음으로 순간
         이동하면 '손잡이를 움직이면 글자가 따라 바뀐다'가 그 순간 거짓이
         된다. 한 바퀴(11초)를 다 돌아 첫 컷에 선 채로 넘긴다.
         그림자는 작가가 따로 준 example_step2_shadow.svg에서 잰 자리다.
         is-fitted: 글 바로 밑에서 혼자 크게 올라와 보여 칸에 맞춰 줄인다. */
      {
        art: <Built name="glyphs" still={artGlyphs1}
          make={(k) => withGround(chainSvg([artGlyphs1, artGlyphs2, artGlyphs3, artGlyphs4], k),
            { cx: 202.2, cy: 626.45, rx: 68.5, ry: 12.05 })} />,
        artClass: 'is-wide is-fitted', sec: 11
      }
    ]
  },
  {
    step: 'Step 2',
    title: '완료 후, 폰을 홈에 꽂습니다.',
    body: (
      <p>
        앞쪽 홈에 폰을 세로로, 위쪽부터 밀어 넣어<br />
        메가폰트를 작동시키세요.
      </p>
    ),
    /* 세 컷인데 **장면은 둘**이다(2026-09-21에 작가가 다시 그렸다).
       앞의 둘은 한 장면 안에서 포개어 잇는다 — 거기가 **폰이 홈으로
       내려가는 대목**이라 옆으로 넘기면 안 된다. 두 컷은 픽셀의 1.21%만
       다르고(재서 확인), 그 차이가 폰의 자리다. 화면을 통째로 밀면 거의
       같은 그림이 다시 서서 멈칫한 것으로 읽힌다.

       장면 사이는 옆으로 넘긴다: [사람이 폰을 들고 서서 꽂는다] → 느낌표.
       장면이 바뀌는 자리와 한 장면 안에서 손이 움직이는 자리를 서로 다른
       말로 한다.

       빈 메가폰만 서 있던 첫 컷(example_step3_1)은 2026-09-22에 뺐다.
       고리가 '폰 든 사람 → 꽂힘 → 느낌표 → 폰 든 사람'으로 바로 돌아,
       기다리는 컷 없이 동작만 남는다. */
    art: <Built name="dock" still={artDock4}
      make={(k) => slideSvg([[artDock2, artDock3], artDock4], k, 10)} />,
    /* is-eased: 이 장만 칸을 55.6% 채워 다른 셋(34.6~39.4)보다 불쑥
       컸다. 기계 클로즈업이라 큰 색면 하나가 존재감을 다 먹는다 —
       큰 화면에서 85%로 눌러 앉힌다. 값과 고른 이유는 app.css가 든다. */
    artClass: 'is-wide is-eased'
  },
  {
    /* About에 있던 장면이 여기로 왔다(2026-09-22). 벽에 글이 떠오르는
       그림은 **무엇을 하는 앱인가**가 아니라 **꽂으면 무슨 일이 일어나는가**
       라서, 차례의 이 자리가 맞다. 선 그림 자리표(ArtBig)를 새로 그리는
       대신 이것을 옮긴다.

       이 장만 화면이 통째로 검정이다(dark) — 삽화의 밤이 화면 끝까지
       이어져야 판과 배경 사이에 경계가 안 생긴다. */
    step: 'Step 3',
    title: '메가폰트가 작동됩니다.',
    /* '최대 30초 동안은'을 뺐다(2026-09-21). 이 장이 하는 말은 **빛으로
       말한다**는 것이고, 몇 초인지는 그다음 문제다 — 소개에서 먼저 시간을
       재 주면 읽는 사람이 남은 시간을 세게 된다. 강조 시간 자체는 그대로다
       (wall.ts의 EMPHASIS_SEC). */
    body: (
      <p>
        텍스트가 화면에 떠올라<br />
        공간을 지나는 사람들에게 닿습니다.
      </p>
    ),
    /* 한 바퀴를 12초에서 **8.4초(70%)로** 줄인다(2026-09-22). 보고 있으면
       길었다 — 다섯 걸음(어둠·불빛·문구·사람·도로 어둠) 중 사람이 걸어
       들어오는 구간이 혼자 5몫이라 그동안 화면이 멈춘 듯 보인다. 걸음의
       비율은 그대로 두고 전체만 줄이므로 사람은 여전히 두 걸음으로 들어온다
       (그 이유는 aboutSvg의 timeline 주석). 1번도 같은 값으로 줄였다. */
    art: <Built name="about" still={artAboutFull}
      make={(k) => aboutSvg(artAboutLit, artAboutFull, k, 8.4)} />,
    artClass: 'is-bleed',
    dark: true
  }
];

