import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WanspotDogMark } from '@/components/icons/WanspotDogMark'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'

/** Google Chrome 新規タブ風の中央ロゴヘッダー（犬アイコン＋サービス名） */
export function SearchHomeHeader() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <WanspotDogMark width={53} height={43} />
      <Text style={styles.brandText}>wanspot</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
