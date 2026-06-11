import { useEffect, useMemo } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia'
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { VlogClipboardIcon } from '@/components/icons/VlogClipboardIcon'
import { colors } from '@/constants/colors'
import { GRADIENT_SUNSET } from '@/constants/gradients'

const CARD_H = 168
const CARD_RADIUS = 20
const BOB_HZ = 0.7
const BOB_AMP = 1.6
const FRONT_AMP = 5.5
const FRONT_FREQ = 1.0
const BACK_AMP = 4.5
const BACK_FREQ = 1.4
const WEAVE_AMP = 2.2
const WEAVE_FREQ = 2.8
const FLOOR = 0.18
const FILL_RANGE = 0.82
const BUBBLE_COUNT = 6
const SPARKLE_COUNT = 10

export type VlogGaugeMode = 'collecting' | 'nearUnlock' | 'unlocked' | 'generating'

type Props = {
  fillRatio: number
  displayCount: number
  max?: number
  dogName?: string | null
  animating?: boolean
  gaugeMode?: VlogGaugeMode
  onHelpPress?: () => void
}

function clampFill(ratio: number) {
  return FLOOR + FILL_RANGE * Math.max(0, Math.min(1, ratio))
}

function buildWavePath(
  width: number,
  height: number,
  waterY: number,
  phase: number,
  amp: number,
  freq: number,
  ampMul: number,
  weave = 0
) {
  'worklet'
  const path = Skia.Path.Make()
  const segments = 56
  const effectiveAmp = amp * ampMul
  path.moveTo(0, height)
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width
    const base = Math.sin((x / width) * Math.PI * 2 * freq + phase) * effectiveAmp
    const weaveLayer =
      weave > 0 ? Math.sin((x / width) * Math.PI * 2 * WEAVE_FREQ + phase * 1.6) * WEAVE_AMP * weave : 0
    const y = waterY + base + weaveLayer
    if (i === 0) path.lineTo(0, y)
    else path.lineTo(x, y)
  }
  path.lineTo(width, height)
  path.close()
  return path
}

function buildMeniscusPath(
  width: number,
  waterY: number,
  phase: number,
  amp: number,
  freq: number,
  ampMul: number,
  weave = 0
) {
  'worklet'
  const path = Skia.Path.Make()
  const segments = 56
  const effectiveAmp = amp * ampMul
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width
    const base = Math.sin((x / width) * Math.PI * 2 * freq + phase) * effectiveAmp
    const weaveLayer =
      weave > 0 ? Math.sin((x / width) * Math.PI * 2 * WEAVE_FREQ + phase * 1.6) * WEAVE_AMP * weave : 0
    const y = waterY + base + weaveLayer
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  return path
}

function LiquidBubble({
  index,
  width,
  height,
  time,
  fillLevel,
}: {
  index: number
  width: number
  height: number
  time: ReturnType<typeof useSharedValue<number>>
  fillLevel: ReturnType<typeof useSharedValue<number>>
}) {
  const cx = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP
    const waterY = height * (1 - fillLevel.value) + bob
    const liquidH = Math.max(0, height - waterY)
    if (liquidH < 12) return 0
    return width * (0.12 + ((index * 0.14) % 0.76))
  })
  const cy = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP
    const waterY = height * (1 - fillLevel.value) + bob
    const liquidH = Math.max(0, height - waterY)
    if (liquidH < 12) return 0
    const seed = index * 1.73
    const cycle = (time.value * 0.12 + seed) % 1
    return waterY + liquidH * (1 - cycle) * 0.85
  })
  const r = useDerivedValue(() => 1.2 + (index % 3) * 0.5)
  const opacity = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP
    const waterY = height * (1 - fillLevel.value) + bob
    const liquidH = Math.max(0, height - waterY)
    if (liquidH < 12) return 0
    const seed = index * 1.73
    const cycle = (time.value * 0.12 + seed) % 1
    return cycle > 0.85 ? 0 : 0.08 + (index % 3) * 0.04
  })
  return <Circle cx={cx} cy={cy} r={r} color="rgba(255,255,255,0.9)" opacity={opacity} />
}

function SurfaceSparkle({
  index,
  width,
  height,
  time,
  fillLevel,
}: {
  index: number
  width: number
  height: number
  time: ReturnType<typeof useSharedValue<number>>
  fillLevel: ReturnType<typeof useSharedValue<number>>
}) {
  const cx = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP * 0.35
    const waterY = height * (1 - fillLevel.value) + bob
    const drift = (time.value * (0.04 + index * 0.008) + index * 0.31) % 1
    return width * (0.08 + drift * 0.84)
  })
  const cy = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP * 0.35
    const waterY = height * (1 - fillLevel.value) + bob
    return waterY + Math.sin(time.value * 2 + index) * 1.2 - 2
  })
  const opacity = useDerivedValue(() => 0.25 + ((index % 4) + 1) * 0.12)
  return <Circle cx={cx} cy={cy} r={1.1} color="#fff" opacity={opacity} />
}

