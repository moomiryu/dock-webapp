import { useEffect, useState } from 'react';
import { isDiagMode } from '../lib/stage';

/**
 * 실기 진단판(`?diag=1`, 2026-11-03). 아이폰 12(iOS 26.6) 사파리 · 크롬에서만 5/5 말풍선이 비고 06 삽화가 안 뜨는데, PC 웹킷으로는
 * 재현도 측정도 안 됐다. 디자이너가 폰에서 열어 사진으로 보내면 원인이 갈린다 — 판(캔버스)을 못 얻는지, 크기가 0인지, 글자가 어디 있는지,
 * 삽화 칸이 높이를 잃었는지. 참여자는 못 본다(주소에 diag=1을 붙여야). 0.5초마다 다시 읽는다. 다 밝혀지면 걷는다
 */
export default function DiagPanel() {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!isDiagMode()) return;
    const r = (el: Element | null) => { if (!el) return '없음'; const b = el.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}×${Math.round(b.height)}`; };
    const read = () => {
      const out: string[] = [`${innerWidth}×${innerHeight} dpr${devicePixelRatio} ${navigator.userAgent.match(/(iPhone|CriOS|Version)\/?[\d._]*/g)?.join(' ') ?? ''}`];
      // 판 하나를 새로 잡아 보기 — 상한에 걸렸으면 여기서 null이 난다. 바로 놓는다
      const probe = document.createElement('canvas'); probe.width = 1170; probe.height = 1962;
      out.push(`새 판 1170×1962: ${probe.getContext('2d') ? '됨' : '못 얻음'}`); probe.width = probe.height = 0;
      for (const cv of document.querySelectorAll<HTMLCanvasElement>('.dot-bubble canvas, .preview-yard canvas, .sim-frame canvas')) {
        out.push(`판 ${cv.parentElement?.className.split(' ')[0]} ${cv.width}×${cv.height} ctx:${cv.getContext('2d') ? '됨' : '없음'} 상자 ${r(cv.parentElement)}`);
      }
      const gl = document.querySelectorAll<HTMLElement>('.arc-glyph');
      if (gl.length) out.push(`글자 ${gl.length}개 첫 ${gl[0].style.left || '-'} ${gl[0].style.top || '-'} 끝 ${gl[gl.length - 1].style.left || '-'} ${gl[gl.length - 1].style.top || '-'} · 모임 ${document.querySelector('.dot-text')?.hasAttribute('data-moving') ? '중' : '끝'}`);
      const art = document.querySelector('.dock-guide');
      if (art) out.push(`삽화칸 ${r(art)} / span ${r(art.firstElementChild)} / svg ${r(art.querySelector('svg'))} · 그림요소 ${art.querySelectorAll('path, rect, circle, ellipse, polygon').length}`);
      setText(out.join('\n'));
    };
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, []);
  return text ? <pre className="diag-panel" aria-hidden="true">{text}</pre> : null;
}
