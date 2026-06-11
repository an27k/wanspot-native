import { StyleSheet, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

/**
 * カメラプレビュー用の薄いヴィネット（四隅のみ暗く、中央は透明）。
 * 白い中心を持つ PNG を重ねると白飛びするため SVG グラデーションを使う。
 */
export function UtsurunLiveOverlay() {
  return (
    <View style={styles.root} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vig" cx="50%" cy="50%" rx="72%" ry="78%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="62%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.38} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vig)" />
      </Svg>
      <View style={styles.warmWash} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  warmWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 170, 90, 0.06)',
  },
})
