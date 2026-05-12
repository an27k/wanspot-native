import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import * as Haptics from 'expo-haptics'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { OwnerBirthdayPickers, ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { Header } from '@/components/onboarding/Header'
import { FormField } from '@/components/onboarding/FormField'
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

  const canNext = parentType !== null && ownerName.trim().length > 0 && ownerBio.trim().length > 0

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
      let sizeParsed: { size?: unknown } = {}
      try {
        sizeParsed = JSON.parse(rawSize) as typeof sizeParsed
      } catch {
        Alert.alert('エラー', 'サイズ情報の読み込みに失敗しました。')
        setSubmitting(false)
        return
      }
      const dogSize =
        sizeParsed.size === 'XS' ||
        sizeParsed.size === 'S' ||
        sizeParsed.size === 'M' ||
        sizeParsed.size === 'L' ||
        sizeParsed.size === 'XL'
          ? (sizeParsed.size as 'XS' | 'S' | 'M' | 'L' | 'XL')
          : null
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
      const dog = JSON.parse(raw) as {
        name?: string
        year?: string
        month?: string
        day?: string
        breed?: string
        gender?: 'male' | 'female'
        vaccineCombo?: boolean
        vaccineRabies?: boolean
        dogPhotoUrl?: string | null
      }
      const dayPart =
        typeof dog.day === 'string' && dog.day.trim() !== '' ? dog.day.trim() : '1'
      const birthday =
        dog.year && dog.month
          ? ownerBirthdayToYmd(String(dog.year), String(dog.month), dayPart)
          : null

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
        birthday: userBirthday ?? null,
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
        size: dogSize,
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
      await AsyncStorage.removeMany(['ob_dog', 'ob_size', 'ob_owner', 'ob_area', OB_LOCATION_KEY])
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: padTop, paddingBottom: padBottom + CTA_HEIGHT }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header progress={5} total={5} />

        <Text style={styles.title}>あなたについて{'\n'}教えてください</Text>

        <FormField
          label="オーナーの名前（表示名）"
          required
          hint="例：パパの場合 山田 太郎／ママの場合 山田 花子"
        >
          <TextInput
            style={styles.textInput}
            placeholder="山田 太郎"
            value={ownerName}
            onChangeText={setOwnerName}
            placeholderTextColor="#BBB"
            returnKeyType="next"
          />
        </FormField>

        <FormField label="自己紹介" required hint="愛犬の名前をもとに案内文を入れています。編集してOKです。">
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            placeholder="自己紹介"
            value={ownerBio}
            onChangeText={setOwnerBio}
            placeholderTextColor="#BBB"
            multiline
            textAlignVertical="top"
          />
        </FormField>

        <FormField label="肩書き" required>
          <View style={styles.row2}>
            {PARENT_OPTIONS.map((opt) => {
              const on = parentType === opt.value
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setParentType(opt.value)}
                  style={({ pressed }) => [
                    styles.optionHalf,
                    on && styles.optionHalfOn,
                    pressed && styles.optionHalfPressed,
                  ]}
                >
                  <Text style={[styles.optionHalfTxtSm, on && { color: '#1A1A1A' }]}>{opt.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </FormField>

        <FormField label="生年月日（任意）" hint="未入力のままでも登録できます。">
          <View style={styles.birthdayCard}>
            <OwnerBirthdayPickers
              compact
              fieldLabel=""
              hint={null}
              year={ownerYear}
              month={ownerMonth}
              day={ownerDay}
              onChangeYear={(v) => {
                setOwnerYear(v)
                void Haptics.selectionAsync()
              }}
              onChangeMonth={(v) => {
                setOwnerMonth(v)
                void Haptics.selectionAsync()
              }}
              onChangeDay={(v) => {
                setOwnerDay(v)
                void Haptics.selectionAsync()
              }}
            />
          </View>
        </FormField>
      </ScrollView>

      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 32 }]}>
        <Pressable
          onPress={() => void goNext()}
          disabled={!canNext || submitting}
          style={({ pressed }) => [
            styles.ctaButton,
            (!canNext || submitting) && styles.ctaButtonDisabled,
            pressed && canNext && !submitting && styles.ctaButtonPressed,
          ]}
        >
          <Text style={[styles.ctaText, (!canNext || submitting) && styles.ctaTextDisabled]}>
            {submitting ? '保存中...' : 'はじめる'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const CTA_HEIGHT = 92

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 36,
    marginTop: 16,
    marginBottom: 32,
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textInputMultiline: { minHeight: 110, paddingTop: 14 },
  birthdayCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row2: { flexDirection: 'row', gap: 12 },
  optionHalf: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F4F0',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionHalfOn: { backgroundColor: '#FFC107' },
  optionHalfPressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  optionHalfTxtSm: { fontSize: 15, fontWeight: '700', color: '#666' },
  ctaContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  ctaButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonDisabled: { backgroundColor: '#E5E5E5' },
  ctaButtonPressed: { backgroundColor: '#FFB300', transform: [{ scale: 0.98 }] },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  ctaTextDisabled: { color: '#999' },
})
