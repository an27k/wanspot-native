import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMemo, useState } from 'react'
import { Image } from 'expo-image'
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  dogBirthdayYearBounds,
  OwnerBirthdayPickers,
  ownerBirthdayToYmd,
} from '@/components/OwnerBirthdayPickers'
import { DogSizeSegments, type DogSizeKey } from '@/components/onboarding/DogSizeSegments'
import { FormField } from '@/components/onboarding/FormField'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { TapSelectRow } from '@/components/onboarding/TapSelectRow'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { DOG_BREED_QUICK_PICKS, filterDogBreeds } from '@/lib/dog-breeds'
import { showImagePickerOptions } from '@/lib/image-picker'
import { OB_DOG_KEY } from '@/lib/onboarding-constants'
import { setWalkTimeHour as setWalkTimePref, WALK_TIME_CHOICES } from '@/lib/weather/walk-time-pref'
import { supabase } from '@/lib/supabase'

function formatBirthdayLabel(y: string, m: string, d: string): string {
  const ymd = ownerBirthdayToYmd(y, m, d)
  if (!ymd) return ''
  const [, mo, da] = ymd.split('-')
  return `${y}年${Number(mo)}月${Number(da)}日`
}

export default function DogPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)

  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [size, setSize] = useState<DogSizeKey | null>(null)
  /** いつものお散歩時間（任意回答）。picked=false のまま送信された場合は保存しない */
  const [walkTimeHour, setWalkTimeHour] = useState<number | null>(null)
  const [walkTimePicked, setWalkTimePicked] = useState(false)
  const [dogYear, setDogYear] = useState('')
  const [dogMonth, setDogMonth] = useState('')
  const [dogDay, setDogDay] = useState('')
  const [dogPhotoUri, setDogPhotoUri] = useState<string | null>(null)
  const [vaccineCombo, setVaccineCombo] = useState<boolean | null>(null)
  const [vaccineRabies, setVaccineRabies] = useState<boolean | null>(null)
  const [comboY, setComboY] = useState('')
  const [comboM, setComboM] = useState('')
  const [comboD, setComboD] = useState('')
  const [rabiesY, setRabiesY] = useState('')
  const [rabiesM, setRabiesM] = useState('')
  const [rabiesD, setRabiesD] = useState('')
  const [breedModal, setBreedModal] = useState(false)
  const [breedQuery, setBreedQuery] = useState('')
  const [birthdayModal, setBirthdayModal] = useState(false)
  const [vaccineDateModal, setVaccineDateModal] = useState<'combo' | 'rabies' | null>(null)
  const [vaccineExpanded, setVaccineExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const dogYBounds = dogBirthdayYearBounds()
  const breedHits = useMemo(() => filterDogBreeds(breedQuery), [breedQuery])

  // 誕生日は任意。Apple が 5.1.1(v) で「生年月日を必須にしている」として却下した（2026-08-05・ビルド230）。
  // アプリの中核機能（近くのスポット検索）は誕生日なしで成立するので、必須にしてはいけない。
  // 年齢はプロフィールと VLOG の記念日で使うだけなので、あとから入れてもらえば足りる。
  const canNext = !!name.trim() && !!breed && size !== null

  const handlePickDogPhoto = () => {
    showImagePickerOptions(async (image) => {
      setDogPhotoUri(image.uri)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const userId = user?.id
        if (!userId) {
          Alert.alert('エラー', 'ログインが必要です')
          return
        }
        // 退会時のストレージ削除は avatars/{userId}/ 配下しか列挙しない。
        // dogs/ に置くと写真が消し残るため、per-user フォルダに揃える
        const filePath = `${userId}/dog-${Date.now()}.jpg`
        const response = await fetch(image.uri)
        const arrayBuffer = await response.arrayBuffer()
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          // 毎回一意なパスなので上書きは不要。upsert は SELECT 権限も要求する。
          .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false })
        if (uploadError) {
          Alert.alert('エラー', '写真のアップロードに失敗しました')
          setDogPhotoUri(null)
          return
        }
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        const prev = JSON.parse((await AsyncStorage.getItem(OB_DOG_KEY)) || '{}')
        await AsyncStorage.setItem(
          OB_DOG_KEY,
          JSON.stringify({ ...prev, photo_url: data.publicUrl })
        )
      } catch {
        Alert.alert('エラー', '写真のアップロードに失敗しました')
        setDogPhotoUri(null)
      }
    })
  }

  const goNext = async () => {
    if (!canNext || submitting) return
    setSubmitting(true)
    try {
      const prev = JSON.parse((await AsyncStorage.getItem(OB_DOG_KEY)) || '{}')
      const prevPhotoUrl = typeof prev?.photo_url === 'string' ? prev.photo_url : null
      const comboDate =
        vaccineCombo === true ? ownerBirthdayToYmd(comboY, comboM, comboD) : null
      const rabiesDate =
        vaccineRabies === true ? ownerBirthdayToYmd(rabiesY, rabiesM, rabiesD) : null

      await AsyncStorage.setItem(
        OB_DOG_KEY,
        JSON.stringify({
          name: name.trim(),
          year: dogYear,
          month: dogMonth,
          day: dogDay,
          breed,
          size,
          vaccineCombo,
          vaccineRabies,
          vaccineComboDate: comboDate,
          vaccineRabiesDate: rabiesDate,
          ...(prevPhotoUrl ? { photo_url: prevPhotoUrl } : {}),
        })
      )
      // いつものお散歩時間 → お散歩予報の通知時刻に反映（未回答はデフォルトの朝5時運用）
      if (walkTimePicked) await setWalkTimePref(walkTimeHour)
      // 位置情報はオンボの最後に聞く。入力が終わった直後にアプリ本体へ落とすと
      // 「これで終わり？」と不安になるため、あの画面をクッションとして挟む
      router.push('/onboarding/location')
    } finally {
      setSubmitting(false)
    }
  }

  const padBottom = insets.bottom + 24
  const padTop = insets.top + 16

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: padTop, paddingBottom: padBottom + CTA_HEIGHT },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingStepHeader step={1} />

        <Text style={styles.title}>愛犬のことを{'\n'}教えてください</Text>
        <Text style={styles.sub}>
          プロフィールに使います。あとからいつでも変更できます。
        </Text>

        <View style={styles.photoSection}>
          <Pressable
            onPress={handlePickDogPhoto}
            style={({ pressed }) => [styles.photoCircle, pressed && styles.photoCirclePressed]}
          >
            {dogPhotoUri ? (
              <Image
                source={{ uri: dogPhotoUri }}
                style={styles.photoPreview}
                contentFit="cover"
                {...remoteImageExpoProps}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={28} color={colors.primary} />
              </View>
            )}
          </Pressable>
          <Text style={styles.photoLabel}>
            {dogPhotoUri ? '写真を変更' : '写真を追加（任意）'}
          </Text>
        </View>

        <FormField label="名前" required>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="例: モカ"
            placeholderTextColor={colors.textSecondary}
            style={styles.textInput}
            returnKeyType="next"
          />
        </FormField>

        <FormField label="犬種" required>
          <TapSelectRow
            label="犬種"
            value={breed}
            placeholder="タップして犬種を選ぶ"
            onPress={() => {
              setBreedQuery('')
              setBreedModal(true)
            }}
          />
        </FormField>

        <FormField label="サイズ" required hint="選ぶと体重・体高の目安が表示されます">
          <DogSizeSegments value={size} onChange={setSize} />
        </FormField>

        <FormField label="いつものお散歩時間" hint="お散歩予報の通知時刻に使います（あとから設定で変更できます）">
          <View style={styles.walkTimeChips}>
            {WALK_TIME_CHOICES.map((c) => {
              const on = walkTimeHour === c.hour && walkTimePicked
              return (
                <Pressable
                  key={c.label}
                  style={[styles.walkTimeChip, on && styles.walkTimeChipOn]}
                  onPress={() => {
                    setWalkTimeHour(c.hour)
                    setWalkTimePicked(true)
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.walkTimeChipTxt, on && styles.walkTimeChipTxtOn]}>{c.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </FormField>

        {/*
          必須にしないこと。Apple が 5.1.1(v) で却下した箇所（2026-08-05・ビルド230）。
          審査員には「アプリが生年月日の入力を要求している」と読まれる。
        */}
        <FormField label="誕生日（任意）" hint="お誕生日をお祝いしたいので、わかる範囲で。あとからでも入れられます">
          <TapSelectRow
            label="誕生日"
            value={formatBirthdayLabel(dogYear, dogMonth, dogDay)}
            placeholder="タップして日付を選ぶ"
            onPress={() => setBirthdayModal(true)}
          />
        </FormField>

        <View style={styles.vaccineWrap}>
          <Pressable
            style={styles.vaccineHead}
            onPress={() => setVaccineExpanded((v) => !v)}
          >
            <Text style={styles.vaccineTitle}>ワクチン（任意）</Text>
            <Text style={styles.vaccineHint}>あとから設定でも大丈夫です</Text>
            <Ionicons
              name={vaccineExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
              style={styles.vaccineChevron}
            />
          </Pressable>

          {vaccineExpanded ? (
            <View style={styles.vaccineBody}>
              <Text style={styles.vaccineLbl}>混合ワクチン</Text>
              <View style={styles.row2}>
                {([true, false] as const).map((v) => {
                  const on = vaccineCombo === v
                  return (
                    <Pressable
                      key={String(v)}
                      onPress={() => setVaccineCombo(v)}
                      style={[styles.optionHalf, on && styles.optionHalfOn]}
                    >
                      <Text style={[styles.optionHalfTxt, on && styles.optionHalfTxtOn]}>
                        {v ? '済' : '未'}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              {vaccineCombo === true ? (
                <TapSelectRow
                  subdued
                  label="混合ワクチン接種日（任意）"
                  value={formatBirthdayLabel(comboY, comboM, comboD)}
                  placeholder="わかる範囲でOK"
                  onPress={() => setVaccineDateModal('combo')}
                />
              ) : null}

              <Text style={[styles.vaccineLbl, { marginTop: 12 }]}>狂犬病ワクチン</Text>
              <View style={styles.row2}>
                {([true, false] as const).map((v) => {
                  const on = vaccineRabies === v
                  return (
                    <Pressable
                      key={String(v)}
                      onPress={() => setVaccineRabies(v)}
                      style={[styles.optionHalf, on && styles.optionHalfOn]}
                    >
                      <Text style={[styles.optionHalfTxt, on && styles.optionHalfTxtOn]}>
                        {v ? '済' : '未'}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              {vaccineRabies === true ? (
                <TapSelectRow
                  subdued
                  label="狂犬病接種日（任意）"
                  value={formatBirthdayLabel(rabiesY, rabiesM, rabiesD)}
                  placeholder="わかる範囲でOK"
                  onPress={() => setVaccineDateModal('rabies')}
                />
              ) : null}
            </View>
          ) : null}
        </View>
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

      <Modal visible={breedModal} transparent animationType="slide" onRequestClose={() => setBreedModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setBreedModal(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>犬種を選ぶ</Text>
            <TextInput
              style={styles.searchInp}
              value={breedQuery}
              onChangeText={setBreedQuery}
              placeholder="犬種名で検索"
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
            />
            {/*
              112件のリストは検索しないと辿り着けない。登録頭数の上位は少数の犬種に
              集中しているので、先に見せるだけで大半の飼い主が検索せずに選べる。
              「わからない」を並べるのも重要で、保護犬や雑種の飼い主がここで
              詰まって離脱するのを防ぐ。検索中は候補の邪魔になるので隠す。
            */}
            {breedQuery.trim() === '' ? (
              <View style={styles.quickPicks}>
                {DOG_BREED_QUICK_PICKS.map((b) => (
                  <Pressable
                    key={b}
                    style={[styles.quickChip, breed === b && styles.quickChipOn]}
                    onPress={() => {
                      setBreed(b)
                      setBreedModal(false)
                    }}
                  >
                    <Text style={[styles.quickChipTxt, breed === b && styles.quickChipTxtOn]}>{b}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <FlatList
              data={breedHits}
              keyExtractor={(item) => item}
              style={styles.breedList}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.breedEmpty}>候補が見つかりません。別の表記で検索してください。</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.breedRow, breed === item && styles.breedRowOn]}
                  onPress={() => {
                    setBreed(item)
                    setBreedModal(false)
                  }}
                >
                  <Text style={styles.breedRowTxt}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={vaccineDateModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVaccineDateModal(null)}
      >
        <View style={styles.modalRootCenter}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setVaccineDateModal(null)} />
          <View style={styles.modalCardCenter}>
            <Text style={styles.modalTitle}>
              {vaccineDateModal === 'rabies' ? '狂犬病ワクチン接種日' : '混合ワクチン接種日'}
            </Text>
            <View style={styles.birthdayCard}>
              <OwnerBirthdayPickers
                compact
                fieldLabel=""
                hint=""
                year={vaccineDateModal === 'rabies' ? rabiesY : comboY}
                month={vaccineDateModal === 'rabies' ? rabiesM : comboM}
                day={vaccineDateModal === 'rabies' ? rabiesD : comboD}
                onChangeYear={vaccineDateModal === 'rabies' ? setRabiesY : setComboY}
                onChangeMonth={vaccineDateModal === 'rabies' ? setRabiesM : setComboM}
                onChangeDay={vaccineDateModal === 'rabies' ? setRabiesD : setComboD}
                yearMin={dogYBounds.min}
                yearMax={dogYBounds.max}
              />
            </View>
            <Pressable style={styles.modalDone} onPress={() => setVaccineDateModal(null)}>
              <Text style={styles.modalDoneTxt}>決定</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={birthdayModal} transparent animationType="fade" onRequestClose={() => setBirthdayModal(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setBirthdayModal(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>誕生日</Text>
            <Text style={styles.modalHint}>正確な日付がわからない場合は、推定でOK</Text>
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
                fieldLabel=""
                hint=""
              />
            </View>
            <Pressable style={styles.modalDone} onPress={() => setBirthdayModal(false)}>
              <Text style={styles.modalDoneTxt}>決定</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const CTA_HEIGHT = 92

const createStyles = (colors: AppColors) => StyleSheet.create({
  walkTimeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  walkTimeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  walkTimeChipOn: { borderColor: colors.primary, backgroundColor: colors.tintWeak },
  walkTimeChipTxt: { ...type.label, color: colors.textSecondary },
  walkTimeChipTxtOn: { color: colors.primary },
  container: { flex: 1, backgroundColor: colors.paper },
  scrollContent: { paddingHorizontal: 20 },
  title: {
    ...type.title,
    color: colors.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  sub: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  photoSection: { alignItems: 'center', marginBottom: 28 },
  photoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.tintWeak,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  photoCirclePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  photoLabel: { ...type.caption, color: colors.textSecondary },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...type.row,
    color: colors.textPrimary,
  },
  vaccineWrap: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  vaccineHead: { padding: 16 },
  // 任意項目を畳んである節。heading(20) に上げると必須の入力より目立つので label に寄せる
  vaccineTitle: { ...type.label, color: colors.textSecondary },
  vaccineHint: { ...type.caption, color: colors.textSecondary, marginTop: 4 },
  vaccineChevron: { position: 'absolute', right: 16, top: 18 },
  vaccineBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  vaccineLbl: { ...type.label, color: colors.textSecondary },
  row2: { flexDirection: 'row', gap: 10 },
  optionHalf: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionHalfOn: { backgroundColor: colors.tintWeak, borderColor: colors.primary },
  optionHalfTxt: { ...type.button, color: colors.textSecondary },
  optionHalfTxtOn: { color: colors.primary },
  ctaContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaButtonDisabled: { backgroundColor: colors.border },
  ctaButtonPressed: { backgroundColor: colors.brandDark, transform: [{ scale: 0.98 }] },
  ctaText: { ...type.button, color: colors.onPrimary },
  ctaTextDisabled: { color: colors.textSecondary },
  modalRoot: { flex: 1, backgroundColor: colors.overlayScrim, justifyContent: 'flex-end' },
  modalRootCenter: { flex: 1, backgroundColor: colors.overlayScrim, justifyContent: 'center', padding: 20 },
  modalCardCenter: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: { ...type.title, color: colors.textPrimary, marginBottom: 12 },
  modalHint: { ...type.caption, color: colors.textSecondary, marginBottom: 12 },
  searchInp: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...type.row,
    color: colors.textPrimary,
    backgroundColor: colors.paper,
    marginBottom: 8,
  },
  quickPicks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickChipOn: { borderColor: colors.primary, backgroundColor: colors.tintWeak },
  quickChipTxt: { ...type.label, color: colors.textSecondary },
  quickChipTxtOn: { color: colors.primary },
  breedList: { maxHeight: 320 },
  breedEmpty: { paddingVertical: 18, ...type.caption, color: colors.textSecondary, textAlign: 'center' as const },
  breedRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  breedRowOn: { backgroundColor: colors.tintWeak },
  breedRowTxt: { ...type.row, color: colors.textPrimary },
  birthdayCard: {
    backgroundColor: colors.paper,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalDone: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneTxt: { ...type.button, color: colors.onPrimary },
})
