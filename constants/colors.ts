import { TOKENS } from '@/constants/color-tokens'

export const colors = {
  /** 深めコーラル（白文字OK）— ソリッド CTA・選択 */
  primary: TOKENS.brand.primary,
  accent: TOKENS.brand.accent,
  gold: TOKENS.brand.gold,
  tintWeak: TOKENS.brand.tintWeak,
  tintStrong: TOKENS.brand.tintStrong,

  /** @deprecated brand — primary へ */
  brand: TOKENS.brand.primary,
  /** @deprecated 選択チップ背景など */
  brandButton: TOKENS.brand.tintStrong,
  /** @deprecated 押下・強調 — primary の暗め */
  brandDark: '#E85A42',

  paper: TOKENS.surface.paper,
  surface: TOKENS.surface.primary,
  background: TOKENS.surface.paper,
  cardBg: TOKENS.surface.paper,
  border: TOKENS.border.default,

  text: TOKENS.text.primary,
  textPrimary: TOKENS.text.primary,
  textSecondary: TOKENS.text.secondary,
  textMuted: TOKENS.text.secondary,
  textLight: TOKENS.text.secondary,

  error: TOKENS.semantic.error,
  success: TOKENS.semantic.success,
  successGreen: TOKENS.semantic.success,
  successMutedBg: TOKENS.semantic.successMutedBg,

  dogPhotoPlaceholderBg: '#E8E8E8',
  dogPhotoPlaceholderPaw: '#A0A0A0',
  genderMale: '#4A90D9',
  genderFemale: '#E84335',
} as const
