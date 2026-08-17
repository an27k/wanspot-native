"""Lift the character "black" (#000) to #313131 across all dog mascot PNGs.

- Achromatic pixels (black/gray/white ink) get a black-point lift:
  output = 49 + v*(255-49)/255  -> pure black(0)->49(#31), white(255)->255.
  This keeps anti-aliasing smooth and leaves white untouched.
- Colored pixels (e.g. the yellow palette) are left as-is.
Alpha is always preserved.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    "assets/images/loading-dog-run.png",
    "assets/images/wanspot-dog-character.png",
    "assets/images/walk-alert/dog-face-comfortable.png",
    "assets/images/walk-alert/dog-face-chilly.png",
    "assets/images/walk-alert/dog-face-numb.png",
    "assets/images/walk-alert/dog-face-sting.png",
    "assets/images/walk-alert/dog-face-caution.png",
    "assets/images/walk-alert/dog-face-danger.png",
    "assets/images/walk-alert/dog-face-stop.png",
]

BLACK_OUT = 49  # 0x31
CHROMA_TH = 30  # treat as achromatic ink when max-min <= this


def lift(v: int) -> int:
    return round(BLACK_OUT + v * (255 - BLACK_OUT) / 255)


# precompute lut for achromatic remap
LUT = [lift(i) for i in range(256)]


def process(path: Path) -> tuple[int, int]:
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    changed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            maxc = max(r, g, b)
            minc = min(r, g, b)
            if maxc - minc <= CHROMA_TH:
                v = (r + g + b) // 3
                nv = LUT[v]
                if nv != r or nv != g or nv != b:
                    px[x, y] = (nv, nv, nv, a)
                    changed += 1
    img.save(path)
    return changed, w * h


def main() -> None:
    for rel in FILES:
        p = ROOT / rel
        if not p.exists():
            print(f"SKIP (missing): {rel}")
            continue
        changed, total = process(p)
        print(f"OK {rel}: {changed}/{total} px lifted")


if __name__ == "__main__":
    main()
