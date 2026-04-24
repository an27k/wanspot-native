import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Circle, Ellipse, Rect, G } from 'react-native-svg'
import { TOKENS } from '@/constants/color-tokens'

/** 記事読み込み中・AI プラン生成中などで使う黄色 SVG 犬（バウンスアニメーション付き） */
const AnimatedG = Animated.createAnimatedComponent(G)

export function LoadingDogSvg() {
  const bodyBounce = useRef(new Animated.Value(0)).current
  const tailSwing = useRef(new Animated.Value(0)).current
  const frontLegSwing = useRef(new Animated.Value(0)).current
  const backLegSwing = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const createLoop = (value: Animated.Value, duration = 500) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )

    const loops = [
      createLoop(bodyBounce),
      createLoop(tailSwing),
      createLoop(frontLegSwing),
      createLoop(backLegSwing),
    ]

    // 後ろ足は逆位相
    backLegSwing.setValue(1)

    loops.forEach((loop) => loop.start())

    return () => {
      loops.forEach((loop) => loop.stop())
    }
  }, [bodyBounce, tailSwing, frontLegSwing, backLegSwing])

  const bodyTranslateY = bodyBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  })

  const tailRotation = tailSwing.interpolate({
    inputRange: [0, 1],
    outputRange: ['-15deg', '15deg'],
  })

  const frontLegRotation = frontLegSwing.interpolate({
    inputRange: [0, 1],
    outputRange: ['20deg', '-20deg'],
  })

  const backLegRotation = backLegSwing.interpolate({
    inputRange: [0, 1],
    outputRange: ['20deg', '-20deg'],
  })

  const fill = TOKENS.brand.yellow
  const dark = TOKENS.text.primary

  return (
    <Animated.View style={{ transform: [{ translateY: bodyTranslateY }] }}>
      <Svg width={64} height={48} viewBox="0 0 64 48" aria-hidden>
        <AnimatedG
          // react-native-svg の G は style ではなく transform/origin を使う
          // Animated の型が厳しいので最小限の cast で許容する
          transform={[{ rotate: backLegRotation as unknown as string }]}
          origin="21, 36"
        >
          <Rect x="18" y="36" width="5" height="10" rx="2" fill={fill} />
          <Rect x="24" y="36" width="5" height="10" rx="2" fill={dark} />
        </AnimatedG>

        <AnimatedG transform={[{ rotate: frontLegRotation as unknown as string }]} origin="37, 36">
          <Rect x="32" y="36" width="5" height="10" rx="2" fill={fill} />
          <Rect x="38" y="36" width="5" height="10" rx="2" fill={dark} />
        </AnimatedG>

        <AnimatedG transform={[{ rotate: tailRotation as unknown as string }]} origin="14, 20">
          <Ellipse cx="14" cy="20" rx="3" ry="8" fill={dark} transform="rotate(-30 14 20)" />
        </AnimatedG>

        <Ellipse cx="32" cy="28" rx="16" ry="10" fill={fill} />
        <Circle cx="46" cy="20" r="10" fill={fill} />
        <Ellipse cx="50" cy="12" rx="4" ry="6" fill={dark} transform="rotate(15 50 12)" />
        <Ellipse cx="42" cy="11" rx="3" ry="5" fill={dark} transform="rotate(-10 42 11)" />
        <Circle cx="49" cy="19" r="1.5" fill={dark} />
        <Ellipse cx="54" cy="22" rx="2" ry="1.5" fill={dark} />
      </Svg>
    </Animated.View>
  )
}
