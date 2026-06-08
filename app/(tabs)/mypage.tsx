import * as Linking from 'expo-linking'
import { useCallback, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/AppHeader'
import { RunningDog } from '@/components/DogStates'
import { WanspotIconPaw } from '@/components/icons/WanspotIconPaw'
import { DogVaccineSettings } from '@/components/settings/DogVaccineSettings'
import { SETTINGS_ICON_COLOR } from '@/components/settings/settings-icon-color'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { getWanspotApiBase } from '@/lib/wanspot-api'
import { useAuth } from '@/context/AuthContext'

export default function SettingsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()
  const { dog, setDog, loading } = useDogProfile()
  const apiBase = useMemo(() => getWanspotApiBase(), [])

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
      <View style={styles.loadRoot}>
        <RunningDog label="設定を読み込み中..." />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: padBottom, gap: 8 }}>
        <AppHeader />

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>設定</Text>
          <View style={styles.card}>
            {dog ? <DogVaccineSettings dog={dog} onUpdated={setDog} /> : null}
            {dog ? <View style={styles.rowDivider} /> : null}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/settings/walk-area')}
              accessibilityRole="button"
              accessibilityLabel="散歩エリア"
            >
              <WanspotIconPaw size={20} />
              <Text style={styles.rowTxt}>散歩エリア</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>サポート</Text>
          <View style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => openWeb('/contact')}
              accessibilityLabel="お問い合わせ"
            >
              <Ionicons name="mail-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>お問い合わせ</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => openWeb('/privacy')}
              accessibilityLabel="プライバシーポリシー"
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>プライバシーポリシー</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => openWeb('/terms')}
              accessibilityLabel="利用規約"
            >
              <Ionicons name="document-text-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>利用規約</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={async () => {
                await signOut()
                router.replace('/(auth)/login')
              }}
              accessibilityLabel="ログアウト"
            >
              <Ionicons name="log-out-outline" size={20} color={SETTINGS_ICON_COLOR} />
              <Text style={styles.rowTxt}>ログアウト</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            onPress={() => router.push('/account-delete')}
            style={({ pressed }) => [styles.dangerCard, pressed && { opacity: 0.88 }]}
            accessibilityLabel="アカウントを削除"
          >
            <View style={styles.dangerRow}>
              <Ionicons name="trash-outline" size={22} color="#E84335" />
              <View style={styles.dangerTextCol}>
                <Text style={styles.dangerTitle}>アカウントを削除</Text>
                <Text style={styles.dangerSub}>取り消しできません</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  loadRoot: { flex: 1, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  section: { marginHorizontal: 16, marginTop: 4, gap: 8 },
  sectionCaption: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginLeft: 4 },
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
  rowTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 48 },
  dangerCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dangerTextCol: { flex: 1 },
  dangerTitle: { fontSize: 14, fontWeight: '700', color: '#E84335' },
  dangerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
})
