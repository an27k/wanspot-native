import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { Image } from 'expo-image'
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
import { remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CenterSnapPicker } from '@/components/CenterSnapPicker'
import { dogBirthdayYearBounds, OwnerBirthdayPickers, ownerBirthdayToYmd } from '@/components/OwnerBirthdayPickers'
import { Header } from '@/components/onboarding/Header'
import { FormField } from '@/components/onboarding/FormField'
import { Ionicons } from '@expo/vector-icons'
import { OB_LOCATION_KEY } from '@/lib/onboarding-constants'
import { supabase } from '@/lib/supabase'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { showImagePickerOptions } from '@/lib/image-picker'

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
  const [dogPhotoUri, setDogPhotoUri] = useState<string | null>(null)
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

  const handlePickDogPhoto = () => {
    showImagePickerOptions(async (image) => {
      setDogPhotoUri(image.uri)
      setPhotoError('')

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id
        if (!userId) {
          Alert.alert('エラー', 'ログインが必要です')
          return
        }

        const fileExt = 'jpg'
        const filePath = `dogs/${userId}-${Date.now()}.${fileExt}`

        const response = await fetch(image.uri)
        const arrayBuffer = await response.arrayBuffer()

        // FIXME: Supabase Dashboard で avatars バケットの RLS ポリシーを確認
        // - INSERT: authenticated ユーザーが自分のフォルダにアップロード可能
        // - SELECT: 全ユーザーが読み取り可能（公開URL利用のため）
        // - UPDATE/DELETE: 自分のファイルのみ
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          })

        if (uploadError) {
          Alert.alert('エラー', '写真のアップロードに失敗しました')
          setDogPhotoUri(null)
          return
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        const publicUrl = data.publicUrl

        const obDog = JSON.parse((await AsyncStorage.getItem('ob_dog')) || '{}')
        await AsyncStorage.setItem(
          'ob_dog',
          JSON.stringify({
            ...obDog,
            photo_url: publicUrl,
          })
        )
      } catch (error) {
        console.error('[onboarding/dog] photo upload error:', error)
        Alert.alert('エラー', '写真のアップロードに失敗しました')
        setDogPhotoUri(null)
      }
    })
  }

  const goNext = async () => {
    if (!canNext || submitting) return
    setSubmitting(true)
    setPhotoError('')
    try {
      const prev = JSON.parse((await AsyncStorage.getItem('ob_dog')) || '{}')
      const prevPhotoUrl = typeof prev?.photo_url === 'string' ? prev.photo_url : null

      const obDogPayload = JSON.stringify({
        name,
        year: dogYear,
        month: dogMonth,
        day: dogDay,
        breed,
        gender,
        vaccineCombo,
        vaccineRabies,
        ...(prevPhotoUrl ? { photo_url: prevPhotoUrl } : {}),
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: padTop, paddingBottom: padBottom + CTA_HEIGHT }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header progress={2} total={5} />

        <Text style={styles.title}>愛犬のことを{'\n'}教えてください</Text>

        <View style={styles.photoSection}>
          <Pressable
            onPress={handlePickDogPhoto}
            style={({ pressed }) => [styles.photoCircle, pressed && styles.photoCirclePressed]}
          >
            {dogPhotoUri ? (
              <Image source={{ uri: dogPhotoUri }} style={styles.photoPreview} contentFit="cover" {...remoteImageExpoProps} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={28} color="#BBB" />
              </View>
            )}
          </Pressable>
          <Text style={styles.photoLabel}>{dogPhotoUri ? '写真を変更' : '写真を追加（任意）'}</Text>
          {photoError ? <Text style={styles.err}>{photoError}</Text> : null}
        </View>

        <FormField label="名前" required>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="例: モカ"
            placeholderTextColor="#BBB"
            style={styles.textInput}
            returnKeyType="next"
          />
        </FormField>

        <FormField label="生年月日" required hint="正確な日付がわからない場合は、推定でOKです">
          <View style={styles.birthdayCard}>
            <OwnerBirthdayPickers
              compact
              year={dogYear}
              month={dogMonth}
              day={dogDay}
              onChangeYear={(v) => {
                setDogYear(v)
                void Haptics.selectionAsync()
              }}
              onChangeMonth={(v) => {
                setDogMonth(v)
                void Haptics.selectionAsync()
              }}
              onChangeDay={(v) => {
                setDogDay(v)
                void Haptics.selectionAsync()
              }}
              yearMin={dogYBounds.min}
              yearMax={dogYBounds.max}
              fieldLabel=""
              hint=""
            />
          </View>
        </FormField>

        <FormField label="犬種" required>
          <View style={styles.pickerCard}>
            <CenterSnapPicker listKey="dog-breed" data={breedRows} value={breed} onChange={setBreed} />
          </View>
        </FormField>

        <FormField label="性別" required>
          <View style={styles.row2}>
            {(['male', 'female'] as const).map((g) => {
              const on = gender === g
              return (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={({ pressed }) => [
                    styles.optionHalf,
                    on && styles.optionHalfOn,
                    pressed && styles.optionHalfPressed,
                  ]}
                >
                  <Text style={[styles.optionHalfTxt, on && { color: '#1A1A1A' }]}>{g === 'male' ? '♂' : '♀'}</Text>
                </Pressable>
              )
            })}
          </View>
        </FormField>

        {[
          { label: '混合ワクチン3回', state: vaccineCombo, set: setVaccineCombo },
          { label: '狂犬病ワクチン', state: vaccineRabies, set: setVaccineRabies },
        ].map(({ label, state, set }) => (
          <FormField key={label} label={label} required>
            <View style={styles.row2}>
              {[true, false].map((v) => {
                const on = state === v
                return (
                  <Pressable
                    key={String(v)}
                    onPress={() => set(v)}
                    style={({ pressed }) => [
                      styles.optionHalf,
                      on && styles.optionHalfOn,
                      pressed && styles.optionHalfPressed,
                    ]}
                  >
                    <Text style={[styles.optionHalfTxtSm, on && { color: '#1A1A1A' }]}>{v ? 'YES' : 'NO'}</Text>
                  </Pressable>
                )
              })}
            </View>
          </FormField>
        ))}
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
            {submitting ? '処理中...' : '次へ'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const CTA_HEIGHT = 92

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 36,
    marginTop: 16,
    marginBottom: 32,
    letterSpacing: 0.3,
  },
  photoSection: { alignItems: 'center', marginBottom: 32 },
  photoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0EFEC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  photoCirclePressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  photoLabel: { fontSize: 12, color: '#999' },
  err: { fontSize: 12, color: '#E84335', marginTop: 10 },
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
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
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
  optionHalfTxt: { fontSize: 24, fontWeight: '700', color: '#999' },
  optionHalfTxtSm: { fontSize: 14, fontWeight: '700', color: '#999' },
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
