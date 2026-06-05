import { useCallback, useState } from 'react'
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { DogPawPlaceholder } from '@/components/DogPawPlaceholder'
import {
  dogBirthdayYearBounds,
  OwnerBirthdayPickers,
  ownerBirthdayToYmd,
  splitYmdToParts,
} from '@/components/OwnerBirthdayPickers'
import { colors } from '@/constants/colors'
import {
  calcDogAge,
  DOG_SIZE_LABEL,
  type DogProfile,
} from '@/lib/dog-display'
import { pickFromLibrary } from '@/lib/image-picker'
import { supabase } from '@/lib/supabase'

const IconCamera = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <Path d="M12 13a4 4 0 100-8 4 4 0 000 8z" />
  </Svg>
)

const IconEditSmall = ({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
)

type Props = {
  dog: DogProfile
  userId: string
  onUpdated: (dog: DogProfile) => void
}

/** 愛犬アイデンティティ表示＋編集（ワクチンは含まない。旧マイページから移設） */
export function DogIdentityProfile({ dog, userId, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBreed, setEditBreed] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editMonth, setEditMonth] = useState('')
  const [editDay, setEditDay] = useState('')
  const [editGender, setEditGender] = useState<'male' | 'female' | null>(null)
  const [editSize, setEditSize] = useState<'XS' | 'S' | 'M' | 'L' | 'XL' | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)

  const editBirthdayYmd = ownerBirthdayToYmd(editYear, editMonth, editDay)
  const dogYBounds = dogBirthdayYearBounds()

  const startEdit = useCallback(() => {
    setEditName(dog.name ?? '')
    setEditBreed(dog.breed ?? '')
    const p = splitYmdToParts(dog.birthday ?? null)
    setEditYear(p.y)
    setEditMonth(p.m)
    setEditDay(p.d)
    setEditGender(dog.gender ?? null)
    setEditSize(dog.size ?? null)
    setPhotoPreview(null)
    setPhotoUri(null)
    setPhotoRemoved(false)
    setEditing(true)
  }, [dog])

  const pickPhoto = async () => {
    const img = await pickFromLibrary()
    if (!img) return
    setPhotoUri(img.uri)
    setPhotoPreview(img.uri)
    setPhotoRemoved(false)
  }

  const saveIdentity = async () => {
    setSaving(true)
    try {
      let photoUrl: string | null = dog.photo_url
      if (photoUri) {
        const resFetch = await fetch(photoUri)
        const buf = await resFetch.arrayBuffer()
        const path = `${userId}/dog.jpg`
        await supabase.storage.from('avatars').upload(path, buf, { upsert: true, contentType: 'image/jpeg' })
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      } else if (photoRemoved) {
        photoUrl = null
      }

      const { error } = await supabase
        .from('dogs')
        .update({
          name: editName.trim(),
          breed: editBreed.trim() || null,
          birthday: editBirthdayYmd,
          gender: editGender,
          size: editSize,
          photo_url: photoUrl,
        })
        .eq('id', dog.id)

      if (error) {
        Alert.alert('保存に失敗しました', error.message)
        return
      }

      const next: DogProfile = {
        ...dog,
        name: editName.trim(),
        breed: editBreed.trim() || null,
        birthday: editBirthdayYmd,
        gender: editGender,
        size: editSize,
        photo_url: photoUrl,
      }
      onUpdated(next)
      setEditing(false)
      setPhotoPreview(null)
      setPhotoUri(null)
      setPhotoRemoved(false)
    } finally {
      setSaving(false)
    }
  }

  const age = dog.birthday?.trim() ? calcDogAge(dog.birthday) : null
  const hasSym = dog.gender === 'male' || dog.gender === 'female'

  const metaParts: string[] = []
  if (dog.breed?.trim()) metaParts.push(dog.breed.trim())
  if (dog.size) metaParts.push(DOG_SIZE_LABEL[dog.size])
  if (hasSym) metaParts.push(dog.gender === 'male' ? 'オス' : 'メス')
  if (age) metaParts.push(age)

  return (
    <View style={styles.wrap}>
      {!editing ? (
        <Pressable style={styles.editBtn} onPress={startEdit} hitSlop={8} accessibilityLabel="愛犬プロフィールを編集">
          <IconEditSmall />
        </Pressable>
      ) : null}

      <View style={styles.col}>
        <View style={[styles.avatarWrap, editing && styles.avatarWrapEditing]}>
          <View style={styles.avatar}>
            {photoRemoved && !photoUri ? (
              <DogPawPlaceholder size={40} fill={colors.dogPhotoPlaceholderPaw} />
            ) : photoPreview ?? dog.photo_url ? (
              <Image source={{ uri: photoPreview ?? dog.photo_url! }} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <DogPawPlaceholder size={40} fill={colors.dogPhotoPlaceholderPaw} />
            )}
          </View>
          {editing ? (
            <Pressable style={styles.camFab} onPress={() => void pickPhoto()} accessibilityLabel="愛犬の写真を変更">
              <IconCamera />
            </Pressable>
          ) : null}
        </View>

        {editing && (photoPreview ?? dog.photo_url) && !photoRemoved ? (
          <Pressable
            style={styles.photoRemoveBtn}
            onPress={() => {
              setPhotoRemoved(true)
              setPhotoPreview(null)
              setPhotoUri(null)
            }}
          >
            <Text style={styles.photoRemoveTxt}>写真を削除</Text>
          </Pressable>
        ) : null}

        {editing ? (
          <View style={styles.editFields}>
            <TextInput
              style={styles.inp}
              value={editName}
              onChangeText={setEditName}
              placeholder="名前"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.inp}
              value={editBreed}
              onChangeText={setEditBreed}
              placeholder="犬種"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.birthdayCard}>
              <OwnerBirthdayPickers
                year={editYear}
                month={editMonth}
                day={editDay}
                onChangeYear={setEditYear}
                onChangeMonth={setEditMonth}
                onChangeDay={setEditDay}
                yearMin={dogYBounds.min}
                yearMax={dogYBounds.max}
                fieldLabel="生年月日（任意）"
                hint="年・月・日をすべて選ぶと年齢表示に使います。"
              />
            </View>
            <Text style={styles.miniLbl}>性別</Text>
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, editGender === 'male' && styles.chipOn]} onPress={() => setEditGender('male')}>
                <Text style={styles.symMale}>♂</Text>
                <Text style={styles.chipLbl}>オス</Text>
              </Pressable>
              <Pressable style={[styles.chip, editGender === 'female' && styles.chipOn]} onPress={() => setEditGender('female')}>
                <Text style={styles.symFemale}>♀</Text>
                <Text style={styles.chipLbl}>メス</Text>
              </Pressable>
              <Pressable style={[styles.chip, editGender === null && styles.chipOn]} onPress={() => setEditGender(null)}>
                <Text style={styles.chipLblMuted}>未設定</Text>
              </Pressable>
            </View>
            <Text style={styles.miniLbl}>サイズ</Text>
            <View style={styles.chipRow}>
              {(['XS', 'S', 'M', 'L', 'XL'] as const).map((k) => (
                <Pressable key={k} style={[styles.chip, editSize === k && styles.chipOn]} onPress={() => setEditSize(k)}>
                  <Text style={styles.chipLbl}>{k}</Text>
                </Pressable>
              ))}
              <Pressable style={[styles.chip, editSize === null && styles.chipOn]} onPress={() => setEditSize(null)}>
                <Text style={styles.chipLblMuted}>未設定</Text>
              </Pressable>
            </View>
            <View style={styles.btnRow}>
              <Pressable
                style={styles.btnGhost}
                onPress={() => {
                  setPhotoRemoved(false)
                  setEditing(false)
                }}
              >
                <Text style={styles.btnGhostTxt}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.btnPri} onPress={() => void saveIdentity()} disabled={saving}>
                <Text style={styles.btnPriTxt}>{saving ? '保存中...' : '保存する'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.name}>{dog.name}</Text>
            {metaParts.length > 0 ? (
              <Text style={styles.meta} numberOfLines={2}>
                {metaParts.join(' · ')}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  editBtn: { position: 'absolute', top: 8, right: 16, zIndex: 2, padding: 4 },
  col: { alignItems: 'center', width: '100%' },
  avatarWrap: { position: 'relative', width: 88, height: 88 },
  avatarWrapEditing: { marginBottom: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.dogPhotoPlaceholderBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  camFab: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveBtn: { marginTop: 8, paddingVertical: 6 },
  photoRemoveTxt: { fontSize: 13, fontWeight: '700', color: '#E84335' },
  name: { marginTop: 12, fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  meta: { marginTop: 6, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  editFields: { alignSelf: 'stretch', width: '100%', gap: 8, marginTop: 12 },
  inp: {
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  birthdayCard: {
    marginTop: 4,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  miniLbl: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
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
  chipOn: { borderColor: colors.brandDark, backgroundColor: colors.brandButton },
  chipLbl: { fontSize: 12, fontWeight: '700', color: colors.text },
  chipLblMuted: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  symMale: { fontSize: 17, fontWeight: '800', color: colors.genderMale },
  symFemale: { fontSize: 17, fontWeight: '800', color: colors.genderFemale },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnGhost: { flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center' },
  btnGhostTxt: { fontSize: 14, fontWeight: '800', color: colors.textLight },
  btnPri: { flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.brandButton, alignItems: 'center' },
  btnPriTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
})
