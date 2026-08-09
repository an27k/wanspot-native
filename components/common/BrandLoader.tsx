import { useEffect } from 'react'
import { View } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'
import { useAppTheme } from '@/context/ThemeContext'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

const AnimatedG = Animated.createAnimatedComponent(G)

/**
 * wanspot 公式ローディング。
 *
 * 回るドットだけ。以前は中央に犬の顔を置いていたが、待ち時間の主役が絵になって
 * うるさく、小さいサイズでは潰れて読めなかった。
 *
 * Web（src/components/BrandLoader.tsx）と同じ絵柄・同じ速度。
 * 共有ページをアプリから来た人が見るので、片方だけ変えないこと。
 */

/** 先頭が大きく明るく、後ろほど小さく薄い。回すと尾を引いて見える */
const DOT_COUNT = 12
const RADIUS = 34
const CENTER = 50

const DOTS = Array.from({ length: DOT_COUNT }, (_, i) => {
  // 先頭を真上に置く。等間隔だと輪が閉じて動きが見えないので 1つ分空ける
  const angle = (-90 + i * (360 / (DOT_COUNT + 1))) * (Math.PI / 180)
  const t = i / (DOT_COUNT - 1)
  return {
    cx: CENTER + RADIUS * Math.cos(angle),
    cy: CENTER + RADIUS * Math.sin(angle),
    r: 7 - 4.5 * t,
    opacity: 1 - 0.88 * t,
  }
})

export function BrandLoader({ size = 96 }: { size?: number }) {
  const { colors } = useAppTheme()
  const rotate = useSharedValue(0)

  useEffect(() => {
    rotate.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(rotate)
    }
  }, [rotate])

  const dotsAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: CENTER },
      { translateY: CENTER },
      { rotate: `${rotate.value}deg` },
      { translateX: -CENTER },
      { translateY: -CENTER },
    ],
  }))

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="読み込み中">
        <AnimatedG animatedProps={dotsAnimatedProps}>
          {DOTS.map((dot, i) => (
            <Circle
              key={i}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={colors.primary}
              opacity={dot.opacity}
            />
          ))}
        </AnimatedG>
      </Svg>
    </View>
  )
}
