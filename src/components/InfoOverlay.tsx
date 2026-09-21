import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import BackButton from './BackButton';
import { aboutSvg, chainSvg, scopeSvg, slideSvg } from '../lib/svgAsset';
import { STAY_DAYS } from '../lib/wall';

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
import artDock1 from '../../by_moomiryu/Renewal_v1/Tutorial/example_step3_1.svg?raw';
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

  // 좌상단은 한 걸음씩 되돌린다. 첫 장에서만 이 화면을 닫는다 — 여섯 장을
  // 읽고 나서 한 장 앞을 다시 보려면 되돌아갈 데가 있어야 한다.
  const back = () => (idx === 0 ? onClose() : setIdx(idx - 1));
  const s = SLIDES[idx];
  return (
    /* 밤 장면은 화면이 통째로 검정이다. 어느 장이 그런지는 삽화가 아니라
       **그 장 자신**이 정한다 — 앞으로 설 Problem·Solution도 삽화를 화면
       끝까지 쓸 수 있지만 검정은 아니다(app.css · is-dark) */
    <div className={'info-overlay' + (s.dark ? ' is-dark' : '')}
      aria-label="메가폰트 소개">
      {/* 'About / Step 1'과 '1 / 6'은 둘 다 **지금 어디인가**를 말하는
          정보라 한 줄에 둔다 — 왼쪽이 이름, 오른쪽이 숫자. 단계 이름이
          제목 위에 제 줄을 차지하던 때는 제목이 작성 화면보다 27px 아래에
          섰다(84 대 111, 390×844 실측). 그 줄이 올라오면서 제목이 작성
          화면과 같은 높이에 선다. */}
      <div className="info-head">
        <BackButton label={idx === 0 ? '처음으로' : '이전 설명'} onClick={back} />
        {/* 단계명과 진행 숫자는 **한 묶음**이다 — 둘 다 "지금 어디인가"를
            말한다. 양끝으로 갈라 두었더니 둘이 서로 다른 일을 하는 것처럼
            보였다. 오른쪽에 붙여 가운뎃점으로 나눈다. */}
        <span className="info-where">
          <span>{s.step}</span>
          <span aria-hidden="true">·</span>
          <span>{idx + 1}/{SLIDES.length}</span>
        </span>
      </div>
      <div className="info-track" ref={trackRef} tabIndex={-1} role="region"
        aria-live="polite" aria-label="메가폰트 사용 안내">
        {/* key가 바뀌면 장이 새로 서고, 그때 들어오는 결(infoSlideIn)이 돈다 */}
        <section className="info-slide" key={idx} aria-label={s.title}>
          {/* 줄바꿈이 적힌 제목은 그 자리를 지킨다(data-break). 나머지는
              balance가 알아서 두 줄을 고르게 나눈다 — 둘은 같이 못 쓴다. */}
          <h2 data-break={s.title.includes('\n') ? 'true' : undefined}>{s.title}</h2>
          <div className="info-said">{s.body}</div>
          <div className={'info-art ' + (s.artClass ?? '')} aria-hidden>{s.art}</div>
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


const SLIDES: Array<{ step: string; title: string; body: ReactNode; art: ReactNode; artClass?: string; dark?: boolean }> = [
  {
    step: 'Step 1',
    title: '메시지를 작성합니다.',
    body: (
      <p>
        최대 60자까지 작성할 수 있습니다.<br />
        <b>비속어 및 타인을 해치는 표현은 사용할 수 없습니다.</b>
      </p>
    ),
    /* 세 컷이 차례로 온다: 쓰는 중('내 생각은|') → 최대 60자 → 비속어
       금지. 셋은 한 동작의 앞뒤가 아니라 **차례로 읽을 목록**이다.

       그래서 포개지 않고 **옆으로 넘긴다**(slideSvg). 한 자리에서 갈아
       끼우던 때는 건너가는 1.9초 동안 두 판의 글이 반투명으로 겹쳐, 그
       동안 읽을 것이 없었다. 판을 나란히 놓고 화판으로 자르면 겹치는
       순간이 아예 없다. */
    art: <Built name="rules" still={artRule1}
      make={(k) => slideSvg([artRule1, artRule2, artRule3], k, 14)} />,
    artClass: 'is-wide'
  },
  {
    step: 'Step 2',
    title: '발화의 성격을 정합니다.',
    body: (
      <p>
        크기와 빠르기, 무게를 조절하며<br />
        나만의 목소리를 만들어보세요.
      </p>
    ),
    // 파일 번호가 곧 차례다(2026-09-20에 작가가 넷으로 다시 그렸다).
    // 끝까지 갔다가 되짚어 돌아온다 — 1→2→3→4→3→2→1.
    art: <Built name="glyphs" still={artGlyphs1}
      make={(k) => chainSvg([artGlyphs1, artGlyphs2, artGlyphs3, artGlyphs4], k)} />,
    artClass: 'is-wide'
  },
  {
    step: 'Step 3',
    title: '완료 후, 폰을 홈에 꽂습니다.',
    body: (
      <p>
        앞쪽 홈에 폰을 세로로, 위쪽부터 밀어 넣어<br />
        메가폰트를 작동시키세요.
      </p>
    ),
    /* 네 컷인데 **장면은 셋**이다(2026-09-21에 작가가 다시 그렸다).
       가운데 둘은 한 장면 안에서 포개어 잇는다 — 거기가 **폰이 홈으로
       내려가는 대목**이라 옆으로 넘기면 안 된다. 두 컷은 픽셀의 1.21%만
       다르고(재서 확인), 그 차이가 폰의 자리다. 화면을 통째로 밀면 거의
       같은 그림이 다시 서서 멈칫한 것으로 읽힌다.

       나머지 사이는 옆으로 넘긴다: 빈 메가폰 → [사람이 와서 꽂는다] →
       느낌표. 장면이 바뀌는 자리와 한 장면 안에서 손이 움직이는 자리를
       서로 다른 말로 한다. */
    art: <Built name="dock" still={artDock4}
      make={(k) => slideSvg([artDock1, [artDock2, artDock3], artDock4], k)} />,
    artClass: 'is-wide'
  },
  {
    /* About에 있던 장면이 여기로 왔다(2026-09-22). 벽에 글이 떠오르는
       그림은 **무엇을 하는 앱인가**가 아니라 **꽂으면 무슨 일이 일어나는가**
       라서, 차례의 이 자리가 맞다. 선 그림 자리표(ArtBig)를 새로 그리는
       대신 이것을 옮긴다.

       이 장만 화면이 통째로 검정이다(dark) — 삽화의 밤이 화면 끝까지
       이어져야 판과 배경 사이에 경계가 안 생긴다. */
    step: 'Step 4',
    title: '소리 대신 빛으로 말해보세요.',
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
    art: <Built name="about" still={artAboutFull}
      make={(k) => aboutSvg(artAboutLit, artAboutFull, k)} />,
    artClass: 'is-bleed',
    dark: true
  },
  {
    step: 'Step 5',
    title: '발화는 메아리처럼 남았다가 사라집니다.',
    body: (
      <>
        {/* 3일·30초 같은 수치는 여기 적지 않고 wall.ts에서 받아 온다.
            체류 기간을 바꾸면 이 문장이 같이 따라와야 하기 때문이다. */}
        <p>
          발화는 <b>{STAY_DAYS}일간 남아 있다가 사라집니다.</b>
        </p>
        <dl className="info-rules">
          <div>
            <dt>익명성</dt>
            <dd>누가 썼는지는 남지 않습니다.</dd>
          </div>
          <div>
            <dt>불변성</dt>
            <dd>보낸 뒤에는 수정할 수 없습니다.</dd>
          </div>
          <div>
            <dt>운영 원칙</dt>
            <dd>타인에게 피해를 주거나 문제가 되는 글은 관리자가 삭제할 수 있습니다.</dd>
          </div>
        </dl>
      </>
    ),
    art: <ArtEcho />
  }
];

// ─── 삽화 ────────────────────────────────────────────────────

function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 130" width="100%" height="100%" fill="none" stroke="currentColor">
      {children}
    </svg>
  );
}


function ArtEcho() {
  return (
    <Art>
      {/* 굵던 한 줄이 가늘어져 이웃들 사이로 들어간다 */}
      <rect x="30" y="18" width="180" height="92" strokeWidth="1.8" />
      <line x1="96" y1="44" x2="144" y2="44" strokeWidth="4" />
      <g strokeWidth="3" opacity="0.6">
        <line x1="46" y1="70" x2="88" y2="70" />
        <line x1="150" y1="70" x2="192" y2="70" />
      </g>
      <g strokeWidth="2" opacity="0.3">
        <line x1="60" y1="92" x2="92" y2="92" />
        <line x1="112" y1="92" x2="136" y2="92" />
        <line x1="156" y1="92" x2="180" y2="92" />
      </g>
    </Art>
  );
}
