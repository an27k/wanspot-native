import { Dimensions, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

const COVER_H = 128

/** アルバムプロフィール上部カバー（SVG グラデ） */
export function AlbumCoverGradient() {
  const width = Dimensions.get('window').width

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={COVER_H}>
        <Defs>
          <LinearGradient id="albumCoverGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFC247" />
            <Stop offset="0.5" stopColor="#F4A02A" />
            <Stop offset="1" stopColor="#FF6F43" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={COVER_H} fill="url(#albumCoverGrad)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: COVER_H },
})
