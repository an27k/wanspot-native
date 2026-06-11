import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Logo } from '@/components/Logo'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'

/** Google Chrome 新規タブ風の中央ロゴヘッダー */
export function SearchHomeHeader() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={styles.brand}>
        <Logo size={34} />
        <Text style={styles.brandText}>wanspot</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingBottom: 18,
    paddingHorizontal: GOOGLE_HOME.padH,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.6,
    color: GOOGLE_HOME.textPrimary,
  },
})
