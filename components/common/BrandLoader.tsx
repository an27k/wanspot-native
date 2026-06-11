import { useEffect } from 'react'
import { View } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import { colors } from '@/constants/colors'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import {
  BRAND_LOADER_DOTS,
  BRAND_LOADER_EAR_PATH,
  BRAND_LOADER_FACE_PATH,
  BRAND_LOADER_OUTLINE_PATH,
  BRAND_LOADER_ROTATE_ORIGIN,
  BRAND_LOADER_TR,
} from '@/components/common/brand-loader-paths'

const AnimatedG = Animated.createAnimatedComponent(G)

/**
 * wanspot 公式ローディング（wanspot_loading_traced.svg 準拠）。
 * SMIL は使わず Reanimated でドット回転＋犬浮遊を駆動する。
 */
export function BrandLoader({ size = 96 }: { size?: number }) {
  const rotate = useSharedValue(0)
  const floatY = useSharedValue(0)
  const { x: ox, y: oy } = BRAND_LOADER_ROTATE_ORIGIN

  useEffect(() => {
    rotate.value = withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), -1, false)
    floatY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 1300, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    )
    return () => {
      cancelAnimation(rotate)
      cancelAnimation(floatY)
    }
  }, [rotate, floatY])

  const dotsAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: ox },
      { translateY: oy },
      { rotate: `${rotate.value}deg` },
      { translateX: -ox },
      { translateY: -oy },
    ],
  }))

  const dogAnimatedProps = useAnimatedProps(() => ({
    transform: [{ translateY: floatY.value }],
  }))

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 607 607" accessibilityLabel="読み込み中">
        <AnimatedG animatedProps={dotsAnimatedProps}>
          {BRAND_LOADER_DOTS.map((dot) => (
            <Circle
              key={`${dot.cx}-${dot.cy}`}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={colors.primary}
              opacity={dot.opacity}
            />
          ))}
        </AnimatedG>

        <AnimatedG animatedProps={dogAnimatedProps}>
          <G transform={BRAND_LOADER_TR} fill="#FB6B53">
            <Path d={BRAND_LOADER_EAR_PATH} />
          </G>
          <G transform={BRAND_LOADER_TR} fill="#FFFFFF">
            <Path d={BRAND_LOADER_FACE_PATH} />
          </G>
          <G transform={BRAND_LOADER_TR} fill="#1A1A1A">
            <Path d={BRAND_LOADER_OUTLINE_PATH} />
          </G>
        </AnimatedG>
      </Svg>
    </View>
  )
}
