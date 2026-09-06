# 참조 스크린샷에서 실제 치수를 잰다.
#
# DESIGN.md는 간격 군집(4·6·8·16·24·32)과 버튼(56/16, 라벨 17/600)을
# '문서 사이트에서 계산된 값'으로 적어 뒀다. 실제 제품 화면이 같은 값을
# 쓰는지는 다른 문제다. 눈으로는 8과 12를 구분할 수 없으므로 픽셀로 잰다.
#
#   python scripts/measure-reference.py "reference capture"
#
# 재는 것
#   · 좌우 여백 — 화면 padding
#   · 기본 버튼(파랑) 의 높이 · 라운드 · 바닥 여백 · 좌우 여백
#   · 세로 공백 띠의 분포 — 간격이 몇 칸으로 양자화돼 있는가
#
# 한계는 분명히 해 둔다: 여기서 재는 세로 공백은 *잉크 사이의 빈 줄*이지
# CSS margin이 아니다. 글줄의 위아래 여유(leading)가 이미 먹고 들어가므로
# 실제 CSS 간격은 잰 값보다 크다. 양자화의 '결'을 보는 용도다.

import sys, os, glob, collections, warnings
from PIL import Image, ImageChops

warnings.filterwarnings('ignore')
# 윈도우 콘솔이 cp949라 막대 문자를 못 찍는다. 출력만 UTF-8로 돌린다.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SCALE = 3                 # @3x 캡처 → CSS px = 픽셀 / 3
STATUS_H = 60 * SCALE     # 상태바(시계·배터리)는 앱이 아니다
HOME_H = 26 * SCALE       # 홈 인디케이터
TOSS_BLUE = (49, 130, 246)   # #3182f6 — 문서가 말하는 product primary


def mask_close_to(im, rgb, tol):
    """rgb에 가까운 픽셀만 흰색인 1비트 마스크."""
    flat = Image.new('RGB', im.size, rgb)
    diff = ImageChops.difference(im, flat).convert('L')
    return diff.point(lambda v: 255 if v <= tol else 0, mode='L')


def mask_ink(im, bg, tol=26):
    """배경에서 충분히 벗어난 픽셀만 흰색인 마스크."""
    flat = Image.new('RGB', im.size, bg)
    diff = ImageChops.difference(im, flat).convert('L')
    return diff.point(lambda v: 255 if v > tol else 0, mode='L')


def row_profile(mask):
    """행마다 잉크 비율(0~255). resize(BOX)가 C에서 평균을 내준다."""
    w, h = mask.size
    return list(mask.resize((1, h), Image.BOX).getdata())


def col_profile(mask):
    w, h = mask.size
    return list(mask.resize((w, 1), Image.BOX).getdata())


def bands(profile, thresh, y0=0):
    """잉크가 있는 구간 [(시작, 끝), ...]"""
    out, start = [], None
    for i, v in enumerate(profile):
        if v > thresh and start is None:
            start = i
        elif v <= thresh and start is not None:
            out.append((start + y0, i + y0))
            start = None
    if start is not None:
        out.append((start + y0, len(profile) + y0))
    return out


