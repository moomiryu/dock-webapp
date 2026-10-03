import json, os, sys, time, urllib.request, re
S = sys.argv[1]
UA = {'User-Agent': 'megafont-silhouette/0.1 (moomiryu@gmail.com)'}
C = json.load(open(f'{S}/cands.json', encoding='utf-8'))
KEEP = 'f020 f021 f022 f023 f036 f037 f038 f039 f043 f044 f045 f057 f058 f059 f061 d030 d035 d037 d044 d060 d062 d068 d069 d070 d076 d082 c015 c052 c053 c054 c058 c073 c074 c077 c088 c089 c090'.split()
rows = {r['id']: r for sp in C.values() for r in sp}
os.makedirs(f'{S}/src', exist_ok=True)
picked = []
for k in KEEP:
    r = rows[k]; p = f'{S}/src/{k}.jpg'
    if not os.path.exists(p):
        url = re.sub(r'/(\d+)px-', '/1280px-', r['thumb']) if r['w'] > 1280 else r['url']
        for a in range(3):
            try: open(p, 'wb').write(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()); break
            except Exception as e: print(k, 'retry', e); time.sleep(3)
        time.sleep(0.3)
    picked.append({k2: r[k2] for k2 in ('id', 'title', 'lic', 'page', 'url', 'camera', 'w', 'h')})
json.dump(picked, open(f'{S}/src/sources.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from PIL import Image
for k in KEEP:
    try: print(k, Image.open(f'{S}/src/{k}.jpg').size, end=' | ')
    except Exception as e: print(k, 'FAIL', e)
