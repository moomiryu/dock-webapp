import { useSyncExternalStore } from 'react';

/**
 * 화면 언어 (2026-09-26, 영문판).
 *
 * 기본은 한국어다. 바꾸는 자리는 하나 — 홈 캐릭터를 누르면 뜨는 창
 * (LangDialog)의 두 칸 스위치. 고른 언어는 폰에 남아(localStorage) 다음에
 * 와도 그대로다. 시스템이 폰 언어를 보고 대신 고르지 않는다(사용자 결정).
 *
 * <html lang>도 함께 바꾼다 — 낭독기가 그 언어의 목소리로 읽고, 줄바꿈·
 * 하이픈 규칙도 그 언어를 따른다.
 */
export type Lang = 'ko' | 'en';

const KEY = 'megafont.lang';
const subs = new Set<() => void>();

function read(): Lang {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'ko'; } catch { return 'ko'; }
}

let current: Lang = read();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const getLang = () => current;

export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* 막힌 저장소 — 이번 탭에서만 바뀐다 */ }
  document.documentElement.lang = next;
  subs.forEach((f) => f());
}

/** 지금 언어. 바뀌면 부른 컴포넌트가 다시 그려진다 */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    getLang,
    getLang
  );
}

/** 한 쌍의 말 가운데 지금 언어 쪽 */
export type Pair<T = string> = { ko: T; en: T };
export const pick = <T,>(pair: Pair<T>, lang: Lang = current): T => pair[lang];

/** 영어 수 붙이기 — 1 day / 3 days. 한국어는 수로 모양이 안 바뀌어 필요 없다 */
export const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
