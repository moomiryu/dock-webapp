import { moods } from './palettes-v2';
import type { ToneState } from '../types';
export const MESSAGE_COLORS = ['#000000', '#FFFFFF', '#00FF88', '#FFFF00', '#FF6B6B', '#1E2A52', '#0033FF', '#FFEE00', '#FF0080', '#E4002B', '#FFD93D'] as const;
/**
 * 아직 색을 고르기 전, 쓰는 동안의 바탕.
 *
 * moods[0]('밤', 형광 초록)이 기본으로 서 있었는데, 그건 **고른 색**이지
 * '아직 안 고름'의 모습이 아니다. 한 줄 화면에서 배경이 통째로 그 색이
 * 되고 나니 고르지도 않은 형광 초록이 화면을 다 먹었다.
 *
 * 앱이 제 것으로 쓰는 하늘색을 쓴다(--brand-sub #3CCED0). moods에 넣지
 * 않는다 — 고를 수 있는 열 조합은 그대로 열 개고, 이건 그 바깥의
 * 작업용 바탕이다. 04에서 고르는 순간 열 중 하나로 갈아탄다.
 */
export const DRAFT_COLORS = { backgroundColor: '#3CCED0', textColor: '#000000' } as const;

export function messageColors(tone: ToneState) {
    const legacy = moods[((tone.paletteIdx % moods.length) + moods.length) % moods.length];
    const requestedBg = (tone.backgroundColor ?? legacy.bg).toUpperCase();
    const bg = requestedBg === '#000000' ? '#FFFFFF' : requestedBg;
    const text = (tone.textColor ?? legacy.text).toUpperCase();
    return { bg: bg.toUpperCase() === '#000000' ? '#FFFFFF' : bg, text: text.toUpperCase() === bg.toUpperCase() ? (bg === '#FFFFFF' ? '#000000' : '#FFFFFF') : text };
}
export function sizeScale(size: number) { return Math.min(60, Math.max(28, size)) / 44; }
