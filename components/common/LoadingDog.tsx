import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { DogGhost } from '@/components/common/DogGhost'

/**
 * ロード中の犬アニメーション。
 * Snapchat のお化けマーク風の犬シルエット（白塗り＋黒淵）を、
 * バウンド＋スクワッシュ＆ストレッチ＋軽い傾き＋接地シャドウで弾ませる。
 * （名称は後方互換のため LoadingDogSvg のまま）
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

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.16] })
  const scaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] })
  const scaleY = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] })
  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] })
  const shadowScaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] })
  const shadowOpacity = bounce.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.07] })

  const shadowW = Math.max(20, size * 0.5)
  const shadowH = Math.max(5, size * 0.1)

  return (
    <View style={[styles.wrap, { width: size, height: size * 1.18 }]}>
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
      <Animated.View
        style={[
          styles.img,
          { transform: [{ translateY }, { rotate }, { scaleX }, { scaleY }] },
        ]}
      >
        <DogGhost size={size} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  shadow: { position: 'absolute', bottom: 0, backgroundColor: '#2b2a28' },
  img: { marginBottom: 2 },
})
