# 새 실루엣 스크립트의 자리 — 고른 결과는 design/bird-photo, 작업물은 임시 폴더(BIRD_WORK 또는 OS 임시 폴더의 megafont-birds)
# 고른 것을 덮어쓰지 않게 모든 스크립트는 WORK에 쓴다.
import os, tempfile
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'design', 'bird-photo'))
WORK = os.environ.get('BIRD_WORK') or os.path.join(tempfile.gettempdir(), 'megafont-birds')
os.makedirs(WORK, exist_ok=True)

def photo(group, id_):
    """받아 둔 큰 사진 — 작업 폴더에 없으면 저장소에 둔 원본"""
    p = os.path.join(WORK, 'big', group, id_ + '.jpg')
    return p if os.path.exists(p) else os.path.join(ROOT, 'src', id_ + '.jpg')

def mask(sub, id_):
    """떼어 낸 판(cut) · 다리 걷은 판(cut2 → 저장소에선 mask) — 작업 폴더 먼저"""
    for p in (os.path.join(WORK, sub, id_ + '.png'), os.path.join(ROOT, {'cut': 'cut', 'cut2': 'mask'}[sub], id_ + '.png'),
              os.path.join(ROOT, 'fly', 'src', id_ + '-cut.png')):
        if os.path.exists(p): return p
    return p
