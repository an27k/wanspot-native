import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SafeRemoteImage } from '@/components/common/SafeRemoteImage'
import { TOKENS } from '@/constants/color-tokens'
import { GRADIENT_VLOG_LIQUID } from '@/constants/gradients'
import type { VisitPlate } from '@/lib/visits-memories'

type Props = {
  plate: VisitPlate
  dogName: string
  /** 既存 generateBusy ガードと連動（多重生成防止） */
  busy: boolean
  onCreate: () => void
  onDismiss: () => void
}

/** 液体パレットの色を単色の光の粒としてだけ使う（グラデ不使用、v8 restraint準拠） */
function AccentDot({ color, size, top, left, right, delayMs }: {
  color: string
  size: number
  top: number
  left?: number
  right?: number
  delayMs: number
}) {
  const glow = useSharedValue(0)

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 + delayMs, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500 + delayMs, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [glow, delayMs])

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + glow.value * 0.5,
    transform: [{ scale: 0.85 + glow.value * 0.3 }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, top, left, right, backgroundColor: color, shadowColor: color },
        style,
      ]}
    />
  )
}

/**
 * P6 — レビュー保存成功直後のワンタップVlog提案。
 * 「このレビューでVlogにする？」を即時提案し、1件だけを既存の生成パイプラインに流す。
 * 生成開始で親がこのカードを即時クローズする。
 */
export function VlogOneTapOffer({ plate, dogName, busy, onCreate, onDismiss }: Props) {
  const pulse = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [pulse])

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.025 }],
    shadowOpacity: 0.28 + pulse.value * 0.18,
  }))

  const cover = plate.memories[0]

  return (
    <Animated.View entering={FadeInDown.springify()} exiting={FadeOut.duration(180)} style={styles.card}>
      <AccentDot color={GRADIENT_VLOG_LIQUID[0]} size={8} top={14} left={16} delayMs={0} />
      <AccentDot color={GRADIENT_VLOG_LIQUID[1]} size={6} top={54} right={22} delayMs={300} />
      <AccentDot color={GRADIENT_VLOG_LIQUID[2]} size={7} top={92} left={30} delayMs={600} />

      <View style={styles.row}>
        <View style={styles.coverWrap}>
          {cover?.thumbSignedUrl ? (
            <SafeRemoteImage
              uri={cover.thumbSignedUrl}
              style={styles.cover}
              contentFit="cover"
              recyclingKey={cover.id}
              fallback={<View style={[styles.cover, styles.coverPlaceholder]} />}
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons name="film-outline" size={20} color="rgba(255,255,255,0.6)" />
            </View>
          )}
          <View style={styles.coverBadge}>
            <Ionicons name="sparkles" size={11} color="#fff" />
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.kicker}>ONE TAP VLOG</Text>
          <Text style={styles.title}>このレビューでVlogにする？</Text>
          <Text style={styles.sub} numberOfLines={1}>
            「{plate.spot.name}」の{dogName}のひとこまを1本に
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onDismiss}
          disabled={busy}
          hitSlop={8}
          style={styles.laterBtn}
          accessibilityRole="button"
          accessibilityLabel="あとでVlogにする"
        >
          <Text style={styles.laterTxt}>あとで</Text>
        </Pressable>
        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <Pressable
            onPress={onCreate}
            disabled={busy}
            style={[styles.cta, busy && styles.ctaDisabled]}
            accessibilityRole="button"
            accessibilityLabel="このレビューでいますぐVlogを作る"
          >
            <Ionicons name="film" size={16} color="#fff" />
            <Text style={styles.ctaTxt}>{busy ? '準備中...' : 'いますぐつくる'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 16,
    gap: 14,
    backgroundColor: TOKENS.brand.vessel,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: TOKENS.brand.vessel,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  dot: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coverWrap: { position: 'relative' },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.brand.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  copy: { flex: 1, gap: 2 },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)' },
  title: { fontSize: 16, fontWeight: '900', color: '#fff', lineHeight: 22 },
  sub: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14 },
  laterBtn: { paddingVertical: 10, paddingHorizontal: 8 },
  laterTxt: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.66)' },
  ctaWrap: {
    borderRadius: 999,
    shadowColor: TOKENS.brand.primary,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: TOKENS.brand.primary,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: '#fff' },
})
