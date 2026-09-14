import { moods } from './palettes-v2';
import type { ToneState } from '../types';
export const MESSAGE_COLORS = ['#000000', '#FFFFFF', '#00FF88', '#FFFF00', '#FF6B6B', '#1E2A52', '#0033FF', '#FFEE00', '#FF0080', '#E4002B', '#FFD93D'] as const;
export function messageColors(tone: ToneState) {
    const legacy = moods[((tone.paletteIdx % moods.length) + moods.length) % moods.length];
    const requestedBg = (tone.backgroundColor ?? legacy.bg).toUpperCase();
    const bg = requestedBg === '#000000' ? '#FFFFFF' : requestedBg;
    const text = (tone.textColor ?? legacy.text).toUpperCase();
    return { bg: bg.toUpperCase() === '#000000' ? '#FFFFFF' : bg, text: text.toUpperCase() === bg.toUpperCase() ? (bg === '#FFFFFF' ? '#000000' : '#FFFFFF') : text };
}
export function sizeScale(size: number) { return Math.min(60, Math.max(28, size)) / 44; }
