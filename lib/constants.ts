import { TOKENS } from '@/constants/color-tokens'

/** いいねハート（塗りつぶし・輪郭）。アプリ全体で赤に統一（地図ピンの MAP_LIKE_COLOR と同色） */
export const HEART_ICON = {
  /** いいね済み（塗り） */
  filled: '#FA3C4C',
  /** 未いいねの線 */
  strokeEmpty: '#c8c8c8',
} as const

export const COLORS = {
  primary: TOKENS.brand.primary,
  black: TOKENS.text.primary,
  bg: TOKENS.surface.paper,
  /** テキスト・バッジなどセマンティックな「いいね」表記用（ハートSVGよりやや濃くても可） */
  like: TOKENS.brand.gold,
  border: TOKENS.border.default,
  muted: TOKENS.text.secondary,
} as const
