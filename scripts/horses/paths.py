# 말 실루엣 스크립트의 자리 — 고른 결과는 design/horse-photo, 작업물은 임시 폴더(HORSE_WORK 또는 OS 임시 폴더의 megafont-horses).
# 고른 것을 덮어쓰지 않게 모든 스크립트는 WORK에 쓴다.
import os, tempfile
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'design', 'horse-photo'))
WORK = os.environ.get('HORSE_WORK') or os.path.join(tempfile.gettempdir(), 'megafont-horses')
os.makedirs(WORK, exist_ok=True)
