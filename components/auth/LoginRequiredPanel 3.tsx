import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Logo } from '@/components/Logo'
import { WanspotIconPaw } from '@/components/icons/WanspotIconPaw'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { logUserEvent } from '@/lib/user-events'

/**
 * アカウント必須機能のログイン誘導。
 * 地図・イベント一覧は開いたまま、ここから登録へ戻す。
 */
export function LoginRequiredPanel({
  variant = 'card',
  title,
  body,
  feature,
}: {
  variant?: 'screen' | 'card'
  title: string
  body: string
  feature?: string
}) {
  const router = useRouter()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)

  const goLogin = () => {
    logUserEvent({
      eventType: 'login_prompt',
      props: { feature: feature ?? variant, source: 'panel' },
    })
    // 入口は新規登録。ほとんどの人はここで初めて登録するので、ログインはその画面から辿る
    router.push('/(auth)/signup')
  }

  return (
    <View style={variant === 'screen' ? styles.screen : styles.card}>
      {variant === 'screen' ? (
        <Logo size={64} />
      ) : (
        <View style={styles.headRow}>
          <WanspotIconPaw size={13} color={colors.pillText} />
          <Text style={styles.head}>{title}</Text>
        </View>
      )}
      {variant === 'screen' ? <Text style={styles.screenTitle}>{title}</Text> : null}
      <Text style={variant === 'screen' ? styles.screenBody : styles.cardBody}>{body}</Text>
      <Pressable
        style={styles.btn}
        onPress={goLogin}
        accessibilityRole="button"
        accessibilityLabel="ログインまたは新規登録"
      >
        <Ionicons name="log-in-outline" size={18} color={colors.onPrimary} />
        <Text style={styles.btnTxt}>ログイン / 新規登録</Text>
      </Pressable>
    </View>
  )
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 16,
    },
    card: {
      backgroundColor: colors.tintWeak,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.tintStrong,
      gap: 10,
    },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    head: { ...type.label, color: colors.pillText },
    screenTitle: { ...type.title, color: colors.textPrimary, textAlign: 'center' },
    screenBody: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
    cardBody: { ...type.body, color: colors.text },
    btn: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 16,
    },
    btnTxt: { ...type.button, color: colors.onPrimary },
  })
