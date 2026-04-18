import AsyncStorage from '@react-native-async-storage/async-storage'
// import * as ImagePicker from 'expo-image-picker'
import { useEffect, useState } from 'react'
import {
  Alert,
  Image,
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
import { CenterSnapPicker } from '@/components/CenterSnapPicker'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { dogBirthdayYearBounds, OwnerBirthdayPickers, ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { DogPawPlaceholder } from '@/components/events/EventCard'
import { colors } from '@/constants/colors'
import { OB_LOCATION_KEY } from '@/lib/onboarding-constants'
import { supabase } from '@/lib/supabase'
import { TAB_BAR_HEIGHT } from '@/constants/layout'

const BREEDS = [
  'トイプードル',
  'チワワ',
  'ダックスフンド',
  'ポメラニアン',
  'ミニチュアシュナウザー',
  'フレンチブルドッグ',
  '柴犬',
  'ヨークシャーテリア',
  'マルチーズ',
  'シーズー',
  'ゴールデンレトリバー',
  'キャバリアキングチャールズスパニエル',
  'パピヨン',
  'ウェルシュコーギー',
  'ラブラドールレトリバー',
  'ビションフリーゼ',
  'ボーダーコリー',
  'パグ',
  'シベリアンハスキー',
  'イタリアングレイハウンド',
  'ジャックラッセルテリア',
  'サモエド',
  '日本スピッツ',
  '秋田犬',
  'ミニチュアピンシャー',
  'ウエストハイランドホワイトテリア',
  'ボストンテリア',
  'アメリカンコッカースパニエル',
  'ビーグル',
  'MIX（ミックス犬）',
  'その他',
] as const

const STEP_DOTS = 5

export default function DogPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(OB_LOCATION_KEY)
      if (!raw) router.replace('/onboarding/location')
    })()
  }, [router])
  const [name, setName] = useState('')
  const [dogYear, setDogYear] = useState('')
  const [dogMonth, setDogMonth] = useState('')
  const [dogDay, setDogDay] = useState('')
  const [breed, setBreed] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [vaccineCombo, setVaccineCombo] = useState<boolean | null>(null)
  const [vaccineRabies, setVaccineRabies] = useState<boolean | null>(null)
  const [dogPhotoPreview, setDogPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const dogBirthdayYmd = ownerBirthdayToYmd(dogYear, dogMonth, dogDay)
  const dogYBounds = dogBirthdayYearBounds()
  const canNext =
    !!dogBirthdayYmd &&
    !!name.trim() &&
    !!breed &&
    gender !== null &&
    vaccineCombo !== null &&
    vaccineRabies !== null

  const pickPhoto = () => {
    Alert.alert('準備中', '写真の選択は準備中です')
    // const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    // if (!perm.granted) {
    //   setPhotoError('画像ライブラリへのアクセスが必要です')
    //   return
    // }
    // const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
    // if (!res.canceled && res.assets[0]?.uri) {
    //   setPhotoError('')
    //   setDogPhotoPreview(res.assets[0].uri)
    // }
  }

  const skipPhoto = () => {
    setPhotoError('')
    setDogPhotoPreview(null)
  }

  const goNext = async () => {
    if (!canNext || submitting) return
    setSubmitting(true)
    setPhotoError('')
    try {
      let dogPhotoUrl: string | null = null
      if (dogPhotoPreview) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setPhotoError('ログインが必要です')
          return
        }
        const resFetch = await fetch(dogPhotoPreview)
        const buf = await resFetch.arrayBuffer()
        const path = `${user.id}/dog.jpg`
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, buf, {
          upsert: true,
          contentType: 'image/jpeg',
        })
        if (upErr) {
          setPhotoError('写真のアップロードに失敗しました')
          return
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        dogPhotoUrl = urlData.publicUrl
      }

      const obDogPayload = JSON.stringify({
        name,
        year: dogYear,
        month: dogMonth,
        day: dogDay,
        breed,
        gender,
        vaccineCombo,
        vaccineRabies,
        ...(dogPhotoUrl ? { dogPhotoUrl } : {}),
      })
      await AsyncStorage.setItem('ob_dog', obDogPayload)
      router.push('/onboarding/size')
    } finally {
      setSubmitting(false)
    }
  }

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24
  const padTop = insets.top + 16

  const breedRows = [{ value: '', label: '—' }, ...BREEDS.map((b) => ({ value: b, label: b }))]

  return (
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
            <View key={i} style={[styles.dot, { backgroundColor: i <= 1 ? '#FFD84D' : '#e0e0e0' }]} />
          ))}
        </View>
      </View>

      <Text style={styles.h2}>
        愛犬のことを{'\n'}教えてください
      </Text>

      <View>
        <Text style={styles.label}>
          愛犬の写真<Text style={{ color: '#c9a227' }}>（任意）</Text>
        </Text>
        <Text style={styles.hint}>
          写真の選択は準備中です。写真なしでも「次へ」で進めます。選んだあと取り消す場合は「スキップ（写真なし）」を押してください。
        </Text>
        <TouchableOpacity style={styles.photoRow} onPress={pickPhoto}>
          <View style={styles.photoRing}>
            {dogPhotoPreview ? (
              <Image source={{ uri: dogPhotoPreview }} style={styles.photoImg} resizeMode="cover" />
            ) : (
              <DogPawPlaceholder size={36} fill={colors.dogPhotoPlaceholderPaw} />
            )}
          </View>
          <Text style={styles.photoLbl}>写真を選ぶ</Text>
        </TouchableOpacity>
        {dogPhotoPreview ? (
          <TouchableOpacity onPress={skipPhoto}>
            <Text style={styles.skip}>スキップ（写真なし）</Text>
          </TouchableOpacity>
        ) : null}
        {photoError ? <Text style={styles.err}>{photoError}</Text> : null}
      </View>

      <View>
        <Text style={styles.label}>名前</Text>
        <TextInput style={styles.input} placeholder="モカ" value={name} onChangeText={setName} placeholderTextColor="#aaa" />
      </View>

      <View style={styles.birthdayCard}>
        <OwnerBirthdayPickers
          compact
          year={dogYear}
          month={dogMonth}
          day={dogDay}
          onChangeYear={setDogYear}
          onChangeMonth={setDogMonth}
          onChangeDay={setDogDay}
          yearMin={dogYBounds.min}
          yearMax={dogYBounds.max}
          fieldLabel="生年月日（必須）"
          hint="年・月・日をすべて選択してください。"
        />
      </View>

      <View>
        <Text style={styles.label}>犬種</Text>
        <CenterSnapPicker listKey="dog-breed" data={breedRows} value={breed} onChange={setBreed} />
      </View>

      <View>
        <Text style={styles.label}>性別</Text>
        <View style={styles.row2}>
          {(['male', 'female'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.half, gender === g ? styles.halfOn : styles.halfOff]}
              onPress={() => setGender(g)}
            >
              <Text
                style={[
                  styles.halfTxt,
                  gender === g && { color: g === 'male' ? colors.genderMale : colors.genderFemale },
                ]}
              >
                {g === 'male' ? '♂' : '♀'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {[
        { label: '混合ワクチン3回', state: vaccineCombo, set: setVaccineCombo },
        { label: '狂犬病ワクチン', state: vaccineRabies, set: setVaccineRabies },
      ].map(({ label, state, set }) => (
        <View key={label}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.row2}>
            {[true, false].map((v) => (
              <TouchableOpacity
                key={String(v)}
                style={[styles.half, state === v ? styles.halfOn : styles.halfOff]}
                onPress={() => set(v)}
              >
                <Text style={[styles.halfTxtSm, state === v && { color: '#2b2a28' }]}>{v ? 'YES' : 'NO'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.next, (!canNext || submitting) && styles.nextOff]}
        disabled={!canNext || submitting}
        onPress={() => void goNext()}
      >
        <Text style={[styles.nextTxt, (!canNext || submitting) && { color: '#ccc' }]}>
          {submitting ? '処理中...' : '次へ →'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#fff' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontWeight: '800', fontSize: 14, color: '#2b2a28' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  h2: { fontSize: 24, fontWeight: '800', lineHeight: 32, color: '#2b2a28' },
  label: { fontSize: 12, color: '#aaa', marginBottom: 4 },
  hint: { fontSize: 11, color: '#aaa', lineHeight: 16, marginBottom: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.dogPhotoPlaceholderBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoLbl: { fontSize: 11, color: '#888' },
  skip: { fontSize: 11, color: '#aaa', marginTop: 8, marginLeft: 92 },
  err: { fontSize: 12, color: '#E84335', marginTop: 4 },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    backgroundColor: '#f7f6f3',
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#2b2a28',
  },
  /** オーナー登録（owner.tsx）の birthdayCard と同じ見た目 */
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
  half: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  halfOn: { backgroundColor: '#FFD84D' },
  halfOff: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8' },
  halfTxt: { fontSize: 24, fontWeight: '700', color: '#aaa' },
  halfTxtSm: { fontSize: 14, fontWeight: '700', color: '#aaa' },
  next: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextOff: { backgroundColor: '#f5f5f5' },
  nextTxt: { fontSize: 16, fontWeight: '700', color: '#2b2a28' },
})
