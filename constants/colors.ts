import {
  DARK_TOKENS,
  LIGHT_TOKENS,
  type ColorTokens,
} from '@/constants/color-tokens'

export function createColors(tokens: ColorTokens) {
  return {
    /** ソリッド CTA・選択。文字色は必ず onPrimary と組み合わせる。 */
    primary: tokens.brand.primary,
    onPrimary: tokens.brand.onPrimary,
    pillText: tokens.brand.pillText,
    vessel: tokens.brand.vessel,
    accent: tokens.brand.accent,
    gold: tokens.brand.gold,
    tintWeak: tokens.brand.tintWeak,
    tintStrong: tokens.brand.tintStrong,

    /** @deprecated brand — primary へ */
    brand: tokens.brand.primary,
    /** @deprecated 選択チップ背景など */
    brandButton: tokens.brand.tintStrong,
    /** @deprecated 押下・強調 — primary の暗め */
    brandDark: tokens === DARK_TOKENS ? '#FF8A79' : '#E85A42',

    paper: tokens.surface.paper,
    surface: tokens.surface.primary,
    surfaceSecondary: tokens.surface.secondary,
    surfaceTertiary: tokens.surface.tertiary,
    surfaceRaised: tokens.surface.raised,
    surfaceAlt: tokens.surface.alt,
    input: tokens.surface.input,
    background: tokens.surface.paper,
    cardBg: tokens.surface.paper,
    mapMuted: tokens.surface.mapMuted,
    border: tokens.border.default,
    borderEmphasis: tokens.border.emphasis,
    borderSubtle: tokens.border.subtle,

    text: tokens.text.primary,
    textPrimary: tokens.text.primary,
    textSecondary: tokens.text.secondary,
    textMuted: tokens === DARK_TOKENS ? tokens.text.tertiary : tokens.text.secondary,
    textTertiary: tokens.text.tertiary,
    textLight: tokens.text.secondary,
    textMeta: tokens.text.meta,
    textHint: tokens.text.hint,
    textDisabled: tokens.text.disabled,
    textInverse: tokens.text.inverse,

    error: tokens.semantic.error,
    errorMutedBg: tokens.semantic.errorMutedBg,
    success: tokens.semantic.success,
    successGreen: tokens.semantic.success,
    successMutedBg: tokens.semantic.successMutedBg,
    warning: tokens.semantic.warning,

    categoryPark: tokens.category.park,
    categoryFood: tokens.category.food,
    categoryRetail: tokens.category.retail,
    categoryFallback: tokens.category.fallback,

    overlayScrim: tokens.overlay.scrim,
    overlaySubtle: tokens.overlay.subtle,
    shadow: tokens.shadow.default,

    dogPhotoPlaceholderBg: tokens === DARK_TOKENS ? '#302C28' : '#E8E8E8',
    dogPhotoPlaceholderPaw: tokens === DARK_TOKENS ? '#766F68' : '#A0A0A0',
    genderMale: tokens === DARK_TOKENS ? '#73A9E6' : '#4A90D9',
    genderFemale: tokens.semantic.error,
  } as const
}

export const lightColors = createColors(LIGHT_TOKENS)
export const darkColors = createColors(DARK_TOKENS)
export type AppColors = ReturnType<typeof createColors>

/** @deprecated テーマ非対応コードの互換用。新規コードは useAppTheme().colors を使う。 */
export const colors = lightColors
