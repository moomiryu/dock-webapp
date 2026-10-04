# 대충 누끼 — 가장자리 3%를 배경으로 두고 GrabCut. 사진과 한 색 실루엣을 나란히 한 판에(체형 고르기용, 손질 전)
import os, sys, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from paths import WORK
FONT = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 22)
ids = sys.argv[2:]; out = sys.argv[1]
cells = []
for id_ in ids:
    im = cv2.imread(os.path.join(WORK, "big", id_ + ".jpg"))
    h, w = im.shape[:2]; k = 900 / max(h, w); sm = cv2.resize(im, (int(w * k), int(h * k)))
    m = np.zeros(sm.shape[:2], np.uint8); r = (int(0.03 * sm.shape[1]), int(0.03 * sm.shape[0]), int(0.94 * sm.shape[1]), int(0.94 * sm.shape[0]))
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(sm, m, r, bg, fg, 6, cv2.GC_INIT_WITH_RECT)
    a = np.where((m == 1) | (m == 3), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(a)
    if n > 1: a = np.where(lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])), 255, 0).astype(np.uint8)
    os.makedirs(os.path.join(WORK, "rough"), exist_ok=True); cv2.imwrite(os.path.join(WORK, "rough", id_ + ".png"), a)
    sil = np.full(sm.shape, 255, np.uint8); sil[a > 0] = (40, 40, 40)
    cells.append((id_, cv2.cvtColor(sm, cv2.COLOR_BGR2RGB), cv2.cvtColor(sil, cv2.COLOR_BGR2RGB)))
cols, cw, ch = 4, 480, 300
rows = (len(cells) + cols - 1) // cols
canvas = Image.new("RGB", (cols * cw, rows * (2 * ch + 34)), (255, 255, 255)); d = ImageDraw.Draw(canvas)
for i, (id_, ph, si) in enumerate(cells):
    x, y = (i % cols) * cw, (i // cols) * (2 * ch + 34)
    for j, arr in enumerate((ph, si)):
        p = Image.fromarray(arr); p.thumbnail((cw - 12, ch - 8)); canvas.paste(p, (x + (cw - p.width) // 2, y + j * ch + (ch - p.height) // 2))
    d.rectangle([x, y + 2 * ch, x + cw - 1, y + 2 * ch + 33], fill=(20, 20, 20)); d.text((x + 10, y + 2 * ch + 4), id_, fill=(255, 255, 255), font=FONT)
canvas.save(out, quality=90); print(out)
