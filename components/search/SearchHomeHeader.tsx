import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'

/** Google Chrome 新規タブ風の中央ロゴヘッダー（テキストのみ） */
export function SearchHomeHeader() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.brandText}>wanspot</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
    paddingHorizontal: GOOGLE_HOME.padH,
  },
  brandText: {
    fontSize: 44,
    fontWeight: '500',
    letterSpacing: -1.2,
    color: GOOGLE_HOME.textPrimary,
    textAlign: 'center',
  },
})
