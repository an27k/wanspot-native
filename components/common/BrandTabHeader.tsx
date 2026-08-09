import { StyleSheet, Text, View } from 'react-native'
import { Logo } from '@/components/Logo'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'

/** グラデ背景タブ（まとめ記事・カレンダー）共通の中央ブランドヘッダー */
export function BrandTabHeader() {
  return (
    <View style={styles.wrap}>
      <Logo size={26} />
      <Text style={styles.txt}>Wanspot</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    marginTop: 4,
  },
  // ロゴと組むワードマーク。文章の階層ではなく意匠なので型には寄せない
  txt: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: GOOGLE_HOME.textPrimary },
})
