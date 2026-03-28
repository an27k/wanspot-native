import * as ImagePicker from 'expo-image-picker'
import { useCallback, useEffect, useState } from 'react'
import {
  Image,
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
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { defaultBioFromDog } from '@/lib/default-bio'
import { HEART_ICON } from '@/lib/constants'
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

const IconHeart = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill={HEART_ICON.filled} stroke={HEART_ICON.filled} strokeWidth={2}>
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </Svg>
)

const IconSyringe = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round">
    <Path d="M18 2l4 4M17 7l1-1M3 21l6-6M9 15l2-2M12 12l2-2M6 21c0-2 2-4 4-4M15 3l-6 6M15 3l3 3-7 7-3-3 7-7z" />
  </Svg>
)

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

  const isExpired = (dateStr: string) => {
    const next = new Date(dateStr)
    next.setFullYear(next.getFullYear() + 1)
    return new Date() > next
  }

  const parentLabel = (type: string | null) => PARENT_OPTIONS.find((o) => o.value === type)?.label ?? 'パパ'

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24
  const avatarSrc = avatarPreview ?? profile?.photo_url

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
            <View style={styles.syringeRow}>
              <IconSyringe />
              <Text style={styles.vLbl}>狂犬病ワクチン接種日</Text>
            </View>
            {editingDog ? (
              <TextInput style={styles.inp} value={editRabiesDate} onChangeText={setEditRabiesDate} placeholder="YYYY-MM-DD" placeholderTextColor="#aaa" />
            ) : dog.rabies_vaccinated_at ? (
              <View style={styles.vacRow}>
                <Text style={styles.vacDate}>
                  {new Date(dog.rabies_vaccinated_at).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  （最後）
                </Text>
                <View style={[styles.badge, isExpired(dog.rabies_vaccinated_at) ? styles.badgeBad : styles.badgeOk]}>
                  <Text style={[styles.badgeTxt, isExpired(dog.rabies_vaccinated_at) ? styles.badgeTxtBad : styles.badgeTxtOk]}>
                    {isExpired(dog.rabies_vaccinated_at) ? '要接種' : '接種済'}
                  </Text>
                </View>
              </View>
            ) : dog.rabies_vaccinated ? (
              <View style={styles.vacRow}>
                <Text style={styles.warnSm}>接種日が未登録です</Text>
                <View style={[styles.badge, styles.badgeOk]}>
                  <Text style={styles.badgeTxtOk}>接種済</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>未登録</Text>
            )}
            <View style={[styles.divider, { marginTop: 12 }]} />
            <View style={styles.syringeRow}>
              <IconSyringe />
              <Text style={styles.vLbl}>混合ワクチン接種日</Text>
            </View>
            {editingDog ? (
              <TextInput style={styles.inp} value={editVaccineDate} onChangeText={setEditVaccineDate} placeholder="YYYY-MM-DD" placeholderTextColor="#aaa" />
            ) : dog.vaccine_vaccinated_at ? (
              <View style={styles.vacRow}>
                <Text style={styles.vacDate}>
                  {new Date(dog.vaccine_vaccinated_at).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  （最後）
                </Text>
                <View style={[styles.badge, styles.badgeOk]}>
                  <Text style={styles.badgeTxtOk}>接種済</Text>
                </View>
              </View>
            ) : dog.vaccine_vaccinated ? (
              <View style={styles.vacRow}>
                <Text style={styles.warnSm}>接種日が未登録です</Text>
                <View style={[styles.badge, styles.badgeOk]}>
                  <Text style={styles.badgeTxtOk}>接種済</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>未登録</Text>
            )}
            {editingDog ? (
              <View style={styles.btnRow}>
                <Pressable style={styles.btnGhost} onPress={() => setEditingDog(false)}>
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
          <Text style={styles.cardLbl}>イベント</Text>
          <Text style={styles.evTitle}>主催したイベント</Text>
          <Text style={styles.evDesc}>作成したイベントの一覧・編集はこちらから</Text>
          <Pressable style={styles.evCta} onPress={() => router.push('/mypage/events')}>
            <Text style={styles.evCtaTxt}>イベント管理へ</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLbl}>STATS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <View style={styles.statHead}>
                <IconHeart />
                <Text style={styles.statLbl}>いいね</Text>
              </View>
              <Text style={styles.statNum}>{likeCount}</Text>
              <Pressable style={styles.statChev} onPress={() => router.push('/likes')} accessibilityLabel="いいね一覧を見る">
                <Ionicons name="chevron-forward" size={22} color="#FFD84D" />
              </Pressable>
            </View>
            <View style={styles.statBox}>
              <View style={styles.statHead}>
                <IconPaw size={16} color="#1a1a1a" />
                <Text style={styles.statLbl}>行った</Text>
              </View>
              <Text style={styles.statNum}>{checkInCount}</Text>
              <Pressable style={styles.statChev} onPress={() => router.push('/checkins')} accessibilityLabel="行った一覧を見る">
                <Ionicons name="chevron-forward" size={22} color="#FFD84D" />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
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
  vacRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  vacDate: { fontSize: 14, color: '#555', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeOk: { backgroundColor: '#F0FDF4' },
  badgeBad: { backgroundColor: '#FEE2E2' },
  badgeTxt: { fontSize: 12, fontWeight: '800' },
  badgeTxtOk: { color: '#34A853' },
  badgeTxtBad: { color: '#E84335' },
  warnSm: { fontSize: 12, fontWeight: '800', color: '#F87171' },
  muted: { fontSize: 14, color: '#ccc', marginTop: 4 },
  inp: {
    borderRadius: 10,
    backgroundColor: '#f7f6f3',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
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
    backgroundColor: '#FFD84D',
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
  parentChipOn: { backgroundColor: '#FFD84D' },
  parentChipTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  parentChipTxtOn: { color: '#1a1a1a' },
  bio: { fontSize: 14, color: '#555', lineHeight: 22, marginTop: 12 },
  bioInp: { marginTop: 12, minHeight: 72, textAlignVertical: 'top' },
  evTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  evDesc: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 12 },
  evCta: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
  },
  evCtaTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f7f6f3',
    gap: 4,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLbl: { fontSize: 12, fontWeight: '800', color: '#aaa' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  statChev: { alignSelf: 'flex-end', padding: 4, marginTop: -8 },
})
