// Generate PNG PWA icons from public/icon.svg using @resvg/resvg-js.
// Run with: node scripts/generate-icons.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(import.meta.dirname, '..');
const srcSvg = readFileSync(resolve(root, 'public/icon.svg'), 'utf8');

// Maskable icons need a "safe zone" — the inner ~80% of the canvas is guaranteed
// visible. We render the same SVG inside a smaller viewBox so the rounded square
// is padded with the bg color, allowing OS-level masks to crop edges without
// clipping the logo.
function buildMaskableSvg(inner) {
  const pad = 64; // padding on each side at 512px canvas → ~12.5%
  // Re-extract the bg color from the inner SVG (we know it: #FCE7F3)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#FCE7F3"/>
    <svg x="${pad}" y="${pad}" width="${512 - pad * 2}" height="${512 - pad * 2}" viewBox="0 0 512 512">
      ${inner.replace(/<svg[^>]*>/, '').replace('</svg>', '')}
    </svg>
  </svg>`;
}

const targets = [
  { name: 'pwa-64x64.png', size: 64, svg: srcSvg },
  { name: 'pwa-192x192.png', size: 192, svg: srcSvg },
  { name: 'pwa-512x512.png', size: 512, svg: srcSvg },
  { name: 'maskable-icon-512x512.png', size: 512, svg: buildMaskableSvg(srcSvg) },
  { name: 'apple-touch-icon.png', size: 180, svg: srcSvg }
];

const outDir = resolve(root, 'public');
mkdirSync(outDir, { recursive: true });

for (const t of targets) {
  const resvg = new Resvg(t.svg, {
    fitTo: { mode: 'width', value: t.size },
    background: 'rgba(0,0,0,0)'
  });
  const pngData = resvg.render().asPng();
  const outPath = resolve(outDir, t.name);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, pngData);
  console.log(`✓ ${t.name} (${t.size}×${t.size}, ${(pngData.length / 1024).toFixed(1)} KB)`);
}

console.log(`\nGenerated ${targets.length} icons in public/`);
