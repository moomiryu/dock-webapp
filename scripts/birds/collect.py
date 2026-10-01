# 위키미디어 공용에서 종마다 사진을 훑어 CC0 · 공공 저작물만 남긴다.
import json, sys, time, urllib.parse, urllib.request, os

UA = {"User-Agent": "megafont-photo-silhouette/0.1 (moomiryu@gmail.com)"}
API = "https://commons.wikimedia.org/w/api.php"
from paths import ROOT, WORK as OUT, photo, mask

GROUPS = {
    "round": ["Passer montanus", "Aegithalos caudatus", "Sinosuthora webbiana", "Parus minor",
              "Parus major", "Cyanistes caeruleus", "Erithacus rubecula", "Pyrrhula pyrrhula"],
    "crow": ["Corvus macrorhynchos", "Corvus corone", "Corvus brachyrhynchos", "Corvus frugilegus"],
}

def ok(lic):
    l = (lic or "").lower()
    return l.startswith("cc0") or "public domain" in l or l.startswith("pd")

def fetch(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print("  retry", e, file=sys.stderr); time.sleep(3 + i * 3)
    return {}

def species(name, cap=600):
    got, cont = {}, {}
    while len(got) < cap:
        p = {"action": "query", "format": "json", "generator": "search",
             "gsrsearch": f'filetype:bitmap deepcat:"{name}"', "gsrnamespace": 6, "gsrlimit": 50,
             "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 480,
             "iiextmetadatafilter": "LicenseShortName|Artist|ImageDescription"}
        p.update(cont)
        d = fetch(p)
        for pg in (d.get("query", {}).get("pages", {}) or {}).values():
            ii = (pg.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata", {})
            lic = em.get("LicenseShortName", {}).get("value", "")
            if not ok(lic): continue
            got[pg["title"]] = {"title": pg["title"], "license": lic,
                                "artist": em.get("Artist", {}).get("value", ""),
                                "page": ii.get("descriptionurl"), "url": ii.get("url"),
                                "thumb": ii.get("thumburl"), "size": [ii.get("width"), ii.get("height")],
                                "species": name}
        if "continue" not in d: break
        cont = {k: v for k, v in d["continue"].items()}
        time.sleep(0.5)
    return list(got.values())

if __name__ == "__main__":
    res = {}
    for g, names in GROUPS.items():
        res[g] = []
        for n in names:
            s = species(n)
            print(g, n, len(s))
            res[g] += s
    json.dump(res, open(os.path.join(OUT, "found.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
