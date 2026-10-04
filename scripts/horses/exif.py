# 카메라 촬영 정보(EXIF)가 있는 파일만 사진으로 친다 — 그림 · 도판을 걷어 낸다(새 때의 exif.py를 말에 맞게). 머이브리지는 거르지 않는다(옛 인화의 스캔)
import json, os, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
from paths import WORK as OUT
UA = {"User-Agent": "megafont-photo-silhouette/0.1 (design study)"}
API = "https://commons.wikimedia.org/w/api.php"
CAM = {"Make", "Model", "ExposureTime", "FNumber", "FocalLength", "ISOSpeedRatings"}

def fetch(titles):
    p = {"action": "query", "format": "json", "titles": "|".join(titles), "prop": "imageinfo", "iiprop": "commonmetadata"}
    req = urllib.request.Request(API, data=urllib.parse.urlencode(p).encode(), headers=UA)
    for i in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
        except Exception as e:
            print("다시", e); time.sleep(20 * (i + 1) if "429" in str(e) else 4 + 4 * i)
    return {}

for g in sys.argv[1:]:
    items = json.load(open(os.path.join(OUT, g + ".json"), encoding="utf-8"))
    by = {it["title"]: it for it in items}
    ts = list(by)
    for k in range(0, len(ts), 50):
        d = fetch(ts[k:k + 50])
        norm = {n["to"]: n["from"] for n in d.get("query", {}).get("normalized", [])}
        for pg in d.get("query", {}).get("pages", {}).values():
            t = norm.get(pg["title"], pg["title"])
            names = {m.get("name") for m in ((pg.get("imageinfo") or [{}])[0].get("commonmetadata", []) or [])}
            if t in by: by[t]["camera"] = len(names & CAM) >= 2
        time.sleep(2)
    json.dump(items, open(os.path.join(OUT, g + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(g, sum(1 for it in items if it.get("camera")), "/", len(items), "장이 사진")
