import { useEffect, useId } from 'react'
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
const AnimatedPath = Animated.createAnimatedComponent(Path)
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

export function VlogLiquidGauge({ progress, animating = true, width = 248, height = 40 }: Props) {
  const uid = useId().replace(/:/g, '')
  const clipId = `liquidClip-${uid}`
  const gradId = `liquidGrad-${uid}`

  const clamped = Math.max(0, Math.min(1, progress))
  const bodyW = width - NUB_W - 6
  const innerX = 3 + PAD
  const innerY = BODY_Y + PAD
  const innerW = bodyW - PAD * 2
  const innerH = BODY_H - PAD * 2
  const innerBottom = innerY + innerH
  const fillTargetY = innerBottom - innerH * clamped

  const fillY = useSharedValue(innerBottom)
  const waveX = useSharedValue(0)
  const bubble1 = useSharedValue(0)
  const bubble2 = useSharedValue(0)

  useEffect(() => {
    fillY.value = withTiming(fillTargetY, { duration: 900, easing: Easing.out(Easing.cubic) })
  }, [fillTargetY, fillY])

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
    waveX.value = withRepeat(withTiming(innerW, { duration: 2200, easing: Easing.linear }), -1, false)
    bubble1.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true)
    bubble2.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }), -1, true)
    return () => {
      cancelAnimation(waveX)
      cancelAnimation(bubble1)
      cancelAnimation(bubble2)
    }
  }, [animating, innerW, waveX, bubble1, bubble2])

  const liquidProps = useAnimatedProps(() => ({
    y: fillY.value,
    height: Math.max(0, innerBottom - fillY.value),
  }))

  const waveGroupProps = useAnimatedProps(() => ({
    transform: [{ translateX: waveX.value - innerW }],
  }))

  const wavePathProps = useAnimatedProps(() => {
    const surface = fillY.value
    const w = innerW * 2
    const amp = 3
    return {
      d: `M 0 ${surface} Q ${w * 0.22} ${surface - amp} ${w * 0.5} ${surface} T ${w} ${surface} L ${w} ${innerBottom + 2} L 0 ${innerBottom + 2} Z`,
    }
  })

  const sheenProps = useAnimatedProps(() => ({
    y: fillY.value - 1.2,
    opacity: clamped > 0.06 ? 0.45 : 0,
  }))

  const bubble1Props = useAnimatedProps(() => {
    const liquidH = Math.max(0, innerBottom - fillY.value)
    return {
      cy: innerBottom - 3 - bubble1.value * liquidH * 0.55,
      opacity: liquidH > 4 ? 0.25 + bubble1.value * 0.4 : 0,
    }
  })

  const bubble2Props = useAnimatedProps(() => {
    const liquidH = Math.max(0, innerBottom - fillY.value)
    return {
      cy: innerBottom - 5 - bubble2.value * liquidH * 0.45,
      opacity: liquidH > 6 ? 0.2 + bubble2.value * 0.35 : 0,
    }
  })

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={innerX} y={innerY} width={innerW} height={innerH} rx={9} />
          </ClipPath>
          <SvgLinearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
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

        <G clipPath={`url(#${clipId})`}>
          <AnimatedRect animatedProps={liquidProps} x={innerX} width={innerW} fill={`url(#${gradId})`} />
          {clamped > 0.02 ? (
            <AnimatedG animatedProps={waveGroupProps}>
              <AnimatedPath animatedProps={wavePathProps} fill={`url(#${gradId})`} opacity={0.95} />
            </AnimatedG>
          ) : null}
          {clamped > 0.05 ? (
            <AnimatedRect
              animatedProps={sheenProps}
              x={innerX + 2}
              width={innerW - 4}
              height={2.4}
              rx={1.2}
              fill="#fff"
            />
          ) : null}
          {animating ? (
            <>
              <AnimatedCircle animatedProps={bubble1Props} cx={innerX + innerW * 0.32} r={1.8} fill="#fff" />
              <AnimatedCircle animatedProps={bubble2Props} cx={innerX + innerW * 0.68} r={1.3} fill="#fff" />
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
