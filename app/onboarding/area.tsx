import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { WalkAreaTagPicker } from '@/components/walk-area/WalkAreaTagPicker'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { defaultBioFromDog } from '@/lib/default-bio'
import { OB_LOCATION_KEY, POST_ONBOARDING_TUTORIAL_KEY } from '@/lib/onboarding-constants'
import { upsertUserWithWalkAreas } from '@/lib/persist-user-walk-area'
import { supabase } from '@/lib/supabase'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'

const STEP_DOTS = 4

export default function WalkAreaOnboardingPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [wideNearby, setWideNearby] = useState(false)
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
      const { data: { user } } = await supabase.auth.getUser()
      const rawDog = await AsyncStorage.getItem('ob_dog')
      const rawSize = await AsyncStorage.getItem('ob_size')
      if (!user || !rawDog) {
        Alert.alert('エラー', '入力データが見つかりません。最初からやり直してください。')
        setSubmitting(false)
        return
      }

      let sizeParsed: { size?: unknown } = {}
      try {
        sizeParsed = rawSize ? (JSON.parse(rawSize) as typeof sizeParsed) : {}
      } catch {
        sizeParsed = {}
      }
      const dogSize =
        sizeParsed.size === 'XS' ||
        sizeParsed.size === 'S' ||
        sizeParsed.size === 'M' ||
        sizeParsed.size === 'L' ||
        sizeParsed.size === 'XL'
          ? (sizeParsed.size as 'XS' | 'S' | 'M' | 'L' | 'XL')
          : null

      const dog = JSON.parse(rawDog) as {
        name?: string
        year?: string
        month?: string
        day?: string
        breed?: string
        gender?: 'male' | 'female'
        vaccineCombo?: boolean
        vaccineRabies?: boolean
        vaccineComboDate?: string | null
        vaccineRabiesDate?: string | null
        photo_url?: string | null
      }
      const dayPart = typeof dog.day === 'string' && dog.day.trim() !== '' ? dog.day.trim() : '1'
      const birthday =
        dog.year && dog.month ? ownerBirthdayToYmd(String(dog.year), String(dog.month), dayPart) : null

      // オーナー情報は分けて取得しない（犬中心）。users 行は最小限で作成し、FK と既存画面の整合だけ保つ。
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

      // 新しい列（walk_area_tags / is_primary）。未マイグレーション or スキーマキャッシュ遅延時は外して再試行する。
      const dogExtra = { walk_area_tags: normalized, is_primary: true }
      const dogBase = {
        name: dog.name ?? '',
        birthday,
        breed: dog.breed ?? null,
        gender: dog.gender ?? null,
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

      if (wideNearby) {
        await AsyncStorage.setItem('pref_nearby_wide', '1')
      } else {
        await AsyncStorage.removeItem('pref_nearby_wide')
      }
      await AsyncStorage.removeMany(['ob_dog', 'ob_size', 'ob_area', OB_LOCATION_KEY])
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
        <View style={styles.headRow}>
          <View style={styles.brandRow}>
            <OnboardingBrand />
            <Text style={styles.brandTxt}>wanspot</Text>
          </View>
          <View style={styles.dots}>
            {Array.from({ length: STEP_DOTS }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i <= 3 ? '#FF8A1F' : '#e0e0e0' }]} />
            ))}
          </View>
        </View>

        <Text style={styles.h2}>
          よく散歩する{'\n'}エリアを選んでください
        </Text>
        <Text style={styles.hint}>現在地から約10km以内の主要エリアを提案しています。検索で他の地域も選べます（1つ以上必須）。</Text>

        <WalkAreaTagPicker anchor={anchor} value={tags} onChange={setTags} />

        <View style={styles.switchRow}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchTitle}>近くのスポットを広めに表示</Text>
            <Text style={styles.switchSub}>オンにすると、一覧の距離の初期値を約3kmにします（あとから変更可）</Text>
          </View>
          <Switch
            value={wideNearby}
            onValueChange={setWideNearby}
            trackColor={{ false: '#e0e0e0', true: '#FFC785' }}
            thumbColor={wideNearby ? colors.brand : '#f4f4f4'}
          />
        </View>

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
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontWeight: '800', fontSize: 14, color: '#2b2a28' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: '#2b2a28' },
  hint: { fontSize: 12, color: '#aaa', lineHeight: 18 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#f7f6f3',
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  switchTextCol: { flex: 1 },
  switchTitle: { fontSize: 14, fontWeight: '700', color: '#2b2a28', marginBottom: 4 },
  switchSub: { fontSize: 11, color: '#888', lineHeight: 16 },
  next: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FF8A1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { opacity: 0.45 },
  nextTxt: { fontSize: 16, fontWeight: '700', color: '#2b2a28' },
})
