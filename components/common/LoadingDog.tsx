import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg'
import { TOKENS } from '@/constants/color-tokens'

/** 記事読み込み中・AI プラン生成中などで使う黄色 SVG 犬（バウンスアニメーション付き） */
export function LoadingDogSvg() {
  const bounce = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -6, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [bounce])

  const fill = TOKENS.brand.yellow
  const dark = TOKENS.text.primary

  return (
    <Animated.View style={{ transform: [{ translateY: bounce }] }}>
      <Svg width={64} height={48} viewBox="0 0 64 48" aria-hidden>
        <Ellipse cx="32" cy="28" rx="16" ry="10" fill={fill} />
        <Circle cx="46" cy="20" r="10" fill={fill} />
        <Ellipse cx="50" cy="12" rx="4" ry="6" fill={dark} transform="rotate(15 50 12)" />
        <Ellipse cx="42" cy="11" rx="3" ry="5" fill={dark} transform="rotate(-10 42 11)" />
        <Circle cx="49" cy="19" r="1.5" fill={dark} />
        <Ellipse cx="54" cy="22" rx="2" ry="1.5" fill={dark} />
        <Ellipse cx="14" cy="20" rx="3" ry="8" fill={dark} transform="rotate(-30 14 20)" />
        <Rect x="38" y="36" width="5" height="10" rx="2" fill={dark} />
        <Rect x="24" y="36" width="5" height="10" rx="2" fill={dark} />
        <Rect x="18" y="36" width="5" height="10" rx="2" fill={fill} />
        <Rect x="32" y="36" width="5" height="10" rx="2" fill={fill} />
      </Svg>
    </Animated.View>
  )
}