export function VlogLiquidGauge({
  fillRatio,
  displayCount,
  max = 5,
  dogName,
  animating = true,
  gaugeMode = 'collecting',
  onHelpPress,
}: Props) {
  const width = Dimensions.get('window').width - 32
  const height = CARD_H
  const targetFill = clampFill(fillRatio)

  const fillLevel = useSharedValue(targetFill)
  const ampBoost = useSharedValue(1)
  const bobDamp = useSharedValue(1)
  const weaveMix = useSharedValue(0)
  const edgeGlow = useSharedValue(0)
  const time = useSharedValue(0)
  const animatingSv = useSharedValue(animating ? 1 : 0)

  useEffect(() => {
    animatingSv.value = animating ? 1 : 0
  }, [animating, animatingSv])

  useEffect(() => {
    weaveMix.value = withTiming(gaugeMode === 'generating' ? 1 : 0, { duration: 400 })
    edgeGlow.value = withTiming(gaugeMode === 'nearUnlock' ? 1 : 0, { duration: 500 })
    if (gaugeMode === 'unlocked') {
      bobDamp.value = withSequence(
        withTiming(0.15, { duration: 350, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })
      )
    } else {
      bobDamp.value = withTiming(1, { duration: 300 })
    }
  }, [gaugeMode, weaveMix, edgeGlow, bobDamp])

  const clipRRect = useMemo(
    () => Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), CARD_RADIUS, CARD_RADIUS),
    [width, height]
  )

  useEffect(() => {
    fillLevel.value = withTiming(targetFill, { duration: 700, easing: Easing.out(Easing.cubic) })
    ampBoost.value = withSequence(
      withTiming(gaugeMode === 'nearUnlock' ? 1.55 : 1.4, { duration: 120 }),
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) })
    )
  }, [targetFill, ampBoost, fillLevel, gaugeMode])

  useFrameCallback((frame) => {
    'worklet'
    if (animatingSv.value === 0) return
    time.value = frame.timestamp / 1000
  })

  const backWavePath = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP * bobDamp.value
    const waterY = height * (1 - fillLevel.value) + bob
    const phase = time.value * Math.PI * 2 * 0.35 + Math.PI * 0.35
    return buildWavePath(width, height, waterY, phase, BACK_AMP, BACK_FREQ, ampBoost.value, weaveMix.value)
  })

  const frontWavePath = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP * bobDamp.value
    const waterY = height * (1 - fillLevel.value) + bob
    const phase = time.value * Math.PI * 2 * 0.5
    return buildWavePath(width, height, waterY, phase, FRONT_AMP, FRONT_FREQ, ampBoost.value, weaveMix.value)
  })

  const meniscusPath = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP * bobDamp.value
    const waterY = height * (1 - fillLevel.value) + bob
    const phase = time.value * Math.PI * 2 * 0.5
    return buildMeniscusPath(width, waterY, phase, FRONT_AMP, FRONT_FREQ, ampBoost.value, weaveMix.value)
  })

  const title = dogName?.trim() ? `${dogName.trim()}のVLOG` : 'VLOG'
  const showSparkles = gaugeMode === 'unlocked' || gaugeMode === 'nearUnlock'

  return (
    <View style={[styles.card, { width, height, borderRadius: CARD_RADIUS }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group clip={clipRRect}>
          <Rect x={0} y={0} width={width} height={height} color={colors.vessel} />
          <Path path={backWavePath} color="rgba(255,110,120,0.30)" />
          <Path path={frontWavePath}>
            <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[...GRADIENT_SUNSET]} />
          </Path>
          <Path path={meniscusPath} style="stroke" strokeWidth={1.5} color="rgba(255,255,255,0.45)" />
          {Array.from({ length: BUBBLE_COUNT }, (_, i) => (
            <LiquidBubble key={i} index={i} width={width} height={height} time={time} fillLevel={fillLevel} />
          ))}
          {showSparkles
            ? Array.from({ length: SPARKLE_COUNT }, (_, i) => (
                <SurfaceSparkle key={`s-${i}`} index={i} width={width} height={height} time={time} fillLevel={fillLevel} />
              ))
            : null}
        </Group>
        {gaugeMode === 'nearUnlock' ? (
          <Rect
            x={1}
            y={1}
            width={width - 2}
            height={height - 2}
            color="rgba(255,220,180,0.22)"
            style="stroke"
            strokeWidth={2}
          />
        ) : null}
      </Canvas>

      <View style={styles.topScrim} pointerEvents="none" />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.overlayLeft}>
          <VlogClipboardIcon size={20} color="#fff" />
          <Text style={styles.overlayTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.overlayRight}>
          {onHelpPress ? (
            <Pressable onPress={onHelpPress} hitSlop={10} style={styles.helpBtn}>
              <Text style={styles.helpTxt}>?</Text>
            </Pressable>
          ) : null}
          <Text style={styles.fraction}>
            {displayCount}/{max}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.vessel,
  },
  topScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 56,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  overlayLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  overlayTitle: { fontSize: 16, fontWeight: '800', color: '#fff', flexShrink: 1 },
  overlayRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fraction: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.95)' },
  helpBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTxt: { fontSize: 14, fontWeight: '800', color: '#fff', lineHeight: 16 },
})
