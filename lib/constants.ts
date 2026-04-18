import { TOKENS } from '@/constants/color-tokens'

/** いいねハート（塗りつぶし・輪郭。従来の赤より薄い黄色ゴールド系） */
export const HEART_ICON = {
  /** いいね済み（塗り） */
  filled: '#D4B85C',
  /** 未いいねの線 */
  strokeEmpty: '#c8c8c8',
} as const

export const COLORS = {
  primary: '#FFD84D',
  black: TOKENS.text.primary,
  bg: '#f7f6f3',
  /** テキスト・バッジなどセマンティックな「いいね」表記用（ハートSVGよりやや濃くても可） */
  like: '#C9A227',
  border: '#ebebeb',
  muted: '#aaa',
} as const
