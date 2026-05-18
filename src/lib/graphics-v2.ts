// v1 graphic vocabulary — 자모 골격(Korean character bones).
// Replaces GT Mechanik aru (sphere/dots/grid/concentric/waves).
// All graphics:
//   - use stroke/fill = currentColor for palette inheritance
//   - opacity 0.6–0.8 for optical mixing with text/bg
//   - bold strokes (12–20px @ 380x260 viewBox)
//   - subtle motion (3–14s cycles, never busy)

export const graphics: string[] = [
  // === ㅇ — 원음 (circle of utterance) — huge outline ring, slow rotation + breathing
  `<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice" style="opacity:0.7">
    <g style="animation: dockOBreath 7s ease-in-out infinite; transform-origin: 190px 130px">
      <circle cx="190" cy="130" r="115" fill="none" stroke="currentColor" stroke-width="16"/>
      <circle cx="190" cy="130" r="115" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="2,12" style="animation: dockORot 24s linear infinite; transform-origin: 190px 130px"/>
    </g>
  </svg>`,

  // === ㄱ — 모서리 (corner of the wall) — bold L-shape, occasional 90° rotation
  `<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice" style="opacity:0.7">
    <g style="animation: dockGQuarter 12s steps(1) infinite; transform-origin: 190px 130px">
      <path d="M 70 40 L 290 40 L 290 60 L 90 60 L 90 220 L 70 220 Z" fill="currentColor"/>
    </g>
  </svg>`,

  // === ㅅ — 산형 (peak / rising) — multiple mountain peaks, exhale rise
  `<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice" style="opacity:0.7">
    <g fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M 30 220 L 110 50 L 190 220" style="animation: dockSRise 5.5s ease-in-out infinite"/>
      <path d="M 150 220 L 230 90 L 310 220" style="animation: dockSRise 5.5s ease-in-out -1.8s infinite"/>
      <path d="M 260 220 L 340 130 L 420 220" style="animation: dockSRise 5.5s ease-in-out -3.5s infinite"/>
    </g>
  </svg>`,

  // === ─ — 단선 (lines / wall grid) — 3 thick horizontal bars with offset registration jitter
  `<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice" style="opacity:0.7">
    <g style="animation: dockLineDrift 9s ease-in-out infinite">
      <rect x="0" y="60" width="380" height="14" fill="currentColor"/>
      <rect x="0" y="128" width="380" height="14" fill="currentColor" style="animation: dockLineJitter 3.1s ease-in-out infinite"/>
      <rect x="0" y="196" width="380" height="14" fill="currentColor"/>
    </g>
  </svg>`,

  // === ※ — 별표 (six-ray asterisk) — radial strokes, rotation + pulse
  `<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice" style="opacity:0.7">
    <g stroke="currentColor" stroke-width="18" stroke-linecap="square" style="animation: dockAsterRot 18s linear infinite; transform-origin: 190px 130px">
      <line x1="190" y1="30" x2="190" y2="230"/>
      <line x1="80" y1="65" x2="300" y2="195"/>
      <line x1="80" y1="195" x2="300" y2="65"/>
    </g>
  </svg>`
];
