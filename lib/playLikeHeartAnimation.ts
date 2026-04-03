import { Animated, Easing } from 'react-native'

const SCALE_PEAK = 1.4
const DURATION_UP_MS = 100
const DURATION_DOWN_MS = 100
const easeOut = Easing.out(Easing.ease)

/**
 * いいねタップ時: scale 1 → 1.4 → 1（計 ~200ms、ease-out）
 * 色は触らず transform のみ（useNativeDriver）
 */
export function playLikeHeartAnimation(scaleAnim: Animated.Value) {
  scaleAnim.stopAnimation()
  scaleAnim.setValue(1)
  Animated.sequence([
    Animated.timing(scaleAnim, {
      toValue: SCALE_PEAK,
      duration: DURATION_UP_MS,
      easing: easeOut,
      useNativeDriver: true,
    }),
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: DURATION_DOWN_MS,
      easing: easeOut,
      useNativeDriver: true,
    }),
  ]).start()
}
