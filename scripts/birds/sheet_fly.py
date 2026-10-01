# 나는 새 — 작은 사진을 받고 배경이 단순한 순(하늘)으로 번호표 대조표
import json, os, sys, concurrent.futures as cf
sys.stdout.reconfigure(encoding="utf-8")
from sheet import get, plain, sheet, OUT
found = json.load(open(os.path.join(OUT, "found_fly.json"), encoding="utf-8"))
group = sys.argv[1]; pre = {"flysmall": "s", "flycrow": "k"}[group]
d = os.path.join(OUT, "thumbs", group); os.makedirs(d, exist_ok=True)
items = found[group]
for i, it in enumerate(items): it["id"] = f"{pre}{i:03d}"
with cf.ThreadPoolExecutor(4) as ex: files = list(ex.map(lambda it: get(it, d), items))
for it, f in zip(items, files): it["file"] = f
items = [it for it in items if it["file"]]
for it in items: it["plain"] = plain(it["file"])
items.sort(key=lambda it: it["plain"])
json.dump(items, open(os.path.join(OUT, f"{group}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k in range(0, len(items), 60): sheet(items[k:k + 60], os.path.join(OUT, f"sheet-{group}-{k // 60 + 1}.jpg"))
print(group, len(items))
