import { type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Logo } from '@/components/Logo'
import { colors } from '@/constants/colors'
import { type } from '@/constants/typography'

type AppHeaderProps = {
  variant?: 'default' | 'back' | 'centered'
  title?: string
  onBack?: () => void
  rightSlot?: ReactNode
}

export function AppHeader({ variant = 'default', title, onBack, rightSlot }: AppHeaderProps) {
  const insets = useSafeAreaInsets()
  const paddingTop = insets.top + 12

  return (
    <View style={[styles.bar, { paddingTop, borderBottomColor: colors.border }]}>
      {variant === 'back' ? (
        <View style={styles.row}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.side}>
            <Ionicons name="chevron-back-outline" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.titleMid} numberOfLines={1}>
            {title ?? ''}
          </Text>
          <View style={[styles.side, styles.sideRight]}>{rightSlot}</View>
        </View>
      ) : variant === 'centered' ? (
        <View style={styles.centeredRow}>
          <Logo size={26} />
          <Text style={styles.brandText}>wanspot</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.brand}>
            <Logo size={28} />
            <Text style={styles.brandText}>wanspot</Text>
          </View>
          <View style={styles.sideRight}>{rightSlot}</View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  centeredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bar: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // ロゴと組むワードマーク。文章の階層ではなく意匠なので型には寄せない
  brandText: { fontWeight: '800', fontSize: 16, color: colors.text },
  side: { width: 40, justifyContent: 'center' },
  sideRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // 戻る付きヘッダーの画面名。iOS 標準のナビタイトルと同じ 17/700
  titleMid: {
    flex: 1,
    textAlign: 'center',
    ...type.button,
    color: colors.text,
  },
})
