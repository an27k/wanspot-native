import * as Linking from 'expo-linking'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/AppHeader'
import { SafeDogAvatar } from '@/components/dog/SafeDogAvatar'
import { RunningDog } from '@/components/DogStates'
import { WalkAlertCard } from '@/components/search/WalkAlertCard'
import { PressableScale } from '@/components/common/PressableScale'
import { ThemePreferenceSegments } from '@/components/settings/ThemePreferenceSegments'
import { resolveSessionLocation } from '@/lib/location-session'
import { WanspotIconPawCheck } from '@/components/icons/WanspotIconPawCheck'
import { useDogProfile } from '@/components/dog/useDogProfile'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { getWanspotApiBase } from '@/lib/wanspot-api'
import { useAuth } from '@/context/AuthContext'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'

function SettingsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session, signOut } = useAuth()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const { dog, loading } = useDogProfile()
  const isGuest = !session
  const apiBase = useMemo(() => getWanspotApiBase(), [])
  /** お散歩予報カード用の現在地（許可済みセッション位置。毎朝の通知タップの着地でもある） */
  const [walkLocation, setWalkLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    void (async () => {
      const result = await resolveSessionLocation(null)
      if (result.ok) setWalkLocation(result.location)
    })()
  }, [])

  const openWeb = useCallback(
    (path: string) => {
      if (!apiBase) return
      void Linking.openURL(`${apiBase}${path}`)
    },
    [apiBase]
  )

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 16

  if (isGuest) {
    return (
      <View style={styles.root}>
        <AppHeader />
        {/*
          説明文は置かない。押した先の入口画面に同じことが書いてあるので、
          ここで先に読ませても二度手間になる。

          テーマ切り替えはアカウントと関係ない端末の設定なので、ゲストでも触れる
          ようにする。ここを閉じていると、登録しない人はライト/ダークを選べない。
          表示の切り替えを上、登録の導線を下に置き、2つをまとめて中央に寄せる。
        */}
        <View style={styles.guestMain}>
          <View style={styles.guestTheme}>
            <Text style={styles.sectionCaption}>表示</Text>
            <ThemePreferenceSegments />
          </View>
          <PressableScale
            style={styles.guestBtn}
            onPress={() => router.push('/(auth)/signup')}
            accessibilityRole="button"
            accessibilityLabel="ログインまたは新規登録"
          >
            <Ionicons name="log-in-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.guestBtnTxt}>ログイン / 新規登録</Text>
          </PressableScale>
        </View>

        <View style={[styles.guestLegal, { paddingBottom: padBottom }]}>
          <PressableScale style={styles.legalRow} onPress={() => openWeb('/privacy')} accessibilityLabel="プライバシーポリシー">
            <Text style={styles.legalTxt}>プライバシーポリシー</Text>
          </PressableScale>
          <PressableScale style={styles.legalRow} onPress={() => openWeb('/terms')} accessibilityLabel="利用規約">
            <Text style={styles.legalTxt}>利用規約</Text>
          </PressableScale>
        </View>
      </View>
    )
  }

  if (loading && !dog) {
    return (
      <View style={styles.root}>
        <AppHeader />
        <View style={styles.loadRoot}>
          <RunningDog label="設定を読み込み中..." />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingTop: 12, paddingBottom: padBottom, gap: 8 }}
      >
        <View style={styles.section}>
          <PressableScale
            style={styles.profileCard}
            onPress={() => router.push('/settings/dog-profile')}
            accessibilityLabel="愛犬プロフィールを開く"
          >
            <View style={styles.profileAvatar}>
              <SafeDogAvatar uri={dog?.photo_url} size={28} />
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{dog?.name || '愛犬プロフィール'}</Text>
              <Text style={styles.profileMeta} numberOfLines={1}>
                {dog?.breed || 'プロフィールを設定してください'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </PressableScale>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>表示</Text>
          <ThemePreferenceSegments />
        </View>

        {/* お散歩予報 — 毎朝7:00の通知タップの着地。旧検索ホームから移設 */}
        <View style={styles.section}>
          <Text style={styles.sectionCaption}>今日のお散歩</Text>
          <WalkAlertCard
            surface="light"
            location={walkLocation}
            onRequestLocation={() => {
              void (async () => {
                const result = await resolveSessionLocation(null)
                if (result.ok) setWalkLocation(result.location)
              })()
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>履歴</Text>
          <View style={styles.card}>
            <PressableScale
              style={styles.row}
              onPress={() => router.push('/likes')}
              accessibilityLabel="いいねしたスポット"
            >
              <Ionicons name="heart-outline" size={20} color={colors.text} />
              <Text style={styles.rowTxt}>いいねしたスポット</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale
              style={styles.row}
              onPress={() => router.push('/checkins')}
              accessibilityLabel="行ったスポット"
            >
              <WanspotIconPawCheck size={20} variant="outline" />
              <Text style={styles.rowTxt}>行ったスポット</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
            </PressableScale>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>サポート</Text>
          <View style={styles.card}>
            <PressableScale style={styles.row} onPress={() => openWeb('/contact')} accessibilityLabel="お問い合わせ">
              <Ionicons name="mail-outline" size={20} color={colors.text} />
              <Text style={styles.rowTxt}>お問い合わせ</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale style={styles.row} onPress={() => openWeb('/privacy')} accessibilityLabel="プライバシーポリシー">
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.text} />
              <Text style={styles.rowTxt}>プライバシーポリシー</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale style={styles.row} onPress={() => openWeb('/terms')} accessibilityLabel="利用規約">
              <Ionicons name="document-text-outline" size={20} color={colors.text} />
              <Text style={styles.rowTxt}>利用規約</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
            </PressableScale>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>アカウント</Text>
          <View style={styles.card}>
            <PressableScale
              style={styles.row}
              onPress={async () => {
                await signOut()
                router.replace('/(tabs)')
              }}
              accessibilityLabel="ログアウト"
            >
              <Ionicons name="log-out-outline" size={20} color={colors.text} />
              <Text style={styles.rowTxt}>ログアウト</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale
              style={styles.row}
              onPress={() => router.push('/account-delete')}
              accessibilityLabel="アカウントを削除"
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <View style={styles.rowTextCol}>
                <Text style={styles.dangerTitle}>アカウントを削除</Text>
                <Text style={styles.rowSubTxt}>取り消しできません</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
            </PressableScale>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  loadRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginHorizontal: 20, marginTop: 4, gap: 8 },
  sectionCaption: { ...type.label, color: colors.textSecondary, marginLeft: 2 },
  profileCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    backgroundColor: colors.dogPhotoPlaceholderBg,
  },
  profileCopy: { flex: 1, gap: 3, minWidth: 0 },
  profileName: { ...type.heading, color: colors.textPrimary },
  profileMeta: { ...type.caption, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTxt: { ...type.row, color: colors.text },
  rowTextCol: { flex: 1, gap: 2 },
  rowSubTxt: { ...type.caption, color: colors.textMuted },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 48 },
  dangerTitle: { ...type.row, fontWeight: '600' as const, color: colors.error },
  guestMain: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, gap: 20 },
  guestTheme: { gap: 8 },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  guestBtnTxt: { ...type.button, color: colors.onPrimary },
  guestLegal: { alignItems: 'center', gap: 4, paddingHorizontal: 20 },
  legalRow: { paddingVertical: 8, paddingHorizontal: 12 },
  legalTxt: { ...type.caption, color: colors.textMuted },
})

export default function SettingsTabScreen() {
  return (
    <ScreenErrorBoundary label="settings">
      <SettingsTab />
    </ScreenErrorBoundary>
  )
}
