# 나는 새 — 종의 분류 안에서 'flight · flying'이 든 파일을 훑어 CC0 · 공공 + 촬영 정보(EXIF)가 있는 것만 남긴다.
import json, os, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
UA = {"User-Agent": "megafont-photo-silhouette/0.1 (moomiryu@gmail.com)"}
API = "https://commons.wikimedia.org/w/api.php"
OUT = os.path.dirname(os.path.abspath(__file__))
CAM = {"Make", "Model", "ExposureTime", "FNumber", "FocalLength", "ISOSpeedRatings"}
GROUPS = {
    "flywing": ["Passeriformes in flight"],
}

def ok(lic):
    l = (lic or "").lower()
    return l.startswith("cc0") or "public domain" in l or l.startswith("pd")

def fetch(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print("  retry", e, flush=True); time.sleep(4 + 4 * i)
    return {}

def species(name, cap=4000):
    got, cont, seen = {}, {}, 0
    while seen < cap:
        p = {"action": "query", "format": "json", "generator": "search",
             "gsrsearch": f'filetype:bitmap deepcat:"{name}"', "gsrnamespace": 6, "gsrlimit": 50,
             "prop": "imageinfo", "iiprop": "url|extmetadata|size|commonmetadata", "iiurlwidth": 480,
             "iiextmetadatafilter": "LicenseShortName|Artist"}
        p.update(cont)
        d = fetch(p)
        pages = (d.get("query", {}).get("pages", {}) or {}).values()
        seen += len(pages)
        for pg in pages:
            ii = (pg.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata", {})
            lic = em.get("LicenseShortName", {}).get("value", "")
            names = {m.get("name") for m in (ii.get("commonmetadata") or [])}
            if not ok(lic): continue
            got[pg["title"]] = {"title": pg["title"], "license": lic, "artist": em.get("Artist", {}).get("value", ""),
                                "page": ii.get("descriptionurl"), "url": ii.get("url"), "thumb": ii.get("thumburl"),
                                "size": [ii.get("width"), ii.get("height")], "species": name.replace(" in flight", "") + " fly", "camera": len(names & CAM) >= 2}
        if "continue" not in d: break
        cont = dict(d["continue"]); time.sleep(0.6)
    return list(got.values())

if __name__ == "__main__":
    res = {}
    for g, names in GROUPS.items():
        res[g] = []
        for n in names:
            s = species(n); print(g, n, len(s), flush=True); res[g] += s
    json.dump(res, open(os.path.join(OUT, sys.argv[1] if len(sys.argv) > 1 else "found_fly.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
