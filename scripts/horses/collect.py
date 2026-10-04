# 위키미디어 공용에서 말 사진을 분류마다 훑어 CC0 · 공공 저작물만 남긴다(2026-10-04, 유머있는 = 말).
# 요청 이름표에 개인 정보를 넣지 않는다. 너무 빨리 물으면 막히므로(429) 사이를 두고, 막히면 길게 쉬었다 다시.
import json, sys, time, urllib.parse, urllib.request, os
from paths import WORK

UA = {"User-Agent": "megafont-photo-silhouette/0.1 (design study)"}
API = "https://commons.wikimedia.org/w/api.php"

# 무엇을 찾나 — 기본 자세(서 있는 옆모습 · 귀여운 체형)와 움직임(머이브리지 연속 사진 · 질주 · 풀 뜯기 · 뒹굴기 · 뛰어오르기)
GROUPS = {
    "stand": ["Conformational side views of horses", "Side views of standing horses"],
    "pony": ["Shetland ponies", "Foals"],
    # 귀여운 체형 — 짧은 다리 · 둥근 배 · 큰 머리 · 짧게 선 갈기. 실루엣으로 '귀여움'이 읽히는 품종(2026-10-04)
    "cute": ["Conformational side views of Shetland ponies", "Shetland pony", "Norwegian fjord horse",
             "Conformational side views of Icelandic horses", "Equus przewalskii"],
    "muybridge": ["Sallie Gardner at a Gallop", "Horse in Motion", "Horse motion studies by Eadweard Muybridge"],
    "move": ["Side views of galloping horses", "Side views of walking horses", "Grazing horses",
             "Rolling horses", "Horses lying down", "Rearing horses", "Horses bucking"],
}

def ok(lic):
    l = (lic or "").lower()
    return l.startswith("cc0") or "public domain" in l or l.startswith("pd")

def fetch(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            wait = 20 * (i + 1) if "429" in str(e) else 3 + i * 3
            print("  다시", e, f"{wait}초 쉼", file=sys.stderr); time.sleep(wait)
    return {}

def category(name, cap=400):
    got, cont = {}, {}
    while len(got) < cap:
        p = {"action": "query", "format": "json", "generator": "search",
             "gsrsearch": f'filetype:bitmap deepcat:"{name}"', "gsrnamespace": 6, "gsrlimit": 50,
             "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 480,
             "iiextmetadatafilter": "LicenseShortName|Artist|ImageDescription|DateTimeOriginal"}
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
                                "category": name}
        if "continue" not in d: break
        cont = {k: v for k, v in d["continue"].items()}
        time.sleep(1.5)
    return list(got.values())

if __name__ == "__main__":
    # 그룹을 이름으로 주면 그것만 다시 모아 found.json에 더한다
    path = os.path.join(WORK, "found.json")
    res = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    for g, names in GROUPS.items():
        if len(sys.argv) > 1 and g not in sys.argv[1:]: continue
        res[g] = []
        for n in names:
            s = category(n)
            print(g, n, len(s), flush=True)
            res[g] += s
            time.sleep(2)
    json.dump(res, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("저장", path)
