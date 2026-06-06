import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

const VIGNETTE = require('../../assets/filter/vignette.png')

/**
 * カメラプレビュー用のごく薄いヴィネットのみ。
 * 日付・ライトリークは焼き込み時のみ（プレビューではチープに見えやすいため非表示）。
 */
export function UtsurunLiveOverlay() {
  return (
    <View style={styles.root} pointerEvents="none">
      <Image source={VIGNETTE} style={[styles.fill, styles.vignette]} contentFit="cover" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  vignette: { opacity: 0.18 },
})
