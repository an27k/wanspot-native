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
const FLOOR = 0.18
const FILL_RANGE = 0.82
const BUBBLE_COUNT = 6

type Props = {
  count: number
  max?: number
  dogName?: string | null
  animating?: boolean
  onHelpPress?: () => void
}

function visualFill(count: number, max: number) {
  const ratio = Math.max(0, Math.min(count, max)) / Math.max(1, max)
  return FLOOR + FILL_RANGE * ratio
}

function buildWavePath(
  width: number,
  height: number,
  waterY: number,
  phase: number,
  amp: number,
  freq: number,
  ampMul: number
) {
  'worklet'
  const path = Skia.Path.Make()
  const segments = 56
  const effectiveAmp = amp * ampMul
  path.moveTo(0, height)
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width
    const y = waterY + Math.sin((x / width) * Math.PI * 2 * freq + phase) * effectiveAmp
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
  ampMul: number
) {
  'worklet'
  const path = Skia.Path.Make()
  const segments = 56
  const effectiveAmp = amp * ampMul
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width
    const y = waterY + Math.sin((x / width) * Math.PI * 2 * freq + phase) * effectiveAmp
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  return path
}

function useBubbleDerived(
  index: number,
  width: number,
  height: number,
  time: ReturnType<typeof useSharedValue<number>>,
  fillLevel: ReturnType<typeof useSharedValue<number>>
) {
  return useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP
    const waterY = height * (1 - fillLevel.value) + bob
    const liquidH = Math.max(0, height - waterY)
    if (liquidH < 12) {
      return { cx: 0, cy: 0, r: 0, opacity: 0 }
    }
    const seed = index * 1.73
    const cycle = (time.value * 0.12 + seed) % 1
    const cx = width * (0.12 + ((index * 0.14) % 0.76))
    const cy = waterY + liquidH * (1 - cycle) * 0.85
    const opacity = cycle > 0.85 ? 0 : 0.08 + (index % 3) * 0.04
    return { cx, cy, r: 1.2 + (index % 3) * 0.5, opacity }
  })
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
  const bubble = useBubbleDerived(index, width, height, time, fillLevel)
  const cx = useDerivedValue(() => bubble.value.cx)
  const cy = useDerivedValue(() => bubble.value.cy)
  const r = useDerivedValue(() => bubble.value.r)
  const opacity = useDerivedValue(() => bubble.value.opacity)
  return <Circle cx={cx} cy={cy} r={r} color="rgba(255,255,255,0.9)" opacity={opacity} />
}

export function VlogLiquidGauge({
  count,
  max = 5,
  dogName,
  animating = true,
  onHelpPress,
}: Props) {
  const width = Dimensions.get('window').width - 32
  const height = CARD_H
  const targetFill = visualFill(count, max)

  const fillLevel = useSharedValue(targetFill)
  const ampBoost = useSharedValue(1)
  const time = useSharedValue(0)

  const clipRRect = useMemo(
    () => Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), CARD_RADIUS, CARD_RADIUS),
    [width, height]
  )

  useEffect(() => {
    fillLevel.value = withTiming(targetFill, { duration: 700, easing: Easing.out(Easing.cubic) })
    ampBoost.value = withSequence(
      withTiming(1.4, { duration: 120 }),
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) })
    )
  }, [targetFill, ampBoost, fillLevel])

  useFrameCallback((frame) => {
    'worklet'
    if (!animating) return
    time.value = frame.timestamp / 1000
  }, animating)

  const backWavePath = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP
    const waterY = height * (1 - fillLevel.value) + bob
    const phase = time.value * Math.PI * 2 * 0.35 + Math.PI * 0.35
    return buildWavePath(width, height, waterY, phase, BACK_AMP, BACK_FREQ, ampBoost.value)
  })

  const frontWavePath = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP
    const waterY = height * (1 - fillLevel.value) + bob
    const phase = time.value * Math.PI * 2 * 0.5
    return buildWavePath(width, height, waterY, phase, FRONT_AMP, FRONT_FREQ, ampBoost.value)
  })

  const meniscusPath = useDerivedValue(() => {
    const bob = Math.sin(time.value * Math.PI * 2 * BOB_HZ) * BOB_AMP
    const waterY = height * (1 - fillLevel.value) + bob
    const phase = time.value * Math.PI * 2 * 0.5
    return buildMeniscusPath(width, waterY, phase, FRONT_AMP, FRONT_FREQ, ampBoost.value)
  })

  const title = dogName?.trim() ? `${dogName.trim()}のVLOG` : 'VLOG'

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
        </Group>
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
            {count}/{max}
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
