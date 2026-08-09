import { type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Logo } from '@/components/Logo'
import type { AppColors } from '@/constants/colors'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type AppHeaderProps = {
  variant?: 'default' | 'back' | 'centered'
  /** 互換用。画面名はヘッダー内に置かず、本文側の見出しとして表示する。 */
  title?: string
  onBack?: () => void
  rightSlot?: ReactNode
}

/** セーフエリアを除いた、全画面共通ヘッダーの高さ。 */
export const APP_HEADER_HEIGHT = 52

/**
 * 全画面共通のブランドヘッダー。
 *
 * タブと詳細のどちらでも中央は必ず「現行アイコン + wanspot」に固定し、
 * 詳細画面だけ左右に戻る・共有などの操作を足す。
 */
export function AppHeader({ variant = 'default', onBack, rightSlot }: AppHeaderProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const hasBack = variant === 'back'

  return (
    <View style={[styles.bar, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {hasBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              style={styles.sideButton}
              accessibilityRole="button"
              accessibilityLabel="戻る"
            >
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.centeredRow} accessibilityRole="header">
          <Logo size={26} />
          <Text style={styles.brandText}>Wanspot</Text>
        </View>

        <View style={[styles.side, styles.sideRight]}>
          {rightSlot}
        </View>
      </View>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  centeredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  bar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    zIndex: 20,
  },
  row: {
    height: APP_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  // ロゴと組むワードマーク。文章の階層ではなく意匠なので型には寄せない
  brandText: { fontWeight: '800', fontSize: 20, letterSpacing: -0.5, color: colors.text },
  side: { width: 48, height: APP_HEADER_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  sideButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sideRight: { flexDirection: 'row', gap: 4 },
})
