import { Animated } from 'react-native'

/** いいねタップ時: spring で 0.7 → 1.2 → 1.0 */
export function playLikeHeartAnimation(scaleAnim: Animated.Value) {
  Animated.sequence([
    Animated.spring(scaleAnim, { toValue: 0.7, useNativeDriver: true, tension: 300, friction: 22 }),
    Animated.spring(scaleAnim, { toValue: 1.2, tension: 200, friction: 5, useNativeDriver: true }),
    Animated.spring(scaleAnim, { toValue: 1.0, tension: 200, friction: 8, useNativeDriver: true }),
  ]).start()
}
