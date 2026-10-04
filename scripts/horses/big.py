# 고른 후보를 긴 쪽 1600px로 받아 둔다(썸네일 주소의 폭만 바꾼다 — 원본이 그보다 작으면 원본). 작업 폴더 big/<id>.jpg
import json, os, re, sys, time, urllib.request
from paths import WORK
UA = {"User-Agent": "megafont-photo-silhouette/0.1 (design study)"}
items = {}
for g in ("stand", "pony", "cute", "muybridge", "move"):
    p = os.path.join(WORK, g + ".json")
    if os.path.exists(p):
        for it in json.load(open(p, encoding="utf-8")): items[it["id"]] = it
d = os.path.join(WORK, "big"); os.makedirs(d, exist_ok=True)
for id_ in sys.argv[1:]:
    it = items[id_]; fn = os.path.join(d, id_ + ".jpg")
    if os.path.exists(fn): continue
    w, h = it["size"]
    # 위키미디어는 작은 사진을 정해진 폭(960 · 1280 · 1920 …)으로만 내준다 — 원본보다 작은 가장 큰 폭으로 받고 여기서 긴 쪽 1600으로
    # 줄인다. 원본 주소는 쉽게 막힌다(429 — 썸네일을 쓰라고 한다)
    std = [s for s in (1920, 1280, 960) if w > s]
    urls = [re.sub(r"/\d+px-", f"/{std[0]}px-", it["thumb"])] if std else [it["url"]]
    got = None
    for url in urls:
        for i in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                    got = r.read(); break
            except Exception as e:
                print("다시", id_, e); time.sleep(15 if "429" in str(e) else 3)
                if "400" in str(e): break
        if got: break
    if not got: print(id_, "못 받음"); continue
    open(fn, "wb").write(got)
    from PIL import Image
    im = Image.open(fn).convert("RGB"); im.thumbnail((1600, 1600)); im.save(fn, quality=92)
    time.sleep(1)
    print(id_, "받음", im.size)
