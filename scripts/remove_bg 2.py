"""キャラクターPNGの不透明な白背景を透過に変換する。

エッジに繋がる「明るく低彩度」の領域だけを背景とみなしてアルファ0にする。
犬の白い体は黒い輪郭で囲まれているため、境界に到達せず保持される。
輪郭まわりのアンチエイリアス（明るいグレー）は軽くフェザーして縁を馴染ませる。
黒い輪郭（暗いピクセル）は消さない。
"""

import glob
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def process(path: str) -> None:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im).astype(np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    chroma = arr[..., :3].max(axis=2) - arr[..., :3].min(axis=2)

    light = (luma >= 140) & (chroma <= 45)

    border = np.zeros(light.shape, dtype=bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    seed = light & border

    lbl, _ = ndimage.label(light)
    seed_labels = np.unique(lbl[seed])
    seed_labels = seed_labels[seed_labels != 0]
    bg = np.isin(lbl, seed_labels)

    new_a = a.copy()
    new_a[bg] = 0

    # 輪郭まわりのアンチエイリアス（明るいグレー）のみ軽くフェザー。黒輪郭は保持。
    bg_dil = ndimage.binary_dilation(bg, iterations=2)
    ring = bg_dil & (~bg) & (luma >= 95) & (luma < 140)
    ramp = np.clip((luma - 95) / (140 - 95) * 255, 0, 255)
    new_a[ring] = np.minimum(new_a[ring], ramp[ring]).astype(np.int16)

    arr[..., 3] = new_a
    Image.fromarray(arr.astype("uint8"), "RGBA").save(path)
    removed = int(bg.sum())
    print(f"{path.split('/')[-1]}: bg_px={removed} ({removed / bg.size * 100:.1f}%)")


def main() -> None:
    targets = sys.argv[1:]
    if not targets:
        targets = sorted(glob.glob("assets/images/walk-alert/*.png")) + [
            "assets/images/loading-dog-run.png",
            "assets/images/wanspot-dog-character.png",
        ]
    for t in targets:
        process(t)


if __name__ == "__main__":
    main()
