# 카메라 촬영 정보(EXIF)가 있는 파일만 사진으로 친다 — 삽화 · 도판 · 해골 그림을 걷어 낸다.
import json, os, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
from paths import ROOT, WORK as OUT, photo, mask
UA = {"User-Agent": "megafont-photo-silhouette/0.1 (moomiryu@gmail.com)"}
API = "https://commons.wikimedia.org/w/api.php"
CAM = {"Make", "Model", "ExposureTime", "FNumber", "FocalLength", "ISOSpeedRatings"}

def fetch(titles):
    p = {"action": "query", "format": "json", "titles": "|".join(titles), "prop": "imageinfo", "iiprop": "commonmetadata"}
    req = urllib.request.Request(API, data=urllib.parse.urlencode(p).encode(), headers=UA)
    for i in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
        except Exception as e:
            print("retry", e); time.sleep(4 + 4 * i)
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
            md = (pg.get("imageinfo") or [{}])[0].get("commonmetadata", []) or []
            names = {m.get("name") for m in md}
            if t in by: by[t]["camera"] = len(names & CAM) >= 2
        time.sleep(0.4)
    json.dump(items, open(os.path.join(OUT, g + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(g, sum(1 for it in items if it.get("camera")), "/", len(items))