def measure(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    body = im.crop((0, STATUS_H, W, H - HOME_H))
    bw, bh = body.size

    # 배경 — 본문 영역에서 가장 흔한 색
    small = body.resize((bw // 6, bh // 6), Image.BOX)
    bg = collections.Counter(small.getdata()).most_common(1)[0][0]
    dark = sum(bg) < 3 * 128

    ink = mask_ink(body, bg)
    rows = row_profile(ink)
    cols = col_profile(ink)

    # 좌우 여백 — 잉크가 시작·끝나는 열
    lit = [i for i, v in enumerate(cols) if v > 3]
    left = lit[0] / SCALE if lit else None
    right = (bw - 1 - lit[-1]) / SCALE if lit else None

    # 기본 버튼 — 파랑이 가로로 길게 이어지는 줄을 찾는다.
    # bbox로 잡으면 로고·아이콘·글자의 파랑까지 한 덩어리가 돼 못 쓴다.
    blue = mask_close_to(body, TOSS_BLUE, 44)
    brow = row_profile(blue)
    wide = [i for i, v in enumerate(brow) if v > 255 * 0.55]
    btn = None
    if wide:
        # 가장 아래쪽의 연속 구간이 기본 버튼이다
        runs, start = [], wide[0]
        for a, b in zip(wide, wide[1:]):
            if b - a > 2:
                runs.append((start, a)); start = b
        runs.append((start, wide[-1]))
        y0, y1 = runs[-1]
        h = (y1 - y0 + 1) / SCALE
        if 30 <= h <= 90:
            mid = (y0 + y1) // 2
            midrow = list(blue.crop((0, mid, bw, mid + 1)).getdata())
            on = [i for i, v in enumerate(midrow) if v > 127]
            if on:
                x0, x1 = on[0], on[-1]
                # 라운드 — 맨 왼쪽 열에서 색이 시작되는 지점이 곧 반지름
                colp = list(blue.crop((x0, y0, x0 + 1, y1 + 1)).getdata())
                first = next((i for i, v in enumerate(colp) if v > 127), 0)
                btn = {
                    'h': round(h),
                    'w': round((x1 - x0 + 1) / SCALE),
                    'radius': round(first / SCALE),
                    'left': round(x0 / SCALE),
                    'right': round((bw - 1 - x1) / SCALE),
                    'bottom': round((bh - 1 - y1) / SCALE + HOME_H / SCALE),
                }

    # 세로 공백 띠 — 잉크 구간 사이의 빈 줄
    bnds = bands(rows, 3)
    gaps = []
    for a, b in zip(bnds, bnds[1:]):
        g = (b[0] - a[1]) / SCALE
        if 1 <= g <= 120:
            gaps.append(round(g))

    # 줄 피치 — 비슷한 높이의 이웃 띠가 얼마 간격으로 놓이는가.
    # 두 줄짜리 제목의 첫 줄과 둘째 줄 사이 거리가 곧 line-height다.
    pitch, glyph = [], []
    for a, b in zip(bnds, bnds[1:]):
        ha, hb = a[1] - a[0], b[1] - b[0]
        if ha > 8 * SCALE:
            glyph.append(round(ha / SCALE))
        d = (b[0] - a[0]) / SCALE
        if 12 <= d <= 70 and min(ha, hb) > 0 and abs(ha - hb) / max(ha, hb) < 0.35:
            pitch.append(round(d))

    return {
        'file': os.path.basename(path),
        'pitch': pitch,
        'glyph': glyph,
        'bg': bg,
        'dark': dark,
        'left': round(left, 1) if left is not None else None,
        'right': round(right, 1) if right is not None else None,
        'btn': btn,
        'gaps': gaps,
    }


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else 'reference capture'
    # 윈도우 glob은 대소문자를 가리지 않아 같은 파일이 두 번 잡힌다
    files = sorted({os.path.normcase(p) for p in
                    glob.glob(os.path.join(folder, '*.PNG')) + glob.glob(os.path.join(folder, '*.png'))})
    if not files:
        print('이미지를 못 찾았다:', folder)
        return

    rows = [measure(p) for p in files]

    print(f'\n{len(rows)}장 · @{SCALE}x (CSS px로 환산)\n')

    dark = sum(1 for r in rows if r['dark'])
    print(f'배경  어두움 {dark}장 / 밝음 {len(rows) - dark}장')

    lefts = collections.Counter(r['left'] for r in rows if r['left'] is not None)
    print('\n좌측 여백 (잉크가 시작되는 x)')
    for v, c in sorted(lefts.items())[:12]:
        print(f'  {v:>6} px  {"#" * c} {c}')

    btns = [r['btn'] for r in rows if r['btn']]
    print(f'\n기본 버튼 {len(btns)}장에서 검출')
    for key in ('h', 'radius', 'left', 'bottom'):
        cnt = collections.Counter(b[key] for b in btns)
        top = ', '.join(f'{v}px×{c}' for v, c in cnt.most_common(4))
        print(f'  {key:>7}: {top}')

    pitches = collections.Counter(p for r in rows for p in r['pitch'])
    print()
    print('줄 피치 - 같은 크기 글줄의 시작점 사이 거리 (= line-height, 상위 10)')
    for v, c in sorted(pitches.items(), key=lambda x: -x[1])[:10]:
        print(f'  {v:>4} px  {chr(35) * min(c, 50)} {c}')

    glyphs = collections.Counter(g for r in rows for g in r['glyph'])
    print()
    print('글줄 높이 - 한 줄 잉크의 세로 크기 (글자 크기 대략치, 상위 10)')
    for v, c in sorted(glyphs.items(), key=lambda x: -x[1])[:10]:
        print(f'  {v:>4} px  {chr(35) * min(c, 50)} {c}')

    allgaps = [g for r in rows for g in r['gaps']]
    block = collections.Counter(g for g in allgaps if g >= 20)
    line = collections.Counter(g for g in allgaps if g < 20)
    print()
    print('덩어리 사이 공백 (>=20px, 상위 12) - 간격 사다리의 흔적')
    for v, c in sorted(block.items(), key=lambda x: -x[1])[:12]:
        print(f'  {v:>4} px  {chr(35) * min(c, 50)} {c}')
    print()
    print('글줄 사이 공백 (<20px, 상위 8) - 대부분 leading이지 사다리가 아니다')
    for v, c in sorted(line.items(), key=lambda x: -x[1])[:8]:
        print(f'  {v:>4} px  {chr(35) * min(c, 50)} {c}')

    print()
    print('※ 세로 공백은 CSS margin이 아니라 잉크 사이의 빈 줄이다.')
    print('   글줄의 위아래 여유가 이미 먹고 들어가므로 실제 CSS 간격은 이보다 크다.')


main()