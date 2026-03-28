import * as ImagePicker from 'expo-image-picker'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
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
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/AppHeader'
import { RunningDog } from '@/components/DogStates'
import { IconPaw } from '@/components/IconPaw'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { OwnerBirthdayPickers, ownerBirthdayToYmd, splitYmdToParts } from '@/components/OwnerBirthdayPickers'
import { defaultBioFromDog } from '@/lib/default-bio'
import { supabase } from '@/lib/supabase'

type UserProfile = {
  id: string
  name: string
  parent_type: string | null
  photo_url: string | null
  bio: string | null
  /** あれば「パパ・31歳」形式に利用 */
  birthday?: string | null
}

type Dog = {
  id: string
  name: string
  breed: string | null
  birthday: string | null
  /** DB に無い既存ユーザーは null */
  gender?: 'male' | 'female' | null
  rabies_vaccinated_at: string | null
  vaccine_vaccinated_at: string | null
  photo_url: string | null
  rabies_vaccinated: boolean | null
  vaccine_vaccinated: boolean | null
}

const PARENT_OPTIONS = [
  { value: 'papa', label: 'パパ' },
  { value: 'mama', label: 'ママ' },
]

const IconCamera = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <Path d="M12 13a4 4 0 100-8 4 4 0 000 8z" />
  </Svg>
)

function AvatarCameraFab({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      style={styles.camFabOnAvatar}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <IconCamera size={18} />
    </Pressable>
  )
}

const IconEditSmall = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
)

const IconSyringe = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round">
    <Path d="M18 2l4 4M17 7l1-1M3 21l6-6M9 15l2-2M12 12l2-2M6 21c0-2 2-4 4-4M15 3l-6 6M15 3l3 3-7 7-3-3 7-7z" />
  </Svg>
)

function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmd(s: string): Date {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split('-').map(Number)
    const dt = new Date(y, mo - 1, da, 12, 0, 0)
    if (!Number.isNaN(dt.getTime())) return dt
  }
  return new Date()
}

