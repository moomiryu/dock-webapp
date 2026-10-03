# 세 풀의 분류에서 CC0 · 공공 사진만, 카메라 정보가 남은 실제 사진만 추려 480px 미리보기를 받는다
import json, os, urllib.request, urllib.parse, sys, time
S = sys.argv[1]
UA = {'User-Agent': 'megafont-silhouette/0.1 (moomiryu@gmail.com)'}
def api(**p):
    p.update(format='json')
    req = urllib.request.Request('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(p), headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=60))
SPECIES = {
  'foxtail': ['Setaria viridis', 'Setaria pumila', 'Setaria faberi'],
  'dandelion': ['Taraxacum officinale', 'Taraxacum officinale (flowers)', 'Taraxacum officinale (fruit)', 'Taraxacum officinale (leaves)',
                'Taraxacum officinale (habitat)', 'Taraxacum officinale (stems)', 'Taraxacum platycarpum'],
  'clover': ['Trifolium repens', 'Trifolium repens (flowers)', 'Trifolium repens leaves', 'Trifolium repens (habitat)'],
}
OK = ('cc0', 'public domain', 'pd')
out = {}
for sp, cats in SPECIES.items():
    seen, rows = set(), []
    for cat in cats:
        cont = {}
        while True:
            r = api(action='query', generator='categorymembers', gcmtitle='Category:' + cat, gcmtype='file', gcmlimit=200,
                    prop='imageinfo', iiprop='url|extmetadata|size|mime|commonmetadata', iiurlwidth=480, **cont)
            for pg in r.get('query', {}).get('pages', {}).values():
                if pg['title'] in seen or 'imageinfo' not in pg: continue
                seen.add(pg['title'])
                ii = pg['imageinfo'][0]
                if ii.get('mime') != 'image/jpeg': continue
                lic = ii.get('extmetadata', {}).get('LicenseShortName', {}).get('value', '')
                if not lic.lower().startswith(OK): continue
                cm = {m['name']: m['value'] for m in ii.get('commonmetadata', []) if isinstance(m.get('value'), (str, int, float))}
                if not (cm.get('Model') or cm.get('Make')): continue
                rows.append({'title': pg['title'], 'lic': lic, 'w': ii['width'], 'h': ii['height'], 'thumb': ii.get('thumburl'),
                             'url': ii['url'], 'page': ii.get('descriptionurl'), 'cat': cat, 'camera': str(cm.get('Model', cm.get('Make')))})
            if 'continue' not in r: break
            cont = {k: v for k, v in r['continue'].items()}
            time.sleep(0.3)
    out[sp] = rows
    print(sp, 'files kept', len(rows))
json.dump(out, open(f'{S}/cands.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
