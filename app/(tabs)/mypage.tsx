import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useEffect, useState } from 'react'
import {
  Image,
  Modal,
  Platform,
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
import { defaultBioFromDog } from '@/lib/default-bio'
import { supabase } from '@/lib/supabase'

type UserProfile = {
  id: string
  name: string
  parent_type: string | null
  photo_url: string | null
  bio: string | null
}

type Dog = {
  id: string
  name: string
  breed: string | null
  birthday: string | null
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

const IconCamera = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <Path d="M12 13a4 4 0 100-8 4 4 0 000 8z" />
  </Svg>
)

const IconEdit = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
)

const IconSyringe = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round">
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

/** 未登録時ピッカーの初期日（当年1月1日・西暦20xx） */
function defaultVaccinePickerDate(): Date {
  const y = new Date().getFullYear()
  return new Date(y, 0, 1, 12, 0, 0)
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

export default function MypageTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [dog, setDog] = useState<Dog | null>(null)
  const [likeCount, setLikeCount] = useState(0)
  const [checkInCount, setCheckInCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editingDog, setEditingDog] = useState(false)
  const [editingOwner, setEditingOwner] = useState(false)
  const [savingDog, setSavingDog] = useState(false)
  const [savingOwner, setSavingOwner] = useState(false)

  const [editDogName, setEditDogName] = useState('')
  const [editDogBreed, setEditDogBreed] = useState('')
  const [editDogBirthday, setEditDogBirthday] = useState('')
  const [editRabiesDate, setEditRabiesDate] = useState('')
  const [editVaccineDate, setEditVaccineDate] = useState('')
  const [vaccinePickerKind, setVaccinePickerKind] = useState<null | 'rabies' | 'mixed'>(null)
  const [vaccinePickerTemp, setVaccinePickerTemp] = useState(() => defaultVaccinePickerDate())
  const [dogPhotoPreview, setDogPhotoPreview] = useState<string | null>(null)
  const [dogPhotoUri, setDogPhotoUri] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editParentType, setEditParentType] = useState('papa')
  const [editBio, setEditBio] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUri, setAvatarUri] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/(auth)/login')
      return
    }
    const [{ data: userData }, { data: dogData }, { count: likeC }, { count: checkC }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('dogs').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('spot_likes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('check_ins').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    if (userData) setProfile(userData as UserProfile)
    if (dogData) setDog(dogData as Dog)
    setLikeCount(likeC ?? 0)
    setCheckInCount(checkC ?? 0)
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
      await supabase
        .from('dogs')
        .update({
          name: editDogName.trim(),
          breed: editDogBreed.trim() || null,
          birthday: editDogBirthday || null,
          rabies_vaccinated_at: editRabiesDate || null,
          vaccine_vaccinated_at: editVaccineDate || null,
          photo_url: dogPhotoUrl,
        })
        .eq('id', dog.id)
      setDog((prev) =>
        prev
          ? {
              ...prev,
              name: editDogName.trim(),
              breed: editDogBreed.trim() || null,
              birthday: editDogBirthday || null,
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
      await supabase
        .from('users')
        .update({
          name: editName.trim(),
          parent_type: editParentType,
          bio: editBio.trim() || null,
          photo_url: photoUrl,
        })
        .eq('id', profile.id)
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: editName.trim(),
              parent_type: editParentType,
              bio: editBio.trim() || null,
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

  const parentLabel = (type: string | null) => PARENT_OPTIONS.find((o) => o.value === type)?.label ?? 'パパ'

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24
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
      setVaccinePickerTemp(ymd ? parseYmd(ymd) : defaultVaccinePickerDate())
      setVaccinePickerKind(kind)
    },
    [dog, editingDog, editRabiesDate, editVaccineDate]
  )

  const confirmVaccinePicker = () => {
    if (vaccinePickerKind === null || !editingDog) return
    persistVaccineDate(vaccinePickerKind, formatYmd(vaccinePickerTemp))
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

    let badge: { t: string; bad?: boolean } | null = null
    if (row.showRabiesExpiry) {
      if (hasDate) badge = isVaccineYearExpired(ymd) ? { t: '要接種', bad: true } : { t: '接種済' }
      else if (flag) badge = { t: '接種済' }
    } else if (hasDate || flag) {
      badge = { t: '接種済' }
    }

    const primaryText = hasDate
      ? `${formatDateJaGregorian(ymd)}（最後）`
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
          !hasDate && editingDog && styles.datePickPlaceholder,
          !editingDog && (hasDate ? styles.vacDateReadonlyTxt : styles.vacDateReadonlyTxtMuted),
        ]}
        numberOfLines={2}
      >
        {primaryText}
      </Text>
    )

    return (
      <>
        <View style={styles.syringeRow}>
          <IconSyringe />
          <Text style={styles.vLbl}>{row.label}</Text>
        </View>
        <View style={styles.vacDateRow}>
          {editingDog ? (
            <Pressable
              style={[styles.datePickBtn, styles.vacDateBtnFlex]}
              onPress={() => openVaccinePicker(row.kind)}
              accessibilityRole="button"
              accessibilityLabel={`${row.label}を選択`}
            >
              {dateContent}
            </Pressable>
          ) : (
            <View style={[styles.datePickBtn, styles.vacDateBtnFlex, styles.vacDateReadonly]}>
              {dateContent}
            </View>
          )}
          {badge ? (
            <View style={[styles.badge, badge.bad ? styles.badgeBad : styles.badgeOk]}>
              <Text style={[styles.badgeTxt, badge.bad ? styles.badgeTxtBad : styles.badgeTxtOk]}>{badge.t}</Text>
            </View>
          ) : null}
        </View>
      </>
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 12 }}>
        {dog ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardLbl}>愛犬</Text>
              {!editingDog ? (
                <Pressable style={styles.editPill} onPress={startEditDog}>
                  <IconEdit />
                  <Text style={styles.editPillTxt}> 編集</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.dogRow}>
              <View style={styles.dogPhWrap}>
                <View style={styles.dogPh}>
                  {dogPhotoPreview ?? dog.photo_url ? (
                    <Image source={{ uri: dogPhotoPreview ?? dog.photo_url! }} style={styles.dogImg} resizeMode="cover" />
                  ) : (
                    <IconPaw size={40} color="#FFD84D" />
                  )}
                </View>
                {editingDog ? (
                  <Pressable style={styles.camFab} onPress={() => void pickDogPhoto()}>
                    <IconCamera />
                  </Pressable>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                {editingDog ? (
                  <View style={{ gap: 8 }}>
                    <TextInput style={styles.inp} value={editDogName} onChangeText={setEditDogName} placeholder="名前" placeholderTextColor="#aaa" />
                    <TextInput style={styles.inp} value={editDogBreed} onChangeText={setEditDogBreed} placeholder="犬種" placeholderTextColor="#aaa" />
                    <Text style={styles.miniLbl}>誕生日（YYYY-MM-DD）</Text>
                    <TextInput style={styles.inp} value={editDogBirthday} onChangeText={setEditDogBirthday} placeholder="2020-01-01" placeholderTextColor="#aaa" />
                  </View>
                ) : (
                  <>
                    <Text style={styles.dogName}>{dog.name}</Text>
                    {dog.breed ? <Text style={styles.dogBreed}>{dog.breed}</Text> : null}
                    {dog.birthday ? <Text style={styles.dogAge}>{calcAge(dog.birthday)}</Text> : null}
                  </>
                )}
              </View>
            </View>
            <View style={styles.divider} />
            {renderVaccineSection({
              label: '狂犬病ワクチン接種日',
              kind: 'rabies',
              editYmd: editRabiesDate,
              storedAt: dog.rabies_vaccinated_at,
              vaccinatedFlag: dog.rabies_vaccinated,
              showRabiesExpiry: true,
            })}
            <View style={[styles.divider, { marginTop: 12 }]} />
            {renderVaccineSection({
              label: '混合ワクチン接種日',
              kind: 'mixed',
              editYmd: editVaccineDate,
              storedAt: dog.vaccine_vaccinated_at,
              vaccinatedFlag: dog.vaccine_vaccinated,
              showRabiesExpiry: false,
            })}
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

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardLbl}>オーナー</Text>
            {!editingOwner ? (
              <Pressable style={styles.editPill} onPress={startEditOwner}>
                <IconEdit />
                <Text style={styles.editPillTxt}> 編集</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.ownerRow}>
            <View style={styles.avWrapOuter}>
              <View style={styles.avWrap}>
                {avatarSrc ? (
                  <Image source={{ uri: avatarSrc }} style={styles.avImg} resizeMode="cover" />
                ) : (
                  <Ionicons name="person-outline" size={22} color="#ccc" />
                )}
              </View>
              {editingOwner ? (
                <Pressable style={styles.camFabSm} onPress={() => void pickAvatar()}>
                  <IconCamera />
                </Pressable>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              {editingOwner ? (
                <View style={{ gap: 8 }}>
                  <TextInput style={styles.inp} value={editName} onChangeText={setEditName} placeholder="名前" placeholderTextColor="#aaa" />
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
                </View>
              ) : (
                <>
                  <Text style={styles.ownerName}>{profile?.name ?? '名前未設定'}</Text>
                  <Text style={styles.ownerSub}>{parentLabel(profile?.parent_type ?? null)}</Text>
                </>
              )}
            </View>
          </View>
          {editingOwner ? (
            <TextInput
              style={[styles.inp, styles.bioInp]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="自己紹介（任意）"
              placeholderTextColor="#aaa"
              multiline
            />
          ) : (
            <Text style={styles.bio}>
              {(profile?.bio && profile.bio.trim()) ? profile.bio : defaultBioFromDog({ name: dog?.name, breed: dog?.breed })}
            </Text>
          )}
          {editingOwner ? (
            <View style={styles.btnRow}>
              <Pressable style={styles.btnGhost} onPress={() => setEditingOwner(false)}>
                <Text style={styles.btnGhostTxt}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.btnPri} onPress={() => void saveOwner()} disabled={savingOwner}>
                <Text style={styles.btnPriTxt}>{savingOwner ? '保存中...' : '保存する'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.evTitle}>いいねしたスポット</Text>
          <Text style={styles.evDesc}>
            お気に入りにしたスポットの一覧を確認できます{likeCount > 0 ? `（現在 ${likeCount} 件）` : ''}
          </Text>
          <Pressable style={styles.evCta} onPress={() => router.push('/likes')} accessibilityLabel="いいね一覧へ">
            <Text style={styles.evCtaTxt}>いいね一覧へ</Text>
          </Pressable>
          <View style={styles.listSplitDivider} />
          <Text style={styles.evTitle}>行ったスポット</Text>
          <Text style={styles.evDesc}>
            チェックインしたスポットの一覧を確認できます{checkInCount > 0 ? `（現在 ${checkInCount} 件）` : ''}
          </Text>
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

      {vaccinePickerKind !== null && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setVaccinePickerKind(null)}>
          <View style={styles.pickerOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setVaccinePickerKind(null)} />
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>
                {vaccinePickerKind === 'rabies' ? '狂犬病ワクチン接種日' : '混合ワクチン接種日'}
              </Text>
              <Text style={styles.pickerGregLine}>西暦 {formatDateJaGregorian(formatYmd(vaccinePickerTemp))}</Text>
              <DateTimePicker
                value={vaccinePickerTemp}
                mode="date"
                display="spinner"
                locale="ja_JP@calendar=gregorian"
                themeVariant="light"
                onChange={(_, d) => {
                  if (d) setVaccinePickerTemp(d)
                }}
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
      {vaccinePickerKind !== null && Platform.OS === 'android' ? (
        <DateTimePicker
          value={vaccinePickerTemp}
          mode="date"
          display="default"
          locale="ja_JP@calendar=gregorian"
          onChange={(event, date) => {
            const k = vaccinePickerKind
            if (k === null) return
            if (event.type === 'dismissed') {
              setVaccinePickerKind(null)
              return
            }
            if (event.type === 'set' && date) {
              void persistVaccineDate(k, formatYmd(date))
              setVaccinePickerKind(null)
            }
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  loadRoot: { flex: 1, backgroundColor: '#f7f6f3', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardLbl: { fontSize: 12, fontWeight: '800', color: '#aaa', letterSpacing: 1 },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  editPillTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  dogRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  dogPhWrap: { position: 'relative', width: 96 },
  dogPh: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#FFF9E0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dogImg: { width: '100%', height: '100%' },
  camFab: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogName: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  dogBreed: { fontSize: 14, color: '#888', marginTop: 4 },
  dogAge: { fontSize: 14, color: '#aaa', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#f5f5f5', marginTop: 16 },
  syringeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 4 },
  vLbl: { fontSize: 12, fontWeight: '800', color: '#aaa' },
  vacDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  vacDateBtnFlex: { flex: 1, minWidth: 0 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  badgeOk: { backgroundColor: '#F0FDF4' },
  badgeBad: { backgroundColor: '#FEE2E2' },
  badgeTxt: { fontSize: 12, fontWeight: '800' },
  badgeTxtOk: { color: '#34A853' },
  badgeTxtBad: { color: '#E84335' },
  inp: {
    borderRadius: 10,
    backgroundColor: '#f7f6f3',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
  datePickBtn: {
    borderRadius: 10,
    backgroundColor: '#f7f6f3',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  datePickTxt: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  datePickPlaceholder: { fontWeight: '500', color: '#aaa' },
  /** 編集モード外：タップ不可の見た目（枠・文字を弱く） */
  vacDateReadonly: { borderColor: '#f2f2f2', backgroundColor: '#fafafa' },
  vacDateReadonlyTxt: { color: '#a8a8a8', fontWeight: '500' },
  vacDateReadonlyTxtMuted: { color: '#c4c4c4', fontWeight: '500' },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  pickerTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 6, textAlign: 'center' },
  pickerGregLine: { fontSize: 13, fontWeight: '700', color: '#555', textAlign: 'center', marginBottom: 8 },
  pickerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pickerGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  pickerGhostTxt: { fontSize: 14, fontWeight: '800', color: '#888' },
  pickerPri: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.brandButton,
    alignItems: 'center',
  },
  pickerPriTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  miniLbl: { fontSize: 12, color: '#aaa', marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  btnGhostTxt: { fontSize: 14, fontWeight: '800', color: '#888' },
  btnPri: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.brandButton,
    alignItems: 'center',
  },
  btnPriTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  ownerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avWrapOuter: { position: 'relative', width: 56 },
  avWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avImg: { width: '100%', height: '100%' },
  camFabSm: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerName: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  ownerSub: { fontSize: 14, color: '#aaa', marginTop: 4 },
  parentRow: { flexDirection: 'row', gap: 8 },
  parentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
  },
  parentChipOn: { backgroundColor: colors.brandButton },
  parentChipTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  parentChipTxtOn: { color: '#1a1a1a' },
  bio: { fontSize: 14, color: '#555', lineHeight: 22, marginTop: 12 },
  bioInp: { marginTop: 12, minHeight: 72, textAlignVertical: 'top' },
  evTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  evDesc: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 12 },
  evCta: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.brandButton,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brandDark,
  },
  evCtaTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  listSplitDivider: { height: 1, backgroundColor: '#f5f5f5', marginTop: 20, marginBottom: 4 },
})
