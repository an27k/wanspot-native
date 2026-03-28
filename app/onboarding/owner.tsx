import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { OwnerBirthdayPickers, ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { defaultBioFromDog } from '@/lib/default-bio'
import { OB_LOCATION_KEY, POST_ONBOARDING_TUTORIAL_KEY } from '@/lib/onboarding-constants'
import { upsertUserWithWalkAreas } from '@/lib/persist-user-walk-area'
import { walkAreaTagsForUpsert } from '@/lib/walk-area-tags'
import { supabase } from '@/lib/supabase'

const PARENT_OPTIONS = [
  { value: 'papa' as const, label: 'パパ' },
  { value: 'mama' as const, label: 'ママ' },
]

const STEP_DOTS = 5

export default function OwnerOnboardingPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [parentType, setParentType] = useState<'papa' | 'mama' | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [ownerBio, setOwnerBio] = useState('')
  const [ownerYear, setOwnerYear] = useState('')
  const [ownerMonth, setOwnerMonth] = useState('')
  const [ownerDay, setOwnerDay] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const padTop = insets.top + 16
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem('ob_dog')
      if (!raw) return
      try {
        const dog = JSON.parse(raw) as { name?: string; breed?: string }
        setOwnerBio((b) => (b.trim() === '' ? defaultBioFromDog(dog) : b))
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(OB_LOCATION_KEY)
      if (!raw) router.replace('/onboarding/location')
    })()
  }, [router])

  const ownerBirthdayYmd = ownerBirthdayToYmd(ownerYear, ownerMonth, ownerDay)
  const canNext =
    parentType !== null &&
    ownerBirthdayYmd !== null &&
    ownerName.trim().length > 0 &&
    ownerBio.trim().length > 0

  const goNext = async () => {
    if (!canNext || submitting) return
    setSubmitting(true)
    await AsyncStorage.setItem(
      'ob_owner',
      JSON.stringify({
        parent_type: parentType,
        ownerYear,
        ownerMonth,
        ownerDay,
        ownerName: ownerName.trim(),
        ownerBio: ownerBio.trim(),
      })
    )
    try {
      const raw = await AsyncStorage.getItem('ob_dog')
      const rawSize = await AsyncStorage.getItem('ob_size')
      const rawOwner = await AsyncStorage.getItem('ob_owner')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !raw || !rawSize || !rawOwner) {
        Alert.alert('エラー', '入力データが見つかりません。最初からやり直してください。')
        setSubmitting(false)
        return
      }
      let ownerParsed: {
        parent_type?: 'papa' | 'mama'
        ownerYear?: string | null
        ownerMonth?: string | null
        ownerDay?: string | null
        ownerName?: string
        ownerBio?: string
      }
      try {
        ownerParsed = JSON.parse(rawOwner) as typeof ownerParsed
      } catch {
        Alert.alert('エラー', 'オーナー情報の読み込みに失敗しました。')
        setSubmitting(false)
        return
      }
      const userBirthday = ownerBirthdayToYmd(
        String(ownerParsed.ownerYear ?? ''),
        String(ownerParsed.ownerMonth ?? ''),
        String(ownerParsed.ownerDay ?? '')
      )
      if (!userBirthday) {
        Alert.alert('入力エラー', 'オーナーの生年月日（年・月・日すべて）を選択してください。')
        setSubmitting(false)
        return
      }
      const dog = JSON.parse(raw) as {
        name?: string
        year?: string
        month?: string
        breed?: string
        gender?: 'male' | 'female'
        vaccineCombo?: boolean
        vaccineRabies?: boolean
        dogPhotoUrl?: string | null
      }
      const birthday =
        dog.year && dog.month ? `${dog.year}-${String(dog.month).padStart(2, '0')}-01` : null

      const rawArea = await AsyncStorage.getItem('ob_area')
      let walkAreaTags: string[] = []
      let useLocationBased = false
      if (rawArea) {
        try {
          const areaParsed = JSON.parse(rawArea) as {
            tags?: unknown
            walkArea?: string
            useLocationBased?: boolean
          }
          useLocationBased = !!areaParsed.useLocationBased
          if (Array.isArray(areaParsed.tags)) {
            walkAreaTags = walkAreaTagsForUpsert(
              areaParsed.tags.filter((x): x is string => typeof x === 'string')
            )
          } else if (typeof areaParsed.walkArea === 'string' && areaParsed.walkArea.trim()) {
            walkAreaTags = walkAreaTagsForUpsert([areaParsed.walkArea.trim()])
          }
        } catch {
          /* ignore */
        }
      }

      const { error: userUpsertError } = await upsertUserWithWalkAreas(supabase, {
        id: user.id,
        name: (ownerParsed.ownerName ?? '').trim() || (user.email?.split('@')[0] ?? 'ユーザー'),
        parent_type: ownerParsed.parent_type ?? 'papa',
        birthday: userBirthday,
        bio: (ownerParsed.ownerBio ?? '').trim() || null,
        walkAreaTags: walkAreaTags,
      })
      if (userUpsertError) {
        Alert.alert('保存に失敗しました（オーナー）', userUpsertError.message)
        setSubmitting(false)
        return
      }

      const dogPayload = {
        name: dog.name ?? '',
        birthday,
        breed: dog.breed ?? null,
        gender: dog.gender ?? null,
        photo_url: dog.dogPhotoUrl ?? null,
        rabies_vaccinated: dog.vaccineRabies === true,
        vaccine_vaccinated: dog.vaccineCombo === true,
        rabies_vaccinated_at: null as string | null,
        vaccine_vaccinated_at: null as string | null,
      }
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
      if (existingDog?.id) {
        const { error: dogUpErr } = await supabase.from('dogs').update(dogPayload).eq('id', existingDog.id)
        if (dogUpErr) {
          Alert.alert('保存に失敗しました（愛犬）', dogUpErr.message)
          setSubmitting(false)
          return
        }
      } else {
        const { error: dogInsErr } = await supabase.from('dogs').insert({ user_id: user.id, ...dogPayload })
        if (dogInsErr) {
          Alert.alert('保存に失敗しました（愛犬）', dogInsErr.message)
          setSubmitting(false)
          return
        }
      }
      if (useLocationBased) {
        await AsyncStorage.setItem('pref_nearby_wide', '1')
      } else {
        await AsyncStorage.removeItem('pref_nearby_wide')
      }
      await AsyncStorage.multiRemove(['ob_dog', 'ob_size', 'ob_owner', 'ob_area', OB_LOCATION_KEY])
      await AsyncStorage.setItem(POST_ONBOARDING_TUTORIAL_KEY, '1')
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : String(e))
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    router.replace('/(tabs)')
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <ScrollView
        style={styles.main}
        contentContainerStyle={{ paddingBottom: padBottom, paddingHorizontal: 20, paddingTop: padTop, gap: 20 }}
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
              <View key={i} style={[styles.dot, { backgroundColor: i <= 4 ? '#FFD84D' : '#e0e0e0' }]} />
            ))}
          </View>
        </View>

        <Text style={styles.h2}>
          あなたについて{'\n'}教えてください
        </Text>

        <View>
          <Text style={styles.label}>オーナーの名前（表示名）</Text>
          <Text style={styles.hint}>例：パパの場合 山田 太郎／ママの場合 山田 花子</Text>
          <TextInput
            style={styles.input}
            placeholder="山田 太郎"
            value={ownerName}
            onChangeText={setOwnerName}
            placeholderTextColor="#aaa"
          />
        </View>

        <View>
          <Text style={styles.label}>自己紹介</Text>
          <Text style={styles.hint}>愛犬の名前をもとに案内文を入れています。編集してOKです。</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="自己紹介"
            value={ownerBio}
            onChangeText={setOwnerBio}
            placeholderTextColor="#aaa"
            multiline
            textAlignVertical="top"
          />
        </View>

        <View>
          <Text style={styles.label}>肩書き</Text>
          <View style={styles.row2}>
            {PARENT_OPTIONS.map((opt) => {
              const on = parentType === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.half, on ? styles.halfOn : styles.halfOff]}
                  onPress={() => setParentType(opt.value)}
                >
                  <Text
                    style={[
                      styles.halfTxt,
                      on && (opt.value === 'papa' ? { color: colors.genderMale } : { color: colors.genderFemale }),
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={styles.birthdayCard}>
          <OwnerBirthdayPickers
            compact
            year={ownerYear}
            month={ownerMonth}
            day={ownerDay}
            onChangeYear={setOwnerYear}
            onChangeMonth={setOwnerMonth}
            onChangeDay={setOwnerDay}
          />
        </View>

        <TouchableOpacity
          style={[styles.next, (!canNext || submitting) && styles.nextOff]}
          disabled={!canNext || submitting}
          onPress={() => void goNext()}
        >
          <Text style={[styles.nextTxt, (!canNext || submitting) && { color: '#ccc' }]}>
            {submitting ? '保存中...' : 'はじめる →'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  main: { flex: 1, backgroundColor: '#fff' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontWeight: '800', fontSize: 14, color: '#1a1a1a' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: '#1a1a1a' },
  label: { fontSize: 12, color: '#aaa', marginBottom: 4 },
  hint: { fontSize: 11, color: '#aaa', lineHeight: 16, marginBottom: 8 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    backgroundColor: '#f7f6f3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
  },
  inputMultiline: { minHeight: 100, paddingTop: 12 },
  /** 生年月日ピッカーを前後の背景と区切り、ドラム操作しやすくする */
  birthdayCard: {
    marginTop: 8,
    padding: 16,
    paddingBottom: 18,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  row2: { flexDirection: 'row', gap: 8 },
  half: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  halfOn: { backgroundColor: '#FFF9E0', borderWidth: 2, borderColor: '#FFD84D' },
  halfOff: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8' },
  halfTxt: { fontSize: 16, fontWeight: '800', color: '#aaa' },
  next: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { backgroundColor: '#f5f5f5' },
  nextTxt: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
})
