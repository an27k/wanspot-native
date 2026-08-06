import { StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'
import { type } from '@/constants/typography'

/** 料金ランクの上限。web の PriceLevelMark と揃える */
const PRICE_LEVEL_MAX = 4

/**
 * 料金ランクの表示。
 * 「¥¥」だけだと上限がいくつか分からないので、無料以外は常に4段構成が見える形で出す
 * （該当分は濃い ¥、残りは薄い ¥。例: レベル2 = ¥¥ + 薄い ¥¥）。
 * web の src/app/events/_components/EventIcons.tsx と同じ仕様。
 */
export function PriceLevelMark({
  level,
  size = 'sm',
}: {
  level: number | null | undefined
  /** sm = 一覧カード、md = 詳細画面 */
  size?: 'sm' | 'md'
}) {
  if (level == null || !Number.isFinite(level)) return null

  const md = size === 'md'
  const pillStyle = md ? styles.pillMd : styles.pillSm
  const txtStyle = md ? styles.txtMd : styles.txtSm

  if (level <= 0) {
    return (
      <View style={[pillStyle, styles.pillFree]}>
        <Text style={[txtStyle, styles.txtFree]}>無料</Text>
      </View>
    )
  }

  const filled = Math.min(PRICE_LEVEL_MAX, Math.max(1, Math.round(level)))
  return (
    <View style={pillStyle} accessibilityLabel={`料金ランク ${filled}／${PRICE_LEVEL_MAX}`}>
      <Text style={txtStyle}>
        {'¥'.repeat(filled)}
        <Text style={styles.txtMuted}>{'¥'.repeat(PRICE_LEVEL_MAX - filled)}</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.tintWeak,
  },
  pillMd: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.tintWeak,
  },
  pillFree: { backgroundColor: '#F0FDF4' },
  // letterSpacing はトークンの 0.7 ではなく 1 のまま。¥ が詰まると
  // 「4段のうち何段か」を数えられなくなる
  txtSm: { ...type.label, color: colors.pillText, letterSpacing: 1 },
  txtMd: { ...type.label, fontSize: 13, color: colors.pillText, letterSpacing: 1 },
  // 未該当分。薄くして「上限4のうち何段か」を読み取れるようにする
  txtMuted: { color: `${colors.pillText}40` },
  txtFree: { color: '#2FA56A', letterSpacing: 0 },
})
