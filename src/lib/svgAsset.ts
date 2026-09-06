// 일러스트레이터에서 나온 SVG를 문서에 그대로 부어 넣기 전에 손보는 일.
//
// 그 도구는 파일마다 `.cls-1` `.cls-2` 같은 이름과 `id="_레이어_1"` 을 붙여 내보낸다.
// 한 장일 때는 문제가 없지만, by_moomiryu에 에셋이 둘 이상 쌓이는 순간
// 두 번째 파일의 `.cls-1`이 첫 번째 파일의 색을 덮어쓴다. <style>이 문서 전역이라서다.
// id도 마찬가지로 그라디언트·마스크 참조(url(#...))가 엉킨다.
//
// 그래서 붓기 전에 이름 뒤에 에셋 키를 달아 각자 방을 준다.
// 원본 파일은 건드리지 않는다 — 그림은 작가 것이고, 여기서는 읽기만 한다.
export function scopeSvg(raw: string, key: string): string {
  return raw
    .replace(/\bcls-(\d+)\b/g, `cls-$1-${key}`)
    .replace(/\sid="([^"]+)"/g, ` id="$1-${key}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${key})`)
    .replace(/(\s(?:xlink:)?href=")#([^"]+)"/g, `$1#$2-${key}"`);
}
