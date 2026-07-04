import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SafeDogAvatar } from '@/components/dog/SafeDogAvatar'
import { TOKENS } from '@/constants/color-tokens'
import { GRADIENT_VLOG_LIQUID } from '@/constants/gradients'
import type { VlogRenderStage } from '@/lib/vlog/render-client'

const AVATAR_PX = 104
const RING_PX = 4
const ORBIT_PX = 168
const ORBIT_BORDER = 2.5
const PROGRESS_W = 200
const PROGRESS_H = 5
const MINT = GRADIENT_VLOG_LIQUID[0]

const STAGE_ORDER: VlogRenderStage[] = ['selecting', 'connecting', 'finishing']

const STAGE_LABELS: Record<VlogRenderStage, string> = {
  selecting: '画質解析',
  connecting: 'カット選定',
  finishing: 'レンダリング',
}

type Props = {
  stage: VlogRenderStage
  visible: boolean
  dogName?: string | null
  dogPhotoUrl?: string | null
  /** 0–1。未指定時は indeterminate */
  progress?: number | null
}

function OrbitSpark({ angleDeg, orbitSize }: { angleDeg: number; orbitSize: number }) {
  const spin = useSharedValue(0)

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false)
  }, [spin])

  const style = useAnimatedStyle(() => {
    const rad = ((angleDeg + spin.value * 360) * Math.PI) / 180
    const r = orbitSize / 2
    const cx = r + r * Math.cos(rad) - 8
    const cy = r + r * Math.sin(rad) - 8
    return { transform: [{ translateX: cx - orbitSize / 2 + 8 }, { translateY: cy - orbitSize / 2 + 8 }] }
  })

  return (
    <Animated.View pointerEvents="none" style={[styles.sparkWrap, { width: orbitSize, height: orbitSize }, style]}>
      <Text style={styles.sparkChar}>✦</Text>
    </Animated.View>
  )
}

function ProgressBar({ progress }: { progress?: number | null }) {
  const indeterminate = useSharedValue(0)

  useEffect(() => {
    if (progress != null && Number.isFinite(progress)) return
    indeterminate.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [indeterminate, progress])

  const fillStyle = useAnimatedStyle(() => {
    if (progress != null && Number.isFinite(progress)) {
      return { width: Math.max(PROGRESS_H, PROGRESS_W * Math.min(1, Math.max(0, progress))) }
    }
    const w = PROGRESS_W * (0.28 + indeterminate.value * 0.52)
    return { width: w }
  })

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFillWrap, fillStyle]}>
        <LinearGradient
          colors={[...GRADIENT_VLOG_LIQUID]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

function StageStepper({ stage }: { stage: VlogRenderStage }) {
  const stageIndex = STAGE_ORDER.indexOf(stage)
  return (
    <View style={styles.stepper}>
      {STAGE_ORDER.map((s, i) => {
        const done = i < stageIndex
        const active = i === stageIndex
        return (
          <View key={s} style={styles.stepItem}>
            {i > 0 ? <Text style={styles.stepSep}>—</Text> : null}
            {done ? (
              <Text style={[styles.stepLabel, styles.stepDone]}>✓{STAGE_LABELS[s]}</Text>
            ) : (
              <Text style={[styles.stepLabel, active ? styles.stepActive : styles.stepIdle]}>{STAGE_LABELS[s]}</Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

/**
 * 生成中 — 犬アバター中心の液体オービット演出（5a）。
 * ReviewAlbumTimeline から Modal 全画面で表示する想定。
 */
export function VlogGeneratingPanel({ stage, visible, dogName, dogPhotoUrl, progress }: Props) {
  const spin = useSharedValue(0)
  const glow = useSharedValue(0)

  useEffect(() => {
    if (!visible) return
    spin.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false)
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [spin, glow, visible])

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (0.45 + glow.value * 0.55),
    transform: [{ scale: 1 + glow.value * 0.08 }],
  }))

  if (!visible) return null

  const displayName = dogName?.trim() || '愛犬'
  const outerSize = AVATAR_PX + RING_PX * 2

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]}>
          <LinearGradient colors={[...GRADIENT_VLOG_LIQUID]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.orbitRing, { width: ORBIT_PX, height: ORBIT_PX, borderRadius: ORBIT_PX / 2 }, orbitStyle]}>
          <LinearGradient
            colors={[...GRADIENT_VLOG_LIQUID]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: ORBIT_PX / 2, padding: ORBIT_BORDER }]}
          >
            <View style={[styles.orbitInner, { borderRadius: ORBIT_PX / 2 - ORBIT_BORDER }]} />
          </LinearGradient>
        </Animated.View>

        <OrbitSpark angleDeg={-30} orbitSize={ORBIT_PX} />
        <OrbitSpark angleDeg={90} orbitSize={ORBIT_PX} />
        <OrbitSpark angleDeg={210} orbitSize={ORBIT_PX} />

        <LinearGradient
          colors={[...GRADIENT_VLOG_LIQUID]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.avatarRing, { width: outerSize, height: outerSize, borderRadius: outerSize / 2, padding: RING_PX }]}
        >
          <View style={[styles.avatarInner, { width: AVATAR_PX, height: AVATAR_PX, borderRadius: AVATAR_PX / 2 }]}>
            <SafeDogAvatar uri={dogPhotoUrl} size={AVATAR_PX} />
          </View>
        </LinearGradient>
      </View>

      <Text style={styles.title}>{displayName}の1日を編集中</Text>
      <StageStepper stage={stage} />
      <ProgressBar progress={progress} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: TOKENS.brand.vessel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  center: {
    width: ORBIT_PX + 40,
    height: ORBIT_PX + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: ORBIT_PX + 28,
    height: ORBIT_PX + 28,
    borderRadius: (ORBIT_PX + 28) / 2,
    overflow: 'hidden',
    shadowColor: GRADIENT_VLOG_LIQUID[1],
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  orbitRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitInner: {
    flex: 1,
    backgroundColor: TOKENS.brand.vessel,
  },
  sparkWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkChar: {
    fontSize: 14,
    color: GRADIENT_VLOG_LIQUID[2],
    textShadowColor: GRADIENT_VLOG_LIQUID[1],
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    overflow: 'hidden',
    backgroundColor: TOKENS.surface.primary,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: TOKENS.surface.primary,
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    maxWidth: 320,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepSep: { color: 'rgba(255,255,255,0.25)', marginHorizontal: 4, fontSize: 11 },
  stepLabel: { fontSize: 12, fontWeight: '700' },
  stepDone: { color: MINT, fontWeight: '800' },
  stepActive: { color: TOKENS.surface.primary, fontWeight: '800' },
  stepIdle: { color: 'rgba(255,255,255,0.4)' },
  progressTrack: {
    width: PROGRESS_W,
    height: PROGRESS_H,
    borderRadius: PROGRESS_H / 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFillWrap: {
    height: PROGRESS_H,
    borderRadius: PROGRESS_H / 2,
    overflow: 'hidden',
  },
})
