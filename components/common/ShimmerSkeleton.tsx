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
import { colors } from '@/constants/colors'

type Props = {
  style?: StyleProp<ViewStyle>
  /** false で shimmer 停止（必ず終端を持つ） */
  active?: boolean
}

/** スケルトン用 shimmer。active=false でアニメ停止。 */
export function ShimmerBlock({ style, active = true }: Props) {
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

  return (
    <View style={[styles.block, style]}>
      <Animated.View style={[styles.shimmer, shimmerStyle]} />
    </View>
  )
}

export function SearchResultSkeleton() {
  return (
    <View style={styles.card}>
      <ShimmerBlock style={styles.thumb} />
      <View style={styles.body}>
        <ShimmerBlock style={styles.lineWide} />
        <ShimmerBlock style={styles.lineMid} />
        <ShimmerBlock style={styles.lineShort} />
      </View>
    </View>
  )
}

export function ArticleListSkeleton() {
  return (
    <View style={styles.article}>
      <ShimmerBlock style={styles.artImg} />
      <View style={styles.artBody}>
        <ShimmerBlock style={styles.lineShort} />
        <ShimmerBlock style={styles.lineWide} />
        <ShimmerBlock style={styles.lineMid} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ece8e2',
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
  article: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  artImg: { width: '100%', height: 160 },
  artBody: { padding: 12, gap: 8 },
})
