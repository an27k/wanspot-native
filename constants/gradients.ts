/** Signature gradient — ピンク→コーラル→ピーチゴールド（~120deg） */
export const GRADIENT_SUNSET = ['#FF5E8A', '#FF7E5F', '#FEB47B'] as const

export type GradientVariant = 'sunset'

export const GRADIENTS: Record<GradientVariant, readonly [string, string, string]> = {
  sunset: GRADIENT_SUNSET,
}

/** expo-linear-gradient 用 start/end（CSS 120deg 近似） */
export const GRADIENT_SUNSET_POINTS = {
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0.65 },
} as const
