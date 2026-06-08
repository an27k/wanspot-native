import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Props = {
  progress: number
  animating?: boolean
  width?: number
  height?: number
}

const BODY_H = 24
const BODY_Y = 8
const NUB_W = 7
const NUB_H = 12
const PAD = 3

function wavePath(w: number, surfaceY: number): string {
  const mid = w * 0.5
  return `M 0 ${surfaceY} Q ${w * 0.25} ${surfaceY - 2.2} ${mid} ${surfaceY} T ${w} ${surfaceY} L ${w} ${BODY_H + PAD} L 0 ${BODY_H + PAD} Z`
}

export function VlogLiquidGauge({ progress, animating = true, width = 248, height = 40 }: Props) {
  const clamped = Math.max(0, Math.min(1, progress))
  const bodyW = width - NUB_W - 6
  const innerW = bodyW - PAD * 2
  const innerH = BODY_H - PAD * 2
  const fillTarget = PAD + innerH * (1 - clamped)

  const fillY = useSharedValue(PAD + innerH)
  const waveX = useSharedValue(0)
  const bubble1 = useSharedValue(0)
  const bubble2 = useSharedValue(0)

  useEffect(() => {
    fillY.value = withTiming(fillTarget, { duration: 900, easing: Easing.out(Easing.cubic) })
  }, [fillTarget, fillY])

  useEffect(() => {
    if (!animating) {
      cancelAnimation(waveX)
      cancelAnimation(bubble1)
      cancelAnimation(bubble2)
      waveX.value = 0
      bubble1.value = 0
      bubble2.value = 0
      return
    }
    waveX.value = withRepeat(withTiming(innerW, { duration: 2400, easing: Easing.linear }), -1, false)
    bubble1.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true)
    bubble2.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true)
    return () => {
      cancelAnimation(waveX)
      cancelAnimation(bubble1)
      cancelAnimation(bubble2)
    }
  }, [animating, innerW, waveX, bubble1, bubble2])

  const liquidProps = useAnimatedProps(() => ({
    y: fillY.value,
    height: Math.max(0, BODY_H + PAD - fillY.value),
  }))

  const waveGroupProps = useAnimatedProps(() => ({
    transform: [{ translateX: waveX.value - innerW * 0.5 }],
  }))

  const bubble1Props = useAnimatedProps(() => ({
    cy: BODY_Y + innerH - 4 - bubble1.value * (innerH * clamped * 0.6),
    opacity: 0.25 + bubble1.value * 0.35,
  }))

  const bubble2Props = useAnimatedProps(() => ({
    cy: BODY_Y + innerH - 6 - bubble2.value * (innerH * clamped * 0.5),
    opacity: 0.2 + bubble2.value * 0.3,
  }))

  const surfaceY = Math.max(PAD, fillTarget - BODY_Y)

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <ClipPath id="liquidClip">
            <Rect x={3 + PAD} y={BODY_Y + PAD} width={innerW} height={innerH} rx={9} />
          </ClipPath>
          <SvgLinearGradient id="liquidGrad" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFC247" />
            <Stop offset="0.5" stopColor="#F4A02A" />
            <Stop offset="1" stopColor="#FF6F43" />
          </SvgLinearGradient>
        </Defs>

        <Rect
          x={3}
          y={BODY_Y}
          width={bodyW}
          height={BODY_H}
          rx={BODY_H / 2}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
          fill="rgba(255,255,255,0.08)"
        />
        <Rect
          x={bodyW + 4}
          y={BODY_Y + (BODY_H - NUB_H) / 2}
          width={NUB_W}
          height={NUB_H}
          rx={2.5}
          fill="rgba(255,255,255,0.2)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1.5}
        />

        <G clipPath="url(#liquidClip)">
          <AnimatedRect
            animatedProps={liquidProps}
            x={3 + PAD}
            width={innerW}
            fill="url(#liquidGrad)"
          />
          {clamped > 0.04 ? (
            <AnimatedG animatedProps={waveGroupProps}>
              <Path d={wavePath(innerW * 2, surfaceY)} fill="url(#liquidGrad)" opacity={0.92} />
            </AnimatedG>
          ) : null}
          {clamped > 0.08 && animating ? (
            <>
              <AnimatedCircle animatedProps={bubble1Props} cx={innerW * 0.35 + 3 + PAD} r={1.6} fill="#fff" />
              <AnimatedCircle animatedProps={bubble2Props} cx={innerW * 0.62 + 3 + PAD} r={1.2} fill="#fff" />
            </>
          ) : null}
        </G>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
})
