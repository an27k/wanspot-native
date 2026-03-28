import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'

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

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 20 }, (_, i) => currentYear - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function OnboardingDogScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState('')
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [breed, setBreed] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [vaccineCombo, setVaccineCombo] = useState<boolean | null>(null)
  const [vaccineRabies, setVaccineRabies] = useState<boolean | null>(null)
  const [localUri, setLocalUri] = useState<string | null>(null)
  const [breedOpen, setBreedOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('写真ライブラリへのアクセスが必要です')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    })
    if (!res.canceled && res.assets[0]?.uri) setLocalUri(res.assets[0].uri)
  }

  const canSubmit =
    name.trim() &&
    year != null &&
    month != null &&
    breed.trim() &&
    gender != null &&
    vaccineCombo != null &&
    vaccineRabies != null

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        Alert.alert('ログインが必要です')
        return
      }
      let dogPhotoUrl: string | null = null
      if (localUri) {
        const resFetch = await fetch(localUri)
        const buf = await resFetch.arrayBuffer()
        const ext = (localUri.split('.').pop() ?? 'jpg').split('?')[0] || 'jpg'
        const path = `${user.id}/dog.${ext}`
        const ct = ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg'
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, buf, { upsert: true, contentType: ct })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        dogPhotoUrl = urlData.publicUrl
      }

      const today = new Date().toISOString().slice(0, 10)
      const birthday = `${year}-${String(month).padStart(2, '0')}-01`

      const { error: userErr } = await supabase.from('users').upsert({
        id: user.id,
        name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'ユーザー',
      })
      if (userErr) throw userErr

      const { error: dogErr } = await supabase.from('dogs').upsert(
        {
          user_id: user.id,
          name: name.trim(),
          birthday,
          breed: breed.trim(),
          photo_url: dogPhotoUrl,
          rabies_vaccinated: vaccineRabies === true,
          vaccine_vaccinated: vaccineCombo === true,
          rabies_vaccinated_at: vaccineRabies ? today : null,
          vaccine_vaccinated_at: vaccineCombo ? today : null,
        },
        { onConflict: 'user_id' }
      )
      if (dogErr) throw dogErr

      router.replace('/(tabs)')
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 32

  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.brand}>wanspot</Text>
        <Text style={styles.h1}>愛犬のことを{'\n'}教えてください</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: padBottom }}>
        <Text style={styles.label}>写真（任意）</Text>
        <Pressable style={styles.photoRing} onPress={pickPhoto}>
          {localUri ? (
            <Image source={{ uri: localUri }} style={styles.photo} />
          ) : (
            <Ionicons name="paw" size={40} color={colors.textMuted} />
          )}
        </Pressable>
        <Text style={styles.label}>名前</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="愛犬の名前" />
        <Text style={styles.label}>誕生年・月</Text>
        <View style={styles.row2}>
          <Pressable style={styles.half} onPress={() => setYearOpen(true)}>
            <Text style={styles.halfTxt}>{year ?? '年を選択'}</Text>
          </Pressable>
          <Pressable style={styles.half} onPress={() => setMonthOpen(true)}>
            <Text style={styles.halfTxt}>{month ?? '月を選択'}</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>犬種</Text>
        <Pressable style={styles.inputLike} onPress={() => setBreedOpen(true)}>
          <Text style={breed ? styles.inputTxt : styles.ph}>{breed || '犬種を選択'}</Text>
        </Pressable>
        <Text style={styles.label}>性別</Text>
        <View style={styles.row2}>
          <Pressable
            style={[styles.chip, gender === 'male' && styles.chipOn]}
            onPress={() => setGender('male')}
          >
            <Text style={styles.chipTxt}>オス</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, gender === 'female' && styles.chipOn]}
            onPress={() => setGender('female')}
          >
            <Text style={styles.chipTxt}>メス</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>混合ワクチン接種済み？</Text>
        <View style={styles.row2}>
          <Pressable
            style={[styles.chip, vaccineCombo === true && styles.chipOn]}
            onPress={() => setVaccineCombo(true)}
          >
            <Text style={styles.chipTxt}>はい</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, vaccineCombo === false && styles.chipOn]}
            onPress={() => setVaccineCombo(false)}
          >
            <Text style={styles.chipTxt}>いいえ</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>狂犬病ワクチン接種済み？</Text>
        <View style={styles.row2}>
          <Pressable
            style={[styles.chip, vaccineRabies === true && styles.chipOn]}
            onPress={() => setVaccineRabies(true)}
          >
            <Text style={styles.chipTxt}>はい</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, vaccineRabies === false && styles.chipOn]}
            onPress={() => setVaccineRabies(false)}
          >
            <Text style={styles.chipTxt}>いいえ</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.btn, !canSubmit && styles.btnOff]} onPress={submit} disabled={!canSubmit || submitting}>
          {submitting ? <ActivityIndicator color={colors.text} /> : <Text style={styles.btnTxt}>はじめる</Text>}
        </Pressable>
      </ScrollView>
      <PickerModal
        visible={yearOpen}
        title="誕生年"
        onClose={() => setYearOpen(false)}
        insetsBottom={insets.bottom}
        data={YEARS.map(String)}
        onPick={(s) => {
          setYear(Number(s))
          setYearOpen(false)
        }}
      />
      <PickerModal
        visible={monthOpen}
        title="誕生月"
        onClose={() => setMonthOpen(false)}
        insetsBottom={insets.bottom}
        data={MONTHS.map(String)}
        onPick={(s) => {
          setMonth(Number(s))
          setMonthOpen(false)
        }}
      />
      <Modal visible={breedOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>犬種を選択</Text>
            <FlatList
              data={[...BREEDS]}
              keyExtractor={(item) => item}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.breedRow}
                  onPress={() => {
                    setBreed(item)
                    setBreedOpen(false)
                  }}
                >
                  <Text style={styles.breedRowTxt}>{item}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.closeSheet} onPress={() => setBreedOpen(false)}>
              <Text style={styles.closeSheetTxt}>閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function PickerModal({
  visible,
  title,
  onClose,
  insetsBottom,
  data,
  onPick,
}: {
  visible: boolean
  title: string
  onClose: () => void
  insetsBottom: number
  data: string[]
  onPick: (s: string) => void
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={[styles.sheet, { paddingBottom: insetsBottom + 16 }]}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <Pressable style={styles.breedRow} onPress={() => onPick(item)}>
                <Text style={styles.breedRowTxt}>{item}</Text>
              </Pressable>
            )}
          />
          <Pressable style={styles.closeSheet} onPress={onClose}>
            <Text style={styles.closeSheetTxt}>閉じる</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  head: { paddingHorizontal: 16, paddingBottom: 8 },
  brand: { fontWeight: '800', color: colors.text, marginBottom: 12 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 30 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textLight, marginTop: 14, marginBottom: 6 },
  photoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.cardBg,
    color: colors.text,
  },
  inputLike: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.cardBg,
  },
  inputTxt: { fontSize: 15, color: colors.text },
  ph: { fontSize: 15, color: colors.textMuted },
  row2: { flexDirection: 'row', gap: 10 },
  half: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.cardBg,
  },
  halfTxt: { fontWeight: '700', color: colors.text },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.cardBg,
  },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.brand },
  chipTxt: { fontWeight: '700', color: colors.text },
  btn: {
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  btnOff: { opacity: 0.45 },
  btnTxt: { fontWeight: '800', fontSize: 16, color: colors.text },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  sheetTitle: { fontWeight: '800', fontSize: 16, marginBottom: 8, color: colors.text },
  breedRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  breedRowTxt: { fontSize: 15, color: colors.text },
  closeSheet: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  closeSheetTxt: { fontWeight: '700', color: colors.textLight },
})
