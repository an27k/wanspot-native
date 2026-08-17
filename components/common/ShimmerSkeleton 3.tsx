import { useEffect } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import type { AppColors } from '@/constants/colors'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Variant = 'light' | 'dark'

type Props = {
  style?: StyleProp<ViewStyle>
  /** false で shimmer 停止（必ず終端を持つ） */
  active?: boolean
  variant?: Variant
}

/** スケルトン用 shimmer。active=false でアニメ停止。 */
export function ShimmerBlock({ style, active = true, variant = 'light' }: Props) {
  const styles = useThemedStyles(createStyles)
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress)
      progress.value = 0
      return
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
    return () => cancelAnimation(progress)
  }, [active, progress])

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.35 + progress.value * 0.45 : 0.25,
  }))

  const isDark = variant === 'dark'

  return (
    <View style={[styles.block, isDark && styles.blockDark, style]}>
      <Animated.View style={[styles.shimmer, isDark && styles.shimmerDark, shimmerStyle]} />
    </View>
  )
}

export function SearchResultSkeleton({ variant = 'light' }: { variant?: Variant } = {}) {
  const styles = useThemedStyles(createStyles)
  const isDark = variant === 'dark'
  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <ShimmerBlock variant={variant} style={styles.thumb} />
      <View style={styles.body}>
        <ShimmerBlock variant={variant} style={styles.lineWide} />
        <ShimmerBlock variant={variant} style={styles.lineMid} />
        <ShimmerBlock variant={variant} style={styles.lineShort} />
      </View>
    </View>
  )
}

export function ArticleListSkeleton({ variant = 'light' }: { variant?: Variant } = {}) {
  const styles = useThemedStyles(createStyles)
  const isDark = variant === 'dark'
  return (
    <View style={[styles.article, isDark && styles.articleDark]}>
      <ShimmerBlock variant={variant} style={styles.artImg} />
      <View style={styles.artBody}>
        <ShimmerBlock variant={variant} style={styles.lineShort} />
        <ShimmerBlock variant={variant} style={styles.lineWide} />
        <ShimmerBlock variant={variant} style={styles.lineMid} />
      </View>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    overflow: 'hidden',
  },
  blockDark: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.borderEmphasis,
  },
  shimmerDark: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  thumb: { width: 88, height: 88, borderRadius: 10 },
  body: { flex: 1, gap: 8, justifyContent: 'center' },
  lineWide: { height: 14, borderRadius: 6, width: '92%' },
  lineMid: { height: 12, borderRadius: 6, width: '72%' },
  lineShort: { height: 12, borderRadius: 6, width: '40%' },
  cardDark: {
    backgroundColor: GOOGLE_HOME.panelBg,
    borderRadius: GOOGLE_HOME.radiusPanel,
    marginBottom: GOOGLE_HOME.gapCard,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.panelBorder,
  },
  article: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  articleDark: {
    marginHorizontal: 0,
    marginBottom: GOOGLE_HOME.gapCard,
    borderRadius: GOOGLE_HOME.radiusPanel,
    backgroundColor: GOOGLE_HOME.panelBg,
    borderColor: GOOGLE_HOME.panelBorder,
  },
  artImg: { width: '100%', height: 160 },
  artBody: { padding: 12, gap: 8 },
})
