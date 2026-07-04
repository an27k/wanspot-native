/** Signature gradient — ピンク→コーラル→ピーチゴールド（~120deg） */
export const GRADIENT_SUNSET = ['#FF5E8A', '#FF7E5F', '#FEB47B'] as const

/** VLOG 液体専用 — ミントグリーン→ラベンダー→ピンク（パレット右上のグラデを参考） */
export const GRADIENT_VLOG_LIQUID = ['#3FDCA6', '#9D8BF2', '#EC6FB0'] as const

/** スポット詳細 Instagram アイコン — ゴールド→ピンク→ラベンダー */
export const GRADIENT_INSTAGRAM = ['#F5B54A', '#EC6FB0', '#9D8BF2'] as const

export type GradientVariant = 'sunset' | 'vlog'

export const GRADIENTS: Record<GradientVariant, readonly [string, string, string]> = {
  sunset: GRADIENT_SUNSET,
  vlog: GRADIENT_VLOG_LIQUID,
}

/** expo-linear-gradient 用 start/end（CSS 120deg 近似） */
export const GRADIENT_SUNSET_POINTS = {
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0.65 },
} as const
