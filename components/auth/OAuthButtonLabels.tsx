import { appleOAuthIconSource } from '@/assets/appleOAuthIcon'
import { googleOAuthIconSource } from '@/assets/googleOAuthIcon'
import type { StyleProp, TextStyle } from 'react-native'
import { Image, StyleSheet, Text, View } from 'react-native'

const GOOGLE_ICON = 22
const APPLE_ICON = 22
/** アイコンとラベルの間隔（Google/Apple 共通） */
const GAP_ICON_TEXT = 10
/** アイコン枠の幅を固定し、ラベル開始位置を揃える */
const ICON_SLOT_W = 28

type LabelProps = {
  text: string
  textStyle: StyleProp<TextStyle>
}

/** Google 公式マーク（PNG）＋文言 */
export function GoogleOAuthLabel({ text, textStyle }: LabelProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconSlot}>
        <Image
          source={googleOAuthIconSource}
          style={styles.googleImg}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      <Text style={textStyle}>{text}</Text>
    </View>
  )
}

/** Apple マーク（PNG + 白 tint、文言と同色）＋文言 */
export function AppleOAuthLabel({ text, textStyle }: LabelProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconSlot}>
        <Image
          source={appleOAuthIconSource}
          style={styles.appleImg}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      <Text style={textStyle}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GAP_ICON_TEXT,
  },
  iconSlot: {
    width: ICON_SLOT_W,
    height: Math.max(GOOGLE_ICON, APPLE_ICON),
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleImg: {
    width: GOOGLE_ICON,
    height: GOOGLE_ICON,
  },
  appleImg: {
    width: APPLE_ICON,
    height: APPLE_ICON,
    tintColor: '#fff',
  },
})
