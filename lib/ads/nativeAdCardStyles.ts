import { StyleSheet } from 'react-native'
import type { AppColors } from '@/constants/colors'

/**
 * ネイティブ広告カード共通（一覧・AIプラン用）
 * CTA グレー / 外側余白 16 / 16:9 メディア 等を統一する
 */
export const createNativeAdCardStyles = (colors: AppColors) => StyleSheet.create({
  adCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginVertical: 16,
    marginHorizontal: 16,
  },
  adLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  adLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  adInfo: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  /** 幅は `NativeAdStandardCard` 側で onLayout により 16:9 かつ min 120pt を満たす高さを付与 */
  mediaView: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
  },
  mediaRow: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
  },
  adContent: {
    padding: 12,
  },
  headline: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  headBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    marginRight: 8,
  },
  headBodyStack: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  advertiser: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
    marginRight: 8,
  },
  ctaButton: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderEmphasis,
  },
  ctaText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  starText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  placeholder: {
    height: 200,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderHint: {
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
})
