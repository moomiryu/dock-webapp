// Generate PNG PWA icons from public/icon.svg using @resvg/resvg-js.
// Run with: node scripts/generate-icons.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(import.meta.dirname, '..');
const srcSvg = readFileSync(resolve(root, 'public/icon.svg'), 'utf8');

// 두 장은 투명할 수 없다(2026-09-21 b48936d): iOS는 apple-touch-icon의 투명한 곳을
// 검게 칠하고, 안드로이드는 maskable의 가려지는 곳을 채운다. 둘 다 흰 바탕(#ffffff,
// manifest의 theme·background와 같은 앱의 종이색)에 얹는다.
// maskable은 가운데 원(반지름 40%)만 늘 보인다 — 그림을 한쪽 64px(12.5%)씩 들여
// 그 안에 넣는다. 나머지 넷은 그림 그대로(투명한 곳은 투명).
// 판의 크기는 원본 viewBox에서 읽는다 — 2026-09-27까지 512와 분홍(#FCE7F3)이 박혀
// 있어서, 판이 512가 아닌 그림은 maskable에서 어긋났다.
const [, , vbW, vbH] = srcSvg.match(/viewBox="([^"]+)"/)[1].trim().split(/\s+/).map(Number);
const inner = srcSvg.replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

function onWhite(size, pad) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#ffffff"/>
    <svg x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" viewBox="0 0 ${vbW} ${vbH}">
      ${inner}
    </svg>
  </svg>`;
}

const targets = [
  { name: 'pwa-64x64.png', size: 64, svg: srcSvg },
  { name: 'pwa-192x192.png', size: 192, svg: srcSvg },
  { name: 'pwa-512x512.png', size: 512, svg: srcSvg },
  { name: 'maskable-icon-512x512.png', size: 512, svg: onWhite(512, 64) },
  { name: 'apple-touch-icon.png', size: 180, svg: onWhite(180, 0) }
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
