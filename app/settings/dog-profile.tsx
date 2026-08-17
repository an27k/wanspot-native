import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/AppHeader'
import { DogIdentityProfile } from '@/components/dog/DogIdentityProfile'
import { DogVaccineSettings } from '@/components/settings/DogVaccineSettings'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { RunningDog } from '@/components/DogStates'
import { WalkAreaTagPicker } from '@/components/walk-area/WalkAreaTagPicker'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { invalidateCache } from '@/lib/client-cache'
import { fetchUserWalkAreaTags } from '@/lib/fetch-user-walk-area-tags'
import { resolveSessionLocation } from '@/lib/location-session'
import { updateUserWalkAreaTagsOnly } from '@/lib/persist-user-walk-area'
import { supabase } from '@/lib/supabase'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'

export default function DogProfileSettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const styles = useThemedStyles(createStyles)
  const { dog, setDog, userId, loading: dogLoading } = useDogProfile()
  const [tags, setTags] = useState<string[]>([])
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null)
  const [areaLoading, setAreaLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const [existing, loc] = await Promise.all([
        fetchUserWalkAreaTags(supabase),
        resolveSessionLocation(null),
      ])
      setTags(existing)
      if (loc.ok) setAnchor(loc.location)
      setAreaLoading(false)
    })()
  }, [])

  const saveWalkArea = useCallback(async () => {
    const normalized = walkAreaTagsForUpsert(tags)
    if (normalized.length === 0) {
      Alert.alert('エリアを選んでください', '散歩エリアを1つ以上選んでから保存してください。')
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    try {
      const { error } = await updateUserWalkAreaTagsOnly(supabase, user.id, normalized)
      if (error) {
        Alert.alert('保存に失敗しました', error.message)
        return
      }
      invalidateCache(`user:walk-tags:${user.id}`)
      router.back()
    } finally {
      setSaving(false)
    }
  }, [tags, router])

  const padBottom = insets.bottom + 24
  const loading = dogLoading || areaLoading

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader variant="back" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: padBottom + 72 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>愛犬情報編集</Text>
        {loading ? (
          <View style={styles.loadingWrap}>
            <RunningDog label="読み込み中..." />
          </View>
        ) : !userId ? (
          <View style={styles.guestWrap}>
            <Text style={styles.emptyTxt}>愛犬プロフィールはアカウントに保存されます。地図とイベント一覧はそのまま見られます。</Text>
            <Pressable style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginBtnTxt}>ログインする</Text>
            </Pressable>
          </View>
        ) : dog && userId ? (
          <>
            <View style={styles.profileCard}>
              <DogIdentityProfile dog={dog} userId={userId} onUpdated={setDog} variant="settings" />
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>散歩エリア</Text>
              <Text style={styles.sectionHint}>よく散歩するエリアを選ぶと、おすすめスポットが近くなります。</Text>
            </View>
            <WalkAreaTagPicker anchor={anchor} value={tags} onChange={setTags} />

            <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
              <Text style={styles.sectionTitle}>ワクチン記録</Text>
              <Text style={styles.sectionHint}>接種日をメモしておけます。タップして日付を変更できます。</Text>
            </View>
            <View style={styles.vaccineCard}>
              <DogVaccineSettings dog={dog} onUpdated={setDog} />
            </View>
          </>
        ) : (
          <Text style={styles.emptyTxt}>愛犬プロフィールが見つかりませんでした。</Text>
        )}
      </ScrollView>

      {!loading && dog ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => void saveWalkArea()}
            disabled={saving}
          >
            <Text style={styles.saveBtnTxt}>{saving ? '保存中...' : '散歩エリアを保存する'}</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  pageTitle: { ...type.title, color: colors.textPrimary, marginTop: 24, marginBottom: 4 },
  loadingWrap: { marginTop: 48, alignItems: 'center' },
  emptyTxt: { marginTop: 24, ...type.caption, color: colors.textMuted, textAlign: 'center' as const },
  guestWrap: { marginTop: 24, alignItems: 'center', gap: 16 },
  loginBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  loginBtnTxt: { ...type.button, color: colors.onPrimary },
  profileCard: {
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHead: { gap: 4, marginBottom: 12 },
  sectionHeadSpaced: { marginTop: 28 },
  vaccineCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionTitle: { ...type.heading, color: colors.text },
  sectionHint: { ...type.caption, color: colors.textMuted },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveBtnTxt: { ...type.button, color: colors.onPrimary },
})
