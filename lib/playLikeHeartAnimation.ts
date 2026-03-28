import { Animated } from 'react-native'

export function playLikeHeartAnimation(scaleAnim: Animated.Value) {
  Animated.sequence([
    Animated.timing(scaleAnim, { toValue: 0.7, duration: 80, useNativeDriver: true }),
    Animated.spring(scaleAnim, { toValue: 1.2, tension: 200, friction: 5, useNativeDriver: true }),
    Animated.spring(scaleAnim, { toValue: 1.0, tension: 200, friction: 8, useNativeDriver: true }),
  ]).start()
}
