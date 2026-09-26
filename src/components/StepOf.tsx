/**
 * 작성 단계 표시 — 점 다섯 (2026-09-25).
 *
 * '1 / 5 · 한 줄'이었다가 같은 날 딩벳(➀–❺)을 거쳐 점 다섯이 됐다. 다섯 점은
 * 같은 크기의 채운 원이고, **지금 단계 하나만** 선명하다. 지나온 단계를
 * 쌓아 칠하지 않는다 — 이 표시가 말하는 것은 '여기'이지 '얼마나 왔나'가 아니다.
 * 옅은 캡슐이 받친다. 캡슐은 진행 표시만의 모양이다(버튼의 3px 규칙과 별개).
 *
 * 점과 캡슐은 낭독기에서 감추고 문장 하나를 따로 준다. 누르는 물건이 아니므로
 * 버튼·링크·탭 순서를 주지 않는다. 화면이 바뀌면 이 요소도 새로 서므로 문장이
 * 따라 바뀐다. 실시간 알림(aria-live)은 걸지 않는다 — 화면 제목과 겹쳐 같은
 * 말을 두 번 한다.
 */
import { useLang, type Pair } from '../lib/lang';

const COUNT = 5;
/** 단계 이름은 이 앱이 쓰던 그대로다 — 이전 머리줄과 README의 이름.
 *  영어 이름은 사용자가 정했다(2026-09-26) */
const NAMES: Pair<string[]> = {
  ko: ['한 줄', '성격', '조율', '색', '미리보기'],
  en: ['Line', 'Character', 'Tune', 'Colour', 'Preview']
};

export default function StepOf({ at }: { at: 1 | 2 | 3 | 4 | 5 }) {
  const lang = useLang();
  const name = NAMES[lang][at - 1];
  return (
    <span className="step-of">
      <span className="step-dots" aria-hidden="true">
        {Array.from({ length: COUNT }, (_, i) => (
          <i key={i} className={'step-dot' + (i + 1 === at ? ' is-now' : '')} />
        ))}
      </span>
      <span className="sr-only">
        {lang === 'en' ? `Step ${at} of ${COUNT}, ${name}` : `전체 ${COUNT}단계 중 ${at}단계, ${name}`}
      </span>
    </span>
  );
}
