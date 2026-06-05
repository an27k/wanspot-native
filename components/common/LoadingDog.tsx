import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { DogFaceMark } from '@/components/common/DogFaceMark'

/**
 * ロード中の犬顔 SVG アニメーション（バウンド＋きらめき）。
 */
export function LoadingDogSvg({ size = 64 }: { size?: number }) {
  const bounce = useRef(new Animated.Value(0)).current
  const tilt = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const makeLoop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: duration / 2,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      )

    const loops = [makeLoop(bounce, 440), makeLoop(tilt, 700)]
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [bounce, tilt])

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.14] })
  const scaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] })
  const scaleY = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] })
  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] })
  const shadowScaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] })
  const shadowOpacity = bounce.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.06] })

  const shadowW = Math.max(20, size * 0.52)
  const shadowH = Math.max(5, size * 0.1)

  return (
    <View style={[styles.wrap, { width: size, height: size * 1.2 }]}>
      <Animated.View
        style={[
          styles.shadow,
          {
            width: shadowW,
            height: shadowH,
            borderRadius: shadowH,
            opacity: shadowOpacity,
            transform: [{ scaleX: shadowScaleX }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ translateY }, { rotate }, { scaleX }, { scaleY }] }}>
        <DogFaceMark size={size} showSparkles />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  shadow: { position: 'absolute', bottom: 0, backgroundColor: '#2b2a28' },
})