/** 西暦・4桁年で表示（和暦・2桁年にしない。例: 2026年3月28日） */
function formatDateJaGregorian(ymd: string): string {
  if (!ymd) return ''
  const d = parseYmd(ymd)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}年${m}月${day}日`
}

/** DB の日付文字列を YYYY-MM-DD に正規化 */
function ymdFromDogField(s: string | null | undefined): string {
  if (!s) return ''
  const t = typeof s === 'string' ? s.trim() : ''
  if (!t) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return formatYmd(new Date(t))
}

/** 最終接種から1年経過で要再接種（狂犬病の表示用） */
function isVaccineYearExpired(ymd: string): boolean {
  if (!ymd) return false
  const d = parseYmd(ymd)
  const next = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())
  return new Date() > next
}

type VaccineStampKind = 'vaccinated' | 'due'

function computeVaccineStamp(
  ymd: string,
  flag: boolean,
  showRabiesExpiry: boolean
): VaccineStampKind | null {
  const hasDate = !!ymd
  if (showRabiesExpiry) {
    if (hasDate) return isVaccineYearExpired(ymd) ? 'due' : 'vaccinated'
    if (flag) return 'vaccinated'
    return null
  }
  if (hasDate || flag) return 'vaccinated'
  return null
}

/** 緑の「接種済」スタンプ（要更新の場合も同じ見た目） */
function VaccineStampMark() {
  return (
    <View style={styles.vaxStamp} accessibilityLabel="接種済">
      <Text style={styles.vaxStampTxt}>接種済</Text>
    </View>
  )
}

export default function MypageTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [dog, setDog] = useState<Dog | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingDog, setEditingDog] = useState(false)
  const [editingOwner, setEditingOwner] = useState(false)
  const [savingDog, setSavingDog] = useState(false)
  const [savingOwner, setSavingOwner] = useState(false)

  const [editDogName, setEditDogName] = useState('')
  const [editDogBreed, setEditDogBreed] = useState('')
  const [editDogBirthday, setEditDogBirthday] = useState('')
  const [editDogGender, setEditDogGender] = useState<'male' | 'female' | null>(null)
  const [editRabiesDate, setEditRabiesDate] = useState('')
  const [editVaccineDate, setEditVaccineDate] = useState('')
  const [vaccinePickerKind, setVaccinePickerKind] = useState<null | 'rabies' | 'mixed'>(null)
  const [vaccinePickerYear, setVaccinePickerYear] = useState('')
  const [vaccinePickerMonth, setVaccinePickerMonth] = useState('')
  const [vaccinePickerDay, setVaccinePickerDay] = useState('')
  const [dogPhotoPreview, setDogPhotoPreview] = useState<string | null>(null)
  const [dogPhotoUri, setDogPhotoUri] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editParentType, setEditParentType] = useState('papa')
  const [editBio, setEditBio] = useState('')
  const [editOwnerYear, setEditOwnerYear] = useState('')
  const [editOwnerMonth, setEditOwnerMonth] = useState('')
  const [editOwnerDay, setEditOwnerDay] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUri, setAvatarUri] = useState<string | null>(null)

  const ownerEditBirthdayYmd = ownerBirthdayToYmd(editOwnerYear, editOwnerMonth, editOwnerDay)
  const ownerEditBirthdayOk = ownerEditBirthdayYmd !== null

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/(auth)/login')
      return
    }
    const [{ data: userData }, { data: dogData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('dogs').select('*').eq('user_id', user.id).maybeSingle(),
    ])
    if (userData) setProfile(userData as UserProfile)
    if (dogData) setDog({ ...(dogData as Dog), gender: (dogData as { gender?: 'male' | 'female' | null }).gender ?? null })
    setLoading(false)
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!editingDog) setVaccinePickerKind(null)
  }, [editingDog])

  const startEditDog = () => {
    if (!dog) return
    setEditDogName(dog.name ?? '')
    setEditDogBreed(dog.breed ?? '')
    setEditDogBirthday(dog.birthday ?? '')
    setEditDogGender(dog.gender ?? null)
    setEditRabiesDate(dog.rabies_vaccinated_at ?? '')
    setEditVaccineDate(dog.vaccine_vaccinated_at ?? '')
    setDogPhotoPreview(null)
    setDogPhotoUri(null)
    setEditingDog(true)
  }

  const startEditOwner = () => {
    setEditName(profile?.name ?? '')
    setEditParentType(profile?.parent_type ?? 'papa')
    setEditBio(profile?.bio ?? '')
    const p = splitYmdToParts(profile?.birthday ?? null)
    setEditOwnerYear(p.y)
    setEditOwnerMonth(p.m)
    setEditOwnerDay(p.d)
    setAvatarPreview(null)
    setAvatarUri(null)
    setEditingOwner(true)
  }

  const pickDogPhoto = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!p.granted) return
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
    if (!r.canceled && r.assets[0]?.uri) {
      setDogPhotoUri(r.assets[0].uri)
      setDogPhotoPreview(r.assets[0].uri)
    }
  }

  const pickAvatar = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!p.granted) return
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
    if (!r.canceled && r.assets[0]?.uri) {
      setAvatarUri(r.assets[0].uri)
      setAvatarPreview(r.assets[0].uri)
    }
  }

  const saveDog = async () => {
    if (!dog || !profile) return
    setSavingDog(true)
    try {
      let dogPhotoUrl = dog.photo_url
      if (dogPhotoUri) {
        const resFetch = await fetch(dogPhotoUri)
        const buf = await resFetch.arrayBuffer()
        const path = `${profile.id}/dog.jpg`
        await supabase.storage.from('avatars').upload(path, buf, { upsert: true, contentType: 'image/jpeg' })
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        dogPhotoUrl = urlData.publicUrl
      }
      const { error: dogUpdateError } = await supabase
        .from('dogs')
        .update({
          name: editDogName.trim(),
          breed: editDogBreed.trim() || null,
          birthday: editDogBirthday || null,
          gender: editDogGender,
          rabies_vaccinated_at: editRabiesDate || null,
          vaccine_vaccinated_at: editVaccineDate || null,
          photo_url: dogPhotoUrl,
        })
        .eq('id', dog.id)
      if (dogUpdateError) {
        Alert.alert('保存に失敗しました（愛犬）', dogUpdateError.message)
        return
      }
      setDog((prev) =>
        prev
          ? {
              ...prev,
              name: editDogName.trim(),
              breed: editDogBreed.trim() || null,
              birthday: editDogBirthday || null,
              gender: editDogGender,
              rabies_vaccinated_at: editRabiesDate || null,
              vaccine_vaccinated_at: editVaccineDate || null,
              photo_url: dogPhotoUrl,
            }
          : prev
      )
      setEditingDog(false)
      setDogPhotoPreview(null)
      setDogPhotoUri(null)
    } finally {
      setSavingDog(false)
    }
  }

  const saveOwner = async () => {
    if (!profile) return
    const birthdayYmd = ownerEditBirthdayYmd
    if (!birthdayYmd) {
      Alert.alert('入力エラー', '生年月日は年・月・日すべて必須です。')
      return
    }
    setSavingOwner(true)
    try {
      let photoUrl = profile.photo_url
      if (avatarUri) {
        const resFetch = await fetch(avatarUri)
        const buf = await resFetch.arrayBuffer()
        const path = `${profile.id}/avatar.jpg`
        await supabase.storage.from('avatars').upload(path, buf, { upsert: true, contentType: 'image/jpeg' })
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }
      const { error: ownerSaveError } = await supabase.from('users').upsert({
        id: profile.id,
        name: editName.trim(),
        parent_type: editParentType,
        bio: editBio.trim() || null,
        birthday: birthdayYmd,
        photo_url: photoUrl,
      })
      if (ownerSaveError) {
        Alert.alert('保存に失敗しました（オーナー）', ownerSaveError.message)
        return
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: editName.trim(),
              parent_type: editParentType,
              bio: editBio.trim() || null,
              birthday: birthdayYmd,
              photo_url: photoUrl,
            }
          : prev
      )
      setEditingOwner(false)
      setAvatarPreview(null)
      setAvatarUri(null)
    } finally {
      setSavingOwner(false)
    }
  }

  const calcAge = (birthday: string) => {
    const birth = new Date(birthday)
    const now = new Date()
    const years = now.getFullYear() - birth.getFullYear()
    const months = now.getMonth() - birth.getMonth()
    if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) return `${years - 1}歳${months + 12}ヶ月`
    return years === 0 ? `${months}ヶ月` : `${years}歳${months}ヶ月`
  }

  const calcHumanAgeYears = (birthday: string) => {
    const birth = parseYmd(birthday)
    const now = new Date()
    let y = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) y -= 1
    return `${Math.max(0, y)}歳`
  }

  const parentLabel = (type: string | null) => PARENT_OPTIONS.find((o) => o.value === type)?.label ?? 'パパ'

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24
  /** 右下FABと被らないよう可動エリアの下余白 */
  const scrollPadBottom = padBottom + 64
  const eventFabBottom = TAB_BAR_HEIGHT + insets.bottom + 12
  const avatarSrc = avatarPreview ?? profile?.photo_url

  const persistVaccineDate = useCallback((kind: 'rabies' | 'mixed', ymd: string) => {
    if (!editingDog) return
    if (kind === 'rabies') setEditRabiesDate(ymd)
    else setEditVaccineDate(ymd)
  }, [editingDog])

  const openVaccinePicker = useCallback(
    (kind: 'rabies' | 'mixed') => {
      if (!dog || !editingDog) return
      const stored =
        kind === 'rabies'
          ? (editingDog ? editRabiesDate : dog.rabies_vaccinated_at)
          : (editingDog ? editVaccineDate : dog.vaccine_vaccinated_at)
      const ymd = ymdFromDogField(stored ?? '')
      const p = splitYmdToParts(ymd || null)
      setVaccinePickerYear(p.y)
      setVaccinePickerMonth(p.m)
      setVaccinePickerDay(p.d)
      setVaccinePickerKind(kind)
    },
    [dog, editingDog, editRabiesDate, editVaccineDate]
  )

  const confirmVaccinePicker = () => {
    if (vaccinePickerKind === null || !editingDog) return
    const ymd = ownerBirthdayToYmd(vaccinePickerYear, vaccinePickerMonth, vaccinePickerDay)
    persistVaccineDate(vaccinePickerKind, ymd ?? '')
    setVaccinePickerKind(null)
  }

  const renderVaccineSection = (row: {
    label: string
    kind: 'rabies' | 'mixed'
    editYmd: string
    storedAt: string | null
    vaccinatedFlag: boolean | null
    showRabiesExpiry: boolean
  }) => {
    const stored = editingDog ? row.editYmd : row.storedAt
    const ymd = ymdFromDogField(stored)
    const hasDate = !!ymd
    const flag = !!row.vaccinatedFlag
    const stampKind = computeVaccineStamp(ymd, flag, row.showRabiesExpiry)

    const primaryText = hasDate
      ? `${formatDateJaGregorian(ymd)}（前回）`
      : flag
        ? editingDog
          ? '接種日が未登録です（タップして登録）'
          : '接種日が未登録です'
        : editingDog
          ? '未登録（タップして登録）'
          : '未登録'

    const dateContent = (
      <Text
        style={[
          styles.datePickTxt,
          styles.vaccineDateSingleLine,
          styles.vaccineDateCenter,
          !hasDate && editingDog && styles.datePickPlaceholder,
          !editingDog && (hasDate ? styles.vacDateReadonlyTxt : styles.vacDateReadonlyTxtMuted),
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {primaryText}
      </Text>
    )

    return (
      <View style={styles.vaccineBlock}>
        <View style={styles.vaccineBlockTop}>
          <View style={styles.vaccineBlockTitleRow}>
            <IconSyringe />
            <Text style={styles.vLbl}>{row.label}</Text>
          </View>
          {stampKind ? <VaccineStampMark /> : null}
        </View>
        {editingDog ? (
          <Pressable
            style={[styles.datePickBtn, styles.vaccineBlockDateBtn]}
            onPress={() => openVaccinePicker(row.kind)}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}を選択`}
          >
            {dateContent}
          </Pressable>
        ) : (
          <View style={[styles.datePickBtn, styles.vaccineBlockDateBtn, styles.vacDateReadonly]}>{dateContent}</View>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadRoot}>
        <RunningDog label="プロフィールを読み込み中..." />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: scrollPadBottom, gap: 12 }}>
        {dog ? (
          <View style={styles.profileCard}>
            <View style={styles.profileCardHeader}>
              <Text style={styles.profileCardTitle}>愛犬</Text>
              {!editingDog ? (
                <Pressable style={styles.profileEditBtn} onPress={startEditDog} hitSlop={8} accessibilityLabel="愛犬プロフィールを編集">
                  <IconEditSmall />
                  <Text style={styles.profileEditBtnTxt}>編集</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.profileMainCol}>
              <View style={[styles.avatar80Wrap, editingDog && styles.avatar80WrapEditing]}>
                <View style={[styles.avatar80, styles.avatar80Dog]}>
                  {dogPhotoPreview ?? dog.photo_url ? (
                    <Image source={{ uri: dogPhotoPreview ?? dog.photo_url! }} style={styles.avatar80Img} resizeMode="cover" />
                  ) : (
                    <IconPaw size={36} color={colors.textMuted} />
                  )}
                </View>
                {editingDog ? (
                  <AvatarCameraFab onPress={() => void pickDogPhoto()} accessibilityLabel="愛犬の写真を変更" />
                ) : null}
              </View>
              {editingDog ? (
                <View style={[styles.profileEditFields, styles.profileEditFieldsAfterAvatar]}>
                  <TextInput
                    style={styles.inp}
                    value={editDogName}
                    onChangeText={setEditDogName}
                    placeholder="名前"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TextInput
                    style={styles.inp}
                    value={editDogBreed}
                    onChangeText={setEditDogBreed}
                    placeholder="犬種"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.miniLbl}>誕生日（YYYY-MM-DD）</Text>
                  <TextInput
                    style={styles.inp}
                    value={editDogBirthday}
                    onChangeText={setEditDogBirthday}
                    placeholder="2020-01-01"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.miniLbl}>性別</Text>
                  <View style={styles.genderPickRow}>
                    <Pressable
                      style={[styles.genderPickChip, editDogGender === 'male' && styles.genderPickChipOn]}
                      onPress={() => setEditDogGender('male')}
                    >
                      <Text style={styles.genderSymMale}>♂</Text>
                      <Text style={styles.genderPickChipLbl}>オス</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.genderPickChip, editDogGender === 'female' && styles.genderPickChipOn]}
                      onPress={() => setEditDogGender('female')}
                    >
                      <Text style={styles.genderSymFemale}>♀</Text>
                      <Text style={styles.genderPickChipLbl}>メス</Text>
                    </Pressable>
                    <Pressable style={[styles.genderPickChip, editDogGender === null && styles.genderPickChipOn]} onPress={() => setEditDogGender(null)}>
                      <Text style={styles.genderPickChipLblMuted}>未設定</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.profileName}>{dog.name}</Text>
                  {dog.breed?.trim() ? (
                    <Text style={styles.profileSub} numberOfLines={1}>
                      {dog.breed.trim()}
                    </Text>
                  ) : null}
                  {dog.birthday?.trim() || dog.gender ? (
                    <View style={styles.profileAgeGenderRow}>
                      {dog.gender === 'male' ? (
                        <Text style={[styles.genderSymMale, styles.dogProfileGenderLine]}>♂</Text>
                      ) : dog.gender === 'female' ? (
                        <Text style={[styles.genderSymFemale, styles.dogProfileGenderLine]}>♀</Text>
                      ) : null}
                      {dog.birthday?.trim() ? <Text style={styles.dogProfileAgeLine}>{calcAge(dog.birthday)}</Text> : null}
                    </View>
                  ) : null}
                </>
              )}
            </View>
            <View style={styles.profileDivider} />
            {editingDog ? (
              <View style={styles.vaccineBlocksWrap}>
                {renderVaccineSection({
                  label: '混合ワクチン接種日',
                  kind: 'mixed',
                  editYmd: editVaccineDate,
                  storedAt: dog.vaccine_vaccinated_at,
                  vaccinatedFlag: dog.vaccine_vaccinated,
                  showRabiesExpiry: false,
                })}
                {renderVaccineSection({
                  label: '狂犬病ワクチン接種日',
                  kind: 'rabies',
                  editYmd: editRabiesDate,
                  storedAt: dog.rabies_vaccinated_at,
                  vaccinatedFlag: dog.rabies_vaccinated,
                  showRabiesExpiry: true,
                })}
              </View>
            ) : (
              <View style={styles.vaccineBlocksWrap}>
                {(() => {
                  const ymdM = ymdFromDogField(dog.vaccine_vaccinated_at ?? '')
                  const stampM = computeVaccineStamp(ymdM, !!dog.vaccine_vaccinated, false)
                  const dateM = ymdM ? `${formatDateJaGregorian(ymdM)}（前回）` : '未登録'
                  return (
                    <View style={styles.vaccineBlock}>
                      <View style={styles.vaccineBlockTop}>
                        <View style={styles.vaccineBlockTitleRow}>
                          <IconSyringe />
                          <Text style={styles.vaccineSummaryLbl}>混合ワクチン</Text>
                        </View>
                        {stampM ? <VaccineStampMark /> : null}
                      </View>
                      <Text style={styles.vaccineBlockDateReadonly} numberOfLines={1} ellipsizeMode="tail">
                        {dateM}
                      </Text>
                    </View>
                  )
                })()}
                {(() => {
                  const ymdR = ymdFromDogField(dog.rabies_vaccinated_at ?? '')
                  const stampR = computeVaccineStamp(ymdR, !!dog.rabies_vaccinated, true)
                  const dateR = ymdR ? `${formatDateJaGregorian(ymdR)}（前回）` : '未登録'
                  return (
                    <View style={styles.vaccineBlock}>
                      <View style={styles.vaccineBlockTop}>
                        <View style={styles.vaccineBlockTitleRow}>
                          <IconSyringe />
                          <Text style={styles.vaccineSummaryLbl}>狂犬病ワクチン</Text>
                        </View>
                        {stampR ? <VaccineStampMark /> : null}
                      </View>
                      <Text style={styles.vaccineBlockDateReadonly} numberOfLines={1} ellipsizeMode="tail">
                        {dateR}
                      </Text>
                    </View>
                  )
                })()}
              </View>
            )}
            {editingDog ? (
              <View style={styles.btnRow}>
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => {
                    setVaccinePickerKind(null)
                    setEditingDog(false)
                  }}
                >
                  <Text style={styles.btnGhostTxt}>キャンセル</Text>
                </Pressable>
                <Pressable style={styles.btnPri} onPress={() => void saveDog()} disabled={savingDog}>
                  <Text style={styles.btnPriTxt}>{savingDog ? '保存中...' : '保存する'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.profileCard}>
          <View style={styles.profileCardHeader}>
            <Text style={styles.profileCardTitle}>オーナー</Text>
            {!editingOwner ? (
              <Pressable style={styles.profileEditBtn} onPress={startEditOwner} hitSlop={8} accessibilityLabel="オーナープロフィールを編集">
                <IconEditSmall />
                <Text style={styles.profileEditBtnTxt}>編集</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.profileMainCol}>
            <View style={[styles.avatar80Wrap, editingOwner && styles.avatar80WrapEditing]}>
              <View style={[styles.avatar80, styles.avatar80Owner]}>
                {avatarSrc ? (
                  <Image source={{ uri: avatarSrc }} style={styles.avatar80Img} resizeMode="cover" />
                ) : (
                  <Ionicons name="person-outline" size={28} color={colors.textMuted} />
                )}
              </View>
              {editingOwner ? (
                <AvatarCameraFab onPress={() => void pickAvatar()} accessibilityLabel="プロフィール写真を変更" />
              ) : null}
            </View>
            {editingOwner ? (
              <View style={[styles.profileEditFields, styles.profileEditFieldsAfterAvatar]}>
                <TextInput
                  style={styles.inp}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="名前"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.parentRow}>
                  {PARENT_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.parentChip, editParentType === opt.value && styles.parentChipOn]}
                      onPress={() => setEditParentType(opt.value)}
                    >
                      <Text style={[styles.parentChipTxt, editParentType === opt.value && styles.parentChipTxtOn]}>{opt.label}</Text>
                    </Pressable>
                    ))}
                  </View>
                  <OwnerBirthdayPickers
                    year={editOwnerYear}
                    month={editOwnerMonth}
                    day={editOwnerDay}
                    onChangeYear={setEditOwnerYear}
                    onChangeMonth={setEditOwnerMonth}
                    onChangeDay={setEditOwnerDay}
                  />
                </View>
              ) : (
              <>
                <Text style={styles.profileName}>{profile?.name ?? '名前未設定'}</Text>
                <View style={styles.profileAgeGenderRow}>
                  <Text
                    style={[
                      styles.ownerProfilePairText,
                      profile?.parent_type === 'mama' ? styles.parentRoleMama : styles.parentRolePapa,
                    ]}
                  >
                    {parentLabel(profile?.parent_type ?? null)}
                  </Text>
                  {profile?.birthday?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthday.trim()) ? (
                    <Text style={[styles.ownerProfilePairText, styles.ownerProfileAgeText]}>{calcHumanAgeYears(profile.birthday)}</Text>
                  ) : (
                    <Text style={[styles.ownerProfilePairText, styles.ownerProfileAgeText]}>-</Text>
                  )}
                </View>
              </>
            )}
          </View>
          {editingOwner ? (
            <TextInput
              style={[styles.inp, styles.bioInp]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="自己紹介（任意）"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          ) : (
            <>
              <View style={styles.profileDivider} />
              <Text style={styles.ownerBioDisplay}>
                {(profile?.bio && profile.bio.trim())
                  ? profile.bio
                  : defaultBioFromDog({ name: dog?.name, breed: dog?.breed })}
              </Text>
            </>
          )}
          {editingOwner ? (
            <View style={styles.btnRow}>
              <Pressable style={styles.btnGhost} onPress={() => setEditingOwner(false)}>
                <Text style={styles.btnGhostTxt}>キャンセル</Text>
              </Pressable>
                <Pressable
                  style={[styles.btnPri, !ownerEditBirthdayOk && styles.btnPriDis]}
                  onPress={() => void saveOwner()}
                  disabled={savingOwner || !ownerEditBirthdayOk}
                >
                  <Text style={styles.btnPriTxt}>{savingOwner ? '保存中...' : '保存する'}</Text>
                </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.evTitle}>いいねしたスポット</Text>
          <Text style={styles.evDesc}>お気に入りにしたスポットの一覧を確認できます</Text>
          <Pressable style={styles.evCta} onPress={() => router.push('/likes')} accessibilityLabel="いいね一覧へ">
            <Text style={styles.evCtaTxt}>いいね一覧へ</Text>
          </Pressable>
          <View style={styles.listSplitDivider} />
          <Text style={styles.evTitle}>行ったスポット</Text>
          <Text style={styles.evDesc}>チェックインしたスポットの一覧を確認できます</Text>
          <Pressable style={styles.evCta} onPress={() => router.push('/checkins')} accessibilityLabel="行った一覧へ">
            <Text style={styles.evCtaTxt}>行った一覧へ</Text>
          </Pressable>
          <View style={styles.listSplitDivider} />
          <Text style={styles.evTitle}>主催したイベント</Text>
          <Text style={styles.evDesc}>作成したイベントの一覧・編集はこちらから</Text>
          <Pressable style={styles.evCta} onPress={() => router.push('/mypage/events')}>
            <Text style={styles.evCtaTxt}>イベント管理へ</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.eventNewFab, { bottom: eventFabBottom }]}
        onPress={() => router.push('/events/new')}
        accessibilityRole="button"
        accessibilityLabel="イベントを新規作成"
      >
        <Ionicons name="add" size={30} color={colors.text} />
      </Pressable>

      {vaccinePickerKind !== null ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setVaccinePickerKind(null)}>
          <View style={styles.pickerOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setVaccinePickerKind(null)} />
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>
                {vaccinePickerKind === 'rabies' ? '狂犬病ワクチン接種日' : '混合ワクチン接種日'}
              </Text>
              <OwnerBirthdayPickers
                fieldLabel=""
                hint={null}
                year={vaccinePickerYear}
                month={vaccinePickerMonth}
                day={vaccinePickerDay}
                onChangeYear={setVaccinePickerYear}
                onChangeMonth={setVaccinePickerMonth}
                onChangeDay={setVaccinePickerDay}
              />
              <View style={styles.pickerActions}>
                <Pressable style={styles.pickerGhost} onPress={() => setVaccinePickerKind(null)}>
                  <Text style={styles.pickerGhostTxt}>キャンセル</Text>
                </Pressable>
                <Pressable style={styles.pickerPri} onPress={confirmVaccinePicker}>
                  <Text style={styles.pickerPriTxt}>決定</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  /** タブバー直上・画面右下（マイページの可動エリア基準） */
  eventNewFab: {
    position: 'absolute',
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.brandButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 20,
  },
  loadRoot: { flex: 1, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  profileCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    minHeight: 28,
  },
  profileCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 3,
  },
  profileEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  profileEditBtnTxt: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  profileMainCol: { alignItems: 'center', width: '100%' },
  profileAgeGenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  /** 編集チップ内の ♂♀（大きめ） */
  genderSymMale: { fontSize: 17, fontWeight: '800', color: colors.genderMale },
  genderSymFemale: { fontSize: 17, fontWeight: '800', color: colors.genderFemale },
  /** カード表示：年齢と同じ行高 */
  dogProfileGenderLine: { fontSize: 14, lineHeight: 20 },
  dogProfileAgeLine: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textMuted },
  parentRolePapa: { color: colors.genderMale },
  parentRoleMama: { color: colors.genderFemale },
  ownerProfilePairText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  ownerProfileAgeText: { color: colors.textMuted },
  genderPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  genderPickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  genderPickChipOn: { borderColor: colors.brandDark, backgroundColor: colors.brandButton },
  genderPickChipLbl: { fontSize: 12, fontWeight: '700', color: colors.text },
  genderPickChipLblMuted: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  profileEditFields: { alignSelf: 'stretch', width: '100%', gap: 8, marginTop: 4 },
  /** 編集時（愛犬・オーナー共通）：カメラFABがはみ出す分、先頭入力との間を空ける */
  avatar80WrapEditing: { marginBottom: 12 },
  profileEditFieldsAfterAvatar: { marginTop: 14 },
  avatar80Wrap: { position: 'relative', width: 80, height: 80, marginTop: 4 },
  avatar80: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar80Dog: { backgroundColor: colors.dogPhotoPlaceholderBg },
  avatar80Owner: { backgroundColor: colors.cardBg },
  avatar80Img: { width: '100%', height: '100%' },
  camFabOnAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2.5,
    elevation: 4,
  },
  profileName: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  profileSub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  profileDivider: { height: 1, backgroundColor: colors.border, marginTop: 20, alignSelf: 'stretch', width: '100%' },
  vaccineBlocksWrap: { gap: 10, marginTop: 4, alignSelf: 'stretch', width: '100%' },
  vaccineBlock: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vaccineBlockTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  vaccineBlockTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vaccineSummaryLbl: { fontSize: 13, color: colors.textMuted, fontWeight: '700', flexShrink: 1 },
  vaccineBlockDateBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaccineBlockDateReadonly: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLight,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  vaccineDateSingleLine: { flexShrink: 1 },
  vaccineDateCenter: { textAlign: 'center', alignSelf: 'stretch', width: '100%' },
  vaxStamp: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.successMutedBg,
    flexShrink: 0,
  },
  vaxStampTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.success,
  },
  ownerBioDisplay: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 21,
    alignSelf: 'stretch',
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 16 },
  vLbl: { fontSize: 12, fontWeight: '800', color: colors.textMuted, flexShrink: 1 },
  inp: {
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  datePickBtn: {
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePickTxt: { fontSize: 15, fontWeight: '600', color: colors.text },
  datePickPlaceholder: { fontWeight: '500', color: colors.textMuted },
  /** 編集モード外：タップ不可の見た目（枠・文字を弱く） */
  vacDateReadonly: { borderColor: '#f2f2f2', backgroundColor: '#fafafa' },
  vacDateReadonlyTxt: { color: colors.textLight, fontWeight: '500' },
  vacDateReadonlyTxtMuted: { color: colors.textMuted, fontWeight: '500' },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 10, textAlign: 'center' },
  pickerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pickerGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  pickerGhostTxt: { fontSize: 14, fontWeight: '800', color: colors.textLight },
  pickerPri: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.brandButton,
    alignItems: 'center',
  },
  pickerPriTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  miniLbl: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  btnGhostTxt: { fontSize: 14, fontWeight: '800', color: colors.textLight },
  btnPri: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.brandButton,
    alignItems: 'center',
  },
  btnPriDis: { opacity: 0.45 },
  btnPriTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  parentRow: { flexDirection: 'row', gap: 8 },
  parentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
  },
  parentChipOn: { backgroundColor: colors.brandButton },
  parentChipTxt: { fontSize: 12, fontWeight: '800', color: colors.textLight },
  parentChipTxtOn: { color: colors.text },
  bioInp: { marginTop: 12, minHeight: 72, textAlignVertical: 'top' },
  evTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  evDesc: { fontSize: 12, color: colors.textLight, lineHeight: 18, marginBottom: 12 },
  evCta: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.brandButton,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brandDark,
  },
  evCtaTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  listSplitDivider: { height: 1, backgroundColor: colors.border, marginTop: 20, marginBottom: 4 },
})
