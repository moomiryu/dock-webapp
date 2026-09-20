import raw from '../../by_moomiryu/Renewal_v1/Asset/Moon and Cloud.svg?raw';

/**
 * 밤하늘에 걸리는 달과 구름.
 *
 * 홈은 밤하늘 아래 들판이다. 색만으로도 밤이긴 했지만 하늘에 **아무것도
 * 없는** 밤이었다 — 남색 면과 초록 면이 맞닿은 그림이지 하늘이 아니었다.
 * 달과 구름 하나씩이 그 면을 하늘로 만든다.
 *
 * ── 어느 그림을 쓰는가 ────────────────────────────────────────────────
 * `Asset/Moon and Cloud.svg` 한 장이다. Tutorial/rule_illustrations에도
 * 달과 구름이 있지만 그쪽은 **얼굴이 달린 캐릭터**다 — 눈이 있고 발밑에
 * 그림자가 눕는다. 하늘에 걸 것은 풍경이라 눈도 그림자도 없는 이 판을
 * 쓴다. 작가가 둘을 한 화판(888×464)에 나란히 그려 두었다.
 *
 * ── 한 파일에서 둘을 꺼내는 법 ────────────────────────────────────────
 * 잘라 내지 않는다. 같은 그림을 두 번 걸고 **보는 창(viewBox)만 다르게**
 * 준다 — 달을 볼 때는 구름이 창 밖이라 안 보인다. 작가가 파일을 고치면
 * 그대로 따라온다. 태그를 오려 내면 그때부터 여기가 원본의 사본이 된다.
 *
 * ── 이것들은 배경이다 ─────────────────────────────────────────────────
 * 여기서 읽혀야 하는 것은 로고와 참여 안내와 캐릭터다. 달의 노랑(#ffd84d)을
 * 그대로 얹으면 화면에서 제일 밝은 것이 된다. 그래서 둘 다 흐리게 깔고
 * (app.css의 opacity) 화면 가장자리에 **걸치게** 둔다 — 다 보이는 것은
 * 주인공이 되고, 잘린 것은 배경이 된다.
 */

/**
 * 창 하나를 만든다.
 *
 * @param box 그 덩어리가 원본 화판에서 실제로 차지하는 자리. 브라우저에
 *   띄워 getBBox로 쟀다 — 달 99.22,109.11 280×280 / 구름 465.3,135.11
 *   312×203. 화판째(888×464) 쓰면 옆의 빈자리까지 자리를 차지해 크기를
 *   맞출 수가 없다.
 * @param tag 같은 그림을 두 번 넣으므로 id가 문서에 두 벌 생긴다. 뒤에
 *   붙여 갈라 둔다.
 */
function window_(box: string, tag: string) {
  return raw
    .replace(/ id="([^"]*)"/g, ` id="$1-${tag}"`)
    .replace(/ data-name="[^"]*"/g, '')
    .replace(/viewBox="[^"]*"/, `viewBox="${box}" aria-hidden="true" focusable="false"`);
}

const MOON = window_('99.22 109.11 280 280', 'moon');
const CLOUD = window_('465.3 135.11 312 203', 'cloud');

export default function HomeSky() {
  return (
    <div className="home-sky" aria-hidden="true">
      <div className="sky-moon" dangerouslySetInnerHTML={{ __html: MOON }} />
      <div className="sky-cloud" dangerouslySetInnerHTML={{ __html: CLOUD }} />
    </div>
  );
}
