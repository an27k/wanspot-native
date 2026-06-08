import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { colors } from '@/constants/colors'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { WalkAreaTagPicker } from '@/components/walk-area/WalkAreaTagPicker'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { defaultBioFromDog } from '@/lib/default-bio'
import { OB_DOG_KEY, OB_LOCATION_KEY, POST_ONBOARDING_TUTORIAL_KEY } from '@/lib/onboarding-constants'
import { upsertUserWithWalkAreas } from '@/lib/persist-user-walk-area'
import { supabase } from '@/lib/supabase'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'

export default function WalkAreaOnboardingPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const padTop = insets.top + 16
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(OB_LOCATION_KEY)
      if (!raw) {
        router.replace('/onboarding/location')
        return
      }
      try {
        const p = JSON.parse(raw) as { lat?: number; lng?: number }
        if (typeof p.lat === 'number' && typeof p.lng === 'number') {
          setAnchor({ lat: p.lat, lng: p.lng })
        }
      } catch {
        router.replace('/onboarding/location')
      }
    })()
  }, [router])

  const canNext = walkAreaTagsForUpsert(tags).length > 0

  const goNext = async () => {
    const normalized = walkAreaTagsForUpsert(tags)
    if (normalized.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const rawDog = await AsyncStorage.getItem(OB_DOG_KEY)
      if (!user || !rawDog) {
        Alert.alert('エラー', '入力データが見つかりません。最初からやり直してください。')
        setSubmitting(false)
        return
      }

      const dog = JSON.parse(rawDog) as {
        name?: string
        year?: string
        month?: string
        day?: string
        breed?: string
        size?: 'XS' | 'S' | 'M' | 'L' | 'XL'
        vaccineCombo?: boolean | null
        vaccineRabies?: boolean | null
        vaccineComboDate?: string | null
        vaccineRabiesDate?: string | null
        photo_url?: string | null
      }

      const dogSize =
        dog.size === 'XS' ||
        dog.size === 'S' ||
        dog.size === 'M' ||
        dog.size === 'L' ||
        dog.size === 'XL'
          ? dog.size
          : null

      const dayPart = typeof dog.day === 'string' && dog.day.trim() !== '' ? dog.day.trim() : '1'
      const birthday =
        dog.year && dog.month ? ownerBirthdayToYmd(String(dog.year), String(dog.month), dayPart) : null

      const { error: userUpsertError } = await upsertUserWithWalkAreas(supabase, {
        id: user.id,
        name: user.email?.split('@')[0]?.trim() || 'ユーザー',
        parent_type: 'papa',
        birthday: null,
        bio: defaultBioFromDog({ name: dog.name, breed: dog.breed }),
        walkAreaTags: normalized,
      })
      if (userUpsertError) {
        Alert.alert('保存に失敗しました', userUpsertError.message)
        setSubmitting(false)
        return
      }

      const dogExtra = { walk_area_tags: normalized, is_primary: true }
      const dogBase = {
        name: dog.name ?? '',
        birthday,
        breed: dog.breed ?? null,
        gender: null,
        size: dogSize,
        photo_url: dog.photo_url ?? null,
        rabies_vaccinated: dog.vaccineRabies === true,
        vaccine_vaccinated: dog.vaccineCombo === true,
        rabies_vaccinated_at: dog.vaccineRabiesDate || null,
        vaccine_vaccinated_at: dog.vaccineComboDate || null,
      }
      const isNewColumnMissing = (err: { message?: string } | null) =>
        !!err?.message && (err.message.includes('walk_area_tags') || err.message.includes('is_primary'))

      const { data: existingDog, error: dogSelErr } = await supabase
        .from('dogs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (dogSelErr) {
        Alert.alert('保存に失敗しました（愛犬）', dogSelErr.message)
        setSubmitting(false)
        return
      }
      const runDogWrite = async (payload: Record<string, unknown>) =>
        existingDog?.id
          ? supabase.from('dogs').update(payload).eq('id', existingDog.id)
          : supabase.from('dogs').insert({ user_id: user.id, ...payload })

      let dogWrite = await runDogWrite({ ...dogBase, ...dogExtra })
      if (dogWrite.error && isNewColumnMissing(dogWrite.error)) {
        dogWrite = await runDogWrite(dogBase)
      }
      if (dogWrite.error) {
        Alert.alert('保存に失敗しました（愛犬）', dogWrite.error.message)
        setSubmitting(false)
        return
      }

      await Promise.all([
        AsyncStorage.removeItem(OB_DOG_KEY),
        AsyncStorage.removeItem('ob_size'),
        AsyncStorage.removeItem('ob_area'),
        AsyncStorage.removeItem(OB_LOCATION_KEY),
      ])
      await AsyncStorage.setItem(POST_ONBOARDING_TUTORIAL_KEY, '1')
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : String(e))
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    router.replace('/(tabs)/search')
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.main}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: padTop, paddingBottom: padBottom, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <OnboardingStepHeader step={3} />

        <Text style={styles.h2}>よく散歩する{'\n'}エリアを選んでください</Text>
        <Text style={styles.hint}>
          近くのおすすめに使います。現在地から選びました、調整できます。あとから設定でも変更できます。
        </Text>

        <WalkAreaTagPicker anchor={anchor} value={tags} onChange={setTags} />

        <TouchableOpacity
          style={[styles.next, (!canNext || submitting) && styles.nextOff]}
          onPress={() => void goNext()}
          disabled={!canNext || submitting}
        >
          <Text style={styles.nextTxt}>{submitting ? '保存中...' : 'はじめる'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  main: { flex: 1, backgroundColor: '#fff' },
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: colors.textPrimary },
  hint: { fontSize: 12, color: '#888', lineHeight: 18 },
  next: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { opacity: 0.45 },
  nextTxt: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
})
