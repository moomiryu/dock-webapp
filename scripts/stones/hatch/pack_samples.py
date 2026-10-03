# 바닥에 돌을 15%씩 겹쳐 나란히 — 몇 개까지 서나(벽 1920px = 2.5m). 돌 폭 · 모양 · 글 줄은 앱이 지은 그대로(stone_widths.json)
import json, os, random
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid6 as G6, grid6c as G6c, grid8 as G8, diag9 as D9, fix10 as F10

OUT = G.OUT   # stone_widths.mjs가 쓴 stone_widths.json도 여기
R = json.load(open(os.path.join(OUT, 'stone_widths.json'), encoding='utf-8'))
WALL, MM = 1920, 2500 / 1920          # 1px = 1.30mm(2.5m 벽)
OVER = 0.15
PAL = [('#CCC1BA', '#2B2B2B'), ('#1E3655', '#FFE600'), ('#801420', '#FFFFFF'), ('#B5D0F2', '#1E3655'), ('#134329', '#FFFFFF'), ('#3E315A', '#FFFFFF'), ('#07513C', '#FFFFFF'), ('#2B2B2B', '#FFFFFF')]


def stone_img(r, paint, ink):
    """앱이 지은 돌(사진 돌 id · 뒤집음 · 상자 크기)을 고른 결로 — 칠 RGBA"""
    s = G.S[r['id']]; H = max(20, round(r['hpx'] - 0.1 * r['unit'] * 0))   # 상자 키 ≈ 돌 키
    m, d, W, H2 = G8.fields(r['id'], H, r['flip'], G8.OWOB['미세'])
    size = r['unit'] * 0.73
    got = D9.text_mask_w(m, r['lines'], size, 620)
    tries = 0
    while not got and tries < 12:      # 글이 안 들면(파이썬 글자 자리 찾기가 앱보다 거칠다) 조금 줄인다
        size *= 0.95; tries += 1; got = D9.text_mask_w(m, r['lines'], size, 620)
    g, fade = got if got else (np.zeros(m.shape, np.uint8), np.ones(m.shape, np.float32))
    rg = G6c.region_q(m, d, fade, 3.75, 0.0225, G6.WOB['미세'], 11, 35)
    gap = min(G.GAP / np.sqrt(2), 1.6 * (D9.stroke_px(size, 620)))
    cut = F10.hatch_gap(rg, gap)
    SS = G.SS; out = np.zeros(m.shape + (4,), np.float32)
    on = (m > 0) & ~cut
    out[on, :3] = G.hexrgb(paint); out[on, 3] = 255
    a = (g / 255.0)
    out[..., :3] = out[..., :3] * (1 - a[..., None]) + np.array(G.hexrgb(ink), np.float32) * a[..., None]
    out[..., 3] = np.maximum(out[..., 3], (m > 0) * 255)
    return np.clip(cv2.resize(out, (W, H2), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


def pack(rows):
    """왼쪽부터 — 이웃과 좁은 돌 폭의 15%씩 겹친다. 벽 폭을 넘기 전까지"""
    x, placed, prev = 0.0, [], None
    for r in rows:
        w = r['wpx']
        if prev is not None: x = x + prev['wpx'] - OVER * min(prev['wpx'], w)
        if x + w > WALL: break
        placed.append((x, r)); prev = r
    return placed


def scenario(label, rows, seed):
    random.seed(seed)
    placed = pack(rows)
    STRIP = 470
    strip = Image.new('RGBA', (WALL, STRIP), (0, 0, 0, 255))
    used = placed[-1][0] + placed[-1][1]['wpx'] if placed else 0
    off = (WALL - used) / 2
    for i, (x, r) in enumerate(placed):
        paint, ink = PAL[i % len(PAL)]
        im = Image.fromarray(stone_img(r, paint, ink), 'RGBA')
        strip.alpha_composite(im, (int(round(off + x)), STRIP - 40 - im.height))
    ws = [r['wpx'] for _, r in placed]
    note = f'{len(placed)}개 · 돌 폭 {min(ws):.0f}~{max(ws):.0f}px({min(ws) * MM / 10:.0f}~{max(ws) * MM / 10:.0f}cm) · 차지한 바닥 {used:.0f}px({used * MM / 1000:.2f}m)'
    return strip.convert('RGB'), label, note, len(placed)


if __name__ == '__main__':
    by = lambda s: [r for r in R if r['size'] == s]
    random.seed(4)
    mix = [r for r in R]; random.shuffle(mix)
    widest = sorted(by(60), key=lambda r: -r['wpx'])
    widest = (widest[:3] * 4)                     # 가장 큰 돌 셋을 되풀이
    S = [('매우 작게(28) — 글 길이 아홉 가지', by(28) * 2, 1), ('보통(44)', by(44) * 2, 2), ('매우 크게(60)', by(60) * 2, 3),
         ('크기를 섞은 날 — 다섯 칸 · 글 길이를 아무렇게나', mix, 4), ('가장 나쁜 경우 — 매우 크게 · 가장 넓은 돌만', widest, 5)]
    fb = ImageFont.truetype(G.FONT_SANS, 30); fb.set_variation_by_axes([700])
    fm = ImageFont.truetype(G.FONT_SANS, 22); fm.set_variation_by_axes([600])
    fs = ImageFont.truetype(G.FONT_SANS, 18); fs.set_variation_by_axes([400])
    outs = [scenario(l, rows, sd) for l, rows, sd in S]
    H = 120 + sum(o[0].height + 80 for o in outs)
    sheet = Image.new('RGB', (WALL, H), (0, 0, 0)); dr = ImageDraw.Draw(sheet)
    dr.text((24, 20), '돌을 15%씩 겹쳐 바닥에 나란히 — 2.5m 벽(이 화면 1920px)에 몇 개까지 서나', font=fb, fill=(255, 255, 255))
    dr.text((24, 66), '나무는 빼고 돌만. 돌 모양 · 폭 · 글 줄은 앱이 지은 그대로, 겹침은 이웃 둘 중 좁은 돌 폭의 15%. 쌓지 않는다', font=fs, fill=(170, 170, 170))
    y = 120
    for img, lab, note, n in outs:
        dr.text((24, y), lab, font=fm, fill=(240, 240, 240)); dr.text((24, y + 32), note, font=fs, fill=(160, 160, 160))
        sheet.paste(img, (0, y + 70)); dr.line([(0, y + 70 + img.height - 40), (WALL, y + 70 + img.height - 40)], fill=(70, 70, 70))
        y += img.height + 80
        print(lab, '→', n, '개 |', note)
    sheet.save(os.path.join(OUT, 'pack-samples.png')); print('저장', sheet.size)
