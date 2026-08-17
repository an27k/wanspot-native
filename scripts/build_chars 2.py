"""生成した新キャラPNGを、アプリのアセットへ差し替える。

各画像について:
  1) 既存の remove_bg.process で白背景を透過化（在来ロジックを再利用）。
  2) アルファのバウンディングボックスでトリム → 余白を均等に付けて正方形化。
     （被写体をセンタリングし、丸トリミング/contain 表示で破綻しないようにする）

src は画像生成ツールが書き出すプロジェクト assets フォルダ、dst はリポジトリ内アセット。
ファイル名は据え置きなので、参照側（DogAlertFace / LoadingDogSvg 等）のコード変更は不要。
"""

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from remove_bg import process  # noqa: E402

PROJ = "/Users/atsu/.cursor/projects/Users-atsu-Desktop-wanspot-native/assets"

PAIRS = [
    ("face-numb.png", "assets/images/walk-alert/dog-face-numb.png"),
    ("face-sting.png", "assets/images/walk-alert/dog-face-sting.png"),
    ("face-chilly.png", "assets/images/walk-alert/dog-face-chilly.png"),
    ("face-comfortable.png", "assets/images/walk-alert/dog-face-comfortable.png"),
    ("face-caution.png", "assets/images/walk-alert/dog-face-caution.png"),
    ("face-danger.png", "assets/images/walk-alert/dog-face-danger.png"),
    ("face-stop.png", "assets/images/walk-alert/dog-face-stop.png"),
    ("dog-run.png", "assets/images/loading-dog-run.png"),
    ("dog-hero.png", "assets/images/wanspot-dog-character.png"),
]

# 正方形化の際に被写体周囲へ確保する余白（短辺に対する割合）
PAD_RATIO = 0.06


def square_center(path: str) -> None:
    im = Image.open(path).convert("RGBA")
    alpha = im.split()[3]
    bbox = alpha.getbbox()
    if bbox is None:
        return
    cropped = im.crop(bbox)
    w, h = cropped.size
    pad = int(round(max(w, h) * PAD_RATIO))
    side = max(w, h) + pad * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - w) // 2, (side - h) // 2), cropped)
    canvas.save(path)


def main() -> None:
    for src_name, dst in PAIRS:
        src = os.path.join(PROJ, src_name)
        if not os.path.exists(src):
            print(f"SKIP (missing): {src}")
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        Image.open(src).convert("RGBA").save(dst)
        process(dst)  # 白背景を透過化（in-place）
        square_center(dst)
        w, h = Image.open(dst).size
        print(f"OK {dst} ({w}x{h})")


if __name__ == "__main__":
    main()
