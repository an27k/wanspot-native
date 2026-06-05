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
import { Ionicons } from '@expo/vector-icons'
import { WalkAreaTagPicker } from '@/components/walk-area/WalkAreaTagPicker'
import { colors } from '@/constants/colors'
import { fetchUserWalkAreaTags } from '@/lib/fetch-user-walk-area-tags'
import { resolveSessionLocation } from '@/lib/location-session'
import { updateUserWalkAreaTagsOnly } from '@/lib/persist-user-walk-area'
import { supabase } from '@/lib/supabase'
import { invalidateCache } from '@/lib/client-cache'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'

export default function WalkAreaSettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [tags, setTags] = useState<string[]>([])
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const [existing, loc] = await Promise.all([
        fetchUserWalkAreaTags(supabase),
        resolveSessionLocation(null),
      ])
      setTags(existing)
      if (loc.ok) setAnchor(loc.location)
      setLoading(false)
    })()
  }, [])

  const save = useCallback(async () => {
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

  const padTop = insets.top + 8
  const padBottom = insets.bottom + 24

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: padTop }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12} accessibilityLabel="戻る">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>散歩エリア</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: padBottom + 72 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <Text style={styles.loadingTxt}>読み込み中...</Text>
        ) : (
          <WalkAreaTagPicker anchor={anchor} value={tags} onChange={setTags} />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={() => void save()}
          disabled={saving || loading}
        >
          <Text style={styles.saveBtnTxt}>{saving ? '保存中...' : '保存する'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  headerSpacer: { width: 44 },
  loadingTxt: { marginTop: 24, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.brandButton,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brandDark,
  },
  saveBtnTxt: { fontSize: 15, fontWeight: '800', color: colors.text },
})
