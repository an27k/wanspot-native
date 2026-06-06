/**
 * 写ルンです風 ColorMatrix（4×5 row-major）。
 * Skia ColorFilter.MakeMatrix の offset 列は 0–255 スケール。
 * 設計値 0.085（0–1 正規化）→ ×255 で適用。実機で色が薄い場合は 0–1 のまま試す。
 */
const OFFSET = 0.065 * 255

export const UTSURUN_COLOR_MATRIX: number[] = [
  0.7608, 0.1255, 0.0114, 0, OFFSET,
  0.0384, 0.8272, 0.0114, 0, OFFSET,
  0.0384, 0.1255, 0.6444, 0, OFFSET,
  0, 0, 0, 1, 0,
]

/** 実機確認用: offset を 0–1 のまま使うバリアント */
export const UTSURUN_COLOR_MATRIX_OFFSET_NORMALIZED: number[] = [
  0.7608, 0.1255, 0.0114, 0, 0.085,
  0.0384, 0.8272, 0.0114, 0, 0.085,
  0.0384, 0.1255, 0.6444, 0, 0.085,
  0, 0, 0, 1, 0,
]
