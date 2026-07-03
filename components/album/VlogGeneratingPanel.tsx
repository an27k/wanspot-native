import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SafeDogAvatar } from '@/components/dog/SafeDogAvatar'
import type { VlogRenderStage } from '@/lib/vlog/render-client'
import { VLOG_GENERATION_COPY } from '@/lib/vlog/render-client'

const MINT = '#55E0B4'
const PURPLE = '#7F5CFF'
const PINK = '#F27AD7'

const STAGE_ORDER: VlogRenderStage[] = ['selecting', 'connecting', 'finishing']

type Props = {
  stage: VlogRenderStage
  visible: boolean
  dogName?: string | null
  dogPhotoUrl?: string | null
}

/** アバターの周りを公転する光の粒 */
function Orbit({
  size,
  durationMs,
  reverse,
  dots,
}: {
  size: number
  durationMs: number
  reverse?: boolean
  dots: { color: string; dotSize: number; angleDeg: number }[]
}) {
  const spin = useSharedValue(0)

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false)
  }, [spin, durationMs])

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(reverse ? -1 : 1) * spin.value * 360}deg` }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <View style={[styles.orbitTrack, { borderRadius: size / 2 }]} />
      {dots.map((dot, i) => {
        const rad = (dot.angleDeg * Math.PI) / 180
        const r = size / 2
        const x = r + r * Math.cos(rad) - dot.dotSize / 2
        const y = r + r * Math.sin(rad) - dot.dotSize / 2
        return (
          <View
            key={i}
            style={[
              styles.orbitDot,
              {
                left: x,
                top: y,
                width: dot.dotSize,
                height: dot.dotSize,
                borderRadius: dot.dotSize / 2,
                backgroundColor: dot.color,
                shadowColor: dot.color,
              },
            ]}
          />
        )
      })}
    </Animated.View>
  )
}

/** 下からふわっと立ちのぼるスパーク */
function RisingSpark({ delayMs, x, color }: { delayMs: number; x: number; color: string }) {
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false)
    )
  }, [t, delayMs])

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.12 ? t.value / 0.12 : 1 - t.value,
    transform: [{ translateY: -t.value * 92 }, { scale: 0.6 + t.value * 0.5 }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.spark, { left: x, backgroundColor: color, shadowColor: color }, style]}
    />
  )
}

/**
 * 生成中 — 犬のアバターを主役に、グラデーションの光輪と粒子が回る待機演出。
 * 「未来の犬専用Vlogをつくっている」感を伝える。
 */
export function VlogGeneratingPanel({ stage, visible, dogName, dogPhotoUrl }: Props) {
  const [dots, setDots] = useState('')
  const pulse = useSharedValue(0)

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '…'))
    }, 520)
    return () => clearInterval(id)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [pulse, visible])

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.1 }],
  }))
  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.035 }],
  }))

  if (!visible) return null

  const stageIndex = STAGE_ORDER.indexOf(stage)
  const displayName = dogName?.trim() || '愛犬'

  return (
    <Animated.View entering={FadeInDown.duration(240)} style={styles.card}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(85,224,180,0.2)', 'rgba(127,92,255,0.22)', 'rgba(22,18,34,0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.stage}>
        <RisingSpark delayMs={0} x={34} color={MINT} />
        <RisingSpark delayMs={900} x={96} color={PINK} />
        <RisingSpark delayMs={1700} x={230} color={PURPLE} />
        <RisingSpark delayMs={600} x={286} color={MINT} />

        <Animated.View pointerEvents="none" style={[styles.avatarGlow, glowStyle]}>
          <LinearGradient
            colors={['rgba(85,224,180,0.7)', 'rgba(127,92,255,0.65)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Orbit
          size={124}
          durationMs={7200}
          dots={[
            { color: MINT, dotSize: 8, angleDeg: -90 },
            { color: PINK, dotSize: 5, angleDeg: 140 },
          ]}
        />
        <Orbit
          size={96}
          durationMs={4800}
          reverse
          dots={[
            { color: PURPLE, dotSize: 6, angleDeg: 0 },
            { color: '#fff', dotSize: 4, angleDeg: 200 },
          ]}
        />

        <Animated.View style={[styles.avatarWrap, avatarStyle]}>
          <SafeDogAvatar uri={dogPhotoUrl} size={26} />
        </Animated.View>
      </View>

      <Text style={styles.title}>
        {displayName}の専用Vlogを生成中{dots}
      </Text>
      <Text style={styles.copy}>{VLOG_GENERATION_COPY[stage]}</Text>

      <View style={styles.stageDots}>
        {STAGE_ORDER.map((s, i) => (
          <View key={s} style={[styles.stageDot, i <= stageIndex && styles.stageDotOn]} />
        ))}
        <Ionicons name="sparkles" size={12} color={MINT} style={{ marginLeft: 4 }} />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    gap: 6,
    borderRadius: 26,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: '#161222',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: PURPLE,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  stage: {
    width: '100%',
    height: 138,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  orbitTrack: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  orbitDot: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarGlow: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    overflow: 'hidden',
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  spark: {
    position: 'absolute',
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  copy: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.66)',
  },
  stageDots: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageDot: {
    width: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  stageDotOn: { backgroundColor: MINT },
})
