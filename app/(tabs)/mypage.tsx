import * as Linking from 'expo-linking'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GoogleHomeBackground } from '@/components/search/GoogleHomeBackground'
import { BrandTabHeader } from '@/components/common/BrandTabHeader'
import { RunningDog } from '@/components/DogStates'
import { WalkAlertCard } from '@/components/search/WalkAlertCard'
import { PressableScale } from '@/components/common/PressableScale'
import { resolveSessionLocation } from '@/lib/location-session'
import { WanspotIconPaw } from '@/components/icons/WanspotIconPaw'
import { WanspotIconPawCheck } from '@/components/icons/WanspotIconPawCheck'
import { SETTINGS_ICON_COLOR } from '@/components/settings/settings-icon-color'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { colors } from '@/constants/colors'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { getWanspotApiBase } from '@/lib/wanspot-api'
import { useAuth } from '@/context/AuthContext'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'

function SettingsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()
  const { dog, loading } = useDogProfile()
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

  if (loading && !dog) {
    return (
      <GoogleHomeBackground>
        <View style={styles.loadRoot}>
          <RunningDog label="設定を読み込み中..." />
        </View>
      </GoogleHomeBackground>
    )
  }

  return (
    <GoogleHomeBackground>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: padBottom, gap: 8 }}
      >
        <BrandTabHeader />

        {/* お散歩予報 — 毎朝7:00の通知タップの着地。旧検索ホームから移設 */}
        <View style={styles.section}>
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
          <View style={styles.card}>
            <PressableScale
              style={styles.row}
              onPress={() => router.push('/settings/dog-profile')}
              accessibilityLabel="愛犬情報編集"
            >
              <WanspotIconPaw size={20} variant="outline" />
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTxt}>愛犬情報編集</Text>
                <Text style={styles.rowSubTxt} numberOfLines={1}>
                  {dog ? `${dog.name} · ` : ''}プロフィール・散歩エリア・ワクチン記録
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale
              style={styles.row}
              onPress={() => router.push('/likes')}
              accessibilityLabel="いいねしたスポット"
            >
              <Ionicons name="heart-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>いいねしたスポット</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale
              style={styles.row}
              onPress={() => router.push('/checkins')}
              accessibilityLabel="行ったスポット"
            >
              <WanspotIconPawCheck size={20} variant="outline" />
              <Text style={styles.rowTxt}>行ったスポット</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </PressableScale>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>サポート</Text>
          <View style={styles.card}>
            <PressableScale style={styles.row} onPress={() => openWeb('/contact')} accessibilityLabel="お問い合わせ">
              <Ionicons name="mail-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>お問い合わせ</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale style={styles.row} onPress={() => openWeb('/privacy')} accessibilityLabel="プライバシーポリシー">
              <Ionicons name="shield-checkmark-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>プライバシーポリシー</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale style={styles.row} onPress={() => openWeb('/terms')} accessibilityLabel="利用規約">
              <Ionicons name="document-text-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>利用規約</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
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
                router.replace('/(auth)/login')
              }}
              accessibilityLabel="ログアウト"
            >
              <Ionicons name="log-out-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>ログアウト</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </PressableScale>
            <View style={styles.rowDivider} />
            <PressableScale
              style={styles.row}
              onPress={() => router.push('/account-delete')}
              accessibilityLabel="アカウントを削除"
            >
              <Ionicons name="trash-outline" size={20} color="#E84335" />
              <View style={styles.rowTextCol}>
                <Text style={styles.dangerTitle}>アカウントを削除</Text>
                <Text style={styles.rowSubTxt}>取り消しできません</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </PressableScale>
          </View>
        </View>
      </ScrollView>
    </GoogleHomeBackground>
  )
}

const styles = StyleSheet.create({
  loadRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginHorizontal: 16, marginTop: 4, gap: 8 },
  sectionCaption: { fontSize: 12, color: GOOGLE_HOME.textSecondary, fontWeight: '600', marginLeft: 4 },
  card: {
    backgroundColor: colors.background,
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
  rowTxt: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowTextCol: { flex: 1, gap: 2 },
  rowSubTxt: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 48 },
  dangerTitle: { fontSize: 15, fontWeight: '600', color: '#E84335' },
})

export default function SettingsTabScreen() {
  return (
    <ScreenErrorBoundary label="settings">
      <SettingsTab />
    </ScreenErrorBoundary>
  )
}
