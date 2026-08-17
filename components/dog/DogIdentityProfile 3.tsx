import { useCallback, useMemo, useState } from 'react'
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { AvatarSunsetRing } from '@/components/dog/AvatarSunsetRing'
import { SafeDogAvatar } from '@/components/dog/SafeDogAvatar'
import { IconPaw } from '@/components/IconPaw'
import { FormField } from '@/components/onboarding/FormField'
import {
  dogBirthdayYearBounds,
  OwnerBirthdayPickers,
  ownerBirthdayToYmd,
  splitYmdToParts,
} from '@/components/OwnerBirthdayPickers'
import type { AppColors } from '@/constants/colors'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import {
  calcDogAge,
  DOG_SIZE_LABEL,
  type DogProfile,
} from '@/lib/dog-display'
import { filterDogBreeds, isKnownDogBreed } from '@/lib/dog-breeds'
import { pickFromLibrary } from '@/lib/image-picker'
import { supabase } from '@/lib/supabase'
import { invalidateCache } from '@/lib/client-cache'

const IconEditSmall = ({ size = 22, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
)

type Props = {
  dog: DogProfile
  userId: string
  onUpdated: (dog: DogProfile) => void
  variant?: 'default' | 'album' | 'settings'
  ringEnergized?: boolean
}

/** 愛犬アイデンティティ表示＋編集（ワクチンは含まない。旧マイページから移設） */
export function DogIdentityProfile({ dog, userId, onUpdated, variant = 'default', ringEnergized }: Props) {
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
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
  const [profileOpen, setProfileOpen] = useState(false)

  const editBirthdayYmd = ownerBirthdayToYmd(editYear, editMonth, editDay)
  const dogYBounds = dogBirthdayYearBounds()
  const breedHits = useMemo(() => filterDogBreeds(editBreed), [editBreed])
  const editBreedTrim = editBreed.trim()
  const savedBreedTrim = dog.breed?.trim() ?? ''
  const isExistingCustomBreed =
    !!editBreedTrim && editBreedTrim === savedBreedTrim && !isKnownDogBreed(editBreedTrim)
  const showBreedSuggestions = editing && breedHits.length > 0 && !isKnownDogBreed(editBreedTrim)
  const showBreedValidation =
    editing && !!editBreedTrim && !isKnownDogBreed(editBreedTrim) && !isExistingCustomBreed

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
    const breedToSave = editBreed.trim()
    const canKeepExistingCustomBreed =
      !!breedToSave && breedToSave === (dog.breed?.trim() ?? '') && !isKnownDogBreed(breedToSave)

    if (breedToSave && !isKnownDogBreed(breedToSave) && !canKeepExistingCustomBreed) {
      Alert.alert('犬種を選択してください', '候補に表示された犬種から選んでください。')
      return
    }

    setSaving(true)
    try {
      let photoUrl: string | null = dog.photo_url
      if (photoUri) {
        const resFetch = await fetch(photoUri)
        const buf = await resFetch.arrayBuffer()
        // 固定パスにすると URL が変わらず、expo-image のディスクキャッシュに残った
        // 旧画像や読み込み失敗が出続ける。オンボと同じくアップロードごとに別名にする
        const path = `${userId}/dog-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          // 毎回一意なパスなので上書きは不要。upsert は SELECT 権限も要求し、
          // avatars の新規アップロード用 RLS（INSERT）だけでは 400 になる。
          .upload(path, buf, { upsert: false, contentType: 'image/jpeg' })
        // getPublicUrl はファイルの実在を確認せずURLを組み立てるだけ。
        // 失敗を握り潰すと、存在しない画像のURLがDBに残り肉球のままになる（実際に発生した）
        if (uploadError) {
          Alert.alert('写真を保存できませんでした', '通信状況を確認して、もう一度お試しください。')
          return
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      } else if (photoRemoved) {
        photoUrl = null
      }

      const { error } = await supabase
        .from('dogs')
        .update({
          name: editName.trim(),
          breed: breedToSave || null,
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
        breed: breedToSave || null,
        birthday: editBirthdayYmd,
        gender: editGender,
        size: editSize,
        photo_url: photoUrl,
      }
      // useDogProfile は profile:dog を10分キャッシュし、画面フォーカスのたびに
      // 非force で読み直す。ここで捨てないと、保存直後は写っても他画面から戻った
      // 瞬間に古い行（写真なし）で上書きされ、肉球に戻る
      invalidateCache(`profile:dog:${userId}`)
      onUpdated(next)
      setEditing(false)
      setPhotoPreview(null)
      setPhotoUri(null)
      setPhotoRemoved(false)
    } catch (e) {
      // 画像の読み込みや変換で投げられた例外を握り潰すと、何も起きずに
      // 肉球のままに見える。呼び出し側は void なのでここで拾いきる
      Alert.alert('保存に失敗しました', e instanceof Error ? e.message : '時間をおいて、もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const age = dog.birthday?.trim() ? calcDogAge(dog.birthday) : null

  const metaParts: string[] = []
  if (dog.breed?.trim()) metaParts.push(dog.breed.trim())
  if (dog.size) metaParts.push(DOG_SIZE_LABEL[dog.size])
  if (age) metaParts.push(age)

  const genderSymbol = dog.gender === 'male' ? '♂' : dog.gender === 'female' ? '♀' : null

  const isAlbum = variant === 'album'
  const isSettings = variant === 'settings'
  const avatarSize = isAlbum ? 112 : 88

  const avatarInner = (
    <>
      {photoRemoved && !photoUri ? (
        <View style={styles.avatarPlaceholder}>
          <IconPaw size={40} color={colors.dogPhotoPlaceholderPaw} />
        </View>
      ) : photoPreview ?? dog.photo_url ? (
        <SafeDogAvatar uri={photoPreview ?? dog.photo_url} size={40} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <IconPaw size={40} color={colors.dogPhotoPlaceholderPaw} />
        </View>
      )}
    </>
  )

  const editModal = (isAlbum || isSettings) && editing ? (
    <Modal visible transparent animationType="slide" onRequestClose={() => setEditing(false)}>
      <View style={styles.profileEditBackdrop}>
        <View style={[styles.profileEditSheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.profileSheetHandle} />
          <View style={styles.profileEditHead}>
            <Text style={styles.profileEditTitle}>プロフィール編集</Text>
            <Pressable
              style={styles.profileEditCloseIcon}
              onPress={() => {
                setPhotoRemoved(false)
                setEditing(false)
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="プロフィール編集を閉じる"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.profileEditScroll}
          >
            <View style={[styles.avatarWrap, styles.avatarWrapEditing, styles.profileEditAvatar]}>
              <View style={styles.profileEditAvatarRing}>
                <View style={styles.profileEditAvatarGlass}>{avatarInner}</View>
              </View>
              <Pressable
                style={styles.camFab}
                onPress={() => void pickPhoto()}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="愛犬の写真を変更"
              >
                <Ionicons name="camera" size={15} color={colors.onPrimary} />
              </Pressable>
            </View>

            {(photoPreview ?? dog.photo_url) && !photoRemoved ? (
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

            <View style={styles.editFields}>
              <FormField label="名前">
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="例: モカ"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                />
              </FormField>
              <FormField label="犬種">
                <TextInput
                  style={styles.textInput}
                  value={editBreed}
                  onChangeText={setEditBreed}
                  placeholder="犬種名で検索"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  autoCorrect={false}
                />
                {showBreedSuggestions ? (
                  <FlatList
                    data={breedHits}
                    keyExtractor={(item) => item}
                    style={styles.breedSuggestionList}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    renderItem={({ item }) => (
                      <Pressable
                        style={[styles.breedSuggestionRow, editBreed === item && styles.breedSuggestionRowOn]}
                        onPress={() => setEditBreed(item)}
                      >
                        <Text style={styles.breedSuggestionText}>{item}</Text>
                      </Pressable>
                    )}
                  />
                ) : null}
                {showBreedValidation ? (
                  <Text style={styles.breedValidationText}>候補から犬種を選択してください。</Text>
                ) : null}
                {isExistingCustomBreed ? (
                  <Text style={styles.breedValidationText}>保存済みの犬種です。変更する場合は候補から選んでください。</Text>
                ) : null}
              </FormField>
              <Text style={styles.miniLbl}>サイズ</Text>
              <Text style={styles.miniHint}>小型犬可・大型犬可などのおすすめ表示に使われます。</Text>
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
              <Text style={styles.miniLbl}>性別（任意）</Text>
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
            </View>
          </ScrollView>

          <View style={styles.profileEditFooter}>
            <Pressable
              style={[styles.btnGhost, styles.profileEditCancelBtn]}
              onPress={() => {
                setPhotoRemoved(false)
                setEditing(false)
              }}
            >
              <Text style={[styles.btnGhostTxt, styles.profileEditCancelText]}>キャンセル</Text>
            </Pressable>
            <Pressable style={[styles.btnPri, styles.profileEditSaveBtn]} onPress={() => void saveIdentity()} disabled={saving}>
              <Text style={[styles.btnPriTxt, styles.profileEditSaveText]}>{saving ? '保存中...' : '保存する'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  ) : null

  if (isSettings) {
    return (
      <>
        <View style={styles.settingsWrap}>
          <View style={styles.settingsAvatarWrap}>
            <View style={styles.avatar}>{avatarInner}</View>
          </View>
          <Text style={styles.settingsName}>{dog.name}</Text>
          {metaParts.length > 0 || genderSymbol ? (
            <Text style={styles.settingsMeta} numberOfLines={2}>
              {[...metaParts, genderSymbol].filter(Boolean).join(' · ')}
            </Text>
          ) : (
            <Text style={styles.settingsMetaMuted}>名前・犬種・サイズなどを登録できます</Text>
          )}
          <Pressable style={styles.settingsEditBtn} onPress={startEdit} accessibilityRole="button" accessibilityLabel="プロフィールを編集">
            <Ionicons name="create-outline" size={17} color={colors.pillText} />
            <Text style={styles.settingsEditBtnTxt}>プロフィールを編集</Text>
          </Pressable>
        </View>
        {editModal}
      </>
    )
  }

  if (isAlbum && !editing) {
    return (
      <View style={[styles.compactAlbumWrap, { marginTop: insets.top + 8 }]}>
        <Pressable
          style={styles.compactAlbumChip}
          onPress={() => setProfileOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="愛犬プロフィールを表示"
        >
          <AvatarSunsetRing size={44} energized={ringEnergized} tone="aurora">
            {avatarInner}
          </AvatarSunsetRing>
          <Text style={styles.compactAlbumName} numberOfLines={1}>
            {dog.name}
          </Text>
          <Ionicons name="chevron-down" size={16} color={GOOGLE_HOME.textPrimary} />
        </Pressable>
        <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
          <Pressable style={styles.profileSheetBackdrop} onPress={() => setProfileOpen(false)}>
            <Pressable style={[styles.profileSheet, { paddingBottom: insets.bottom + 18 }]} onPress={() => {}}>
              <LinearGradient
                pointerEvents="none"
                colors={[colors.surfaceRaised, colors.surface, colors.tintWeak]}
                locations={[0, 0.58, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.profileGlowPurple} />
              <View pointerEvents="none" style={styles.profileGlowMint} />
              <View style={styles.profileSheetHandle} />
              <View style={styles.profileHero}>
                <LinearGradient
                  colors={['rgba(85,224,180,0.98)', 'rgba(182,108,255,0.92)', 'rgba(242,122,215,0.78)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.profileAvatarRing}
                >
                  <View style={styles.profileAvatarGlass}>{avatarInner}</View>
                </LinearGradient>
              </View>
              <View style={styles.profileSheetCopy}>
                <Text style={styles.profileSheetName}>{dog.name}</Text>
                {metaParts.length > 0 ? (
                  <Text style={styles.profileSheetMeta}>{metaParts.join(' · ')}</Text>
                ) : (
                  <Text style={styles.profileSheetMeta}>プロフィール情報</Text>
                )}
              </View>
              <View style={styles.profileStatRow}>
                {metaParts.slice(0, 3).map((part) => (
                  <View key={part} style={styles.profileStatPill}>
                    <Text style={styles.profileStatText}>{part}</Text>
                  </View>
                ))}
                {genderSymbol ? (
                  <View style={styles.profileStatPill}>
                    <Text style={styles.profileStatText}>{genderSymbol}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.profileActionRow}>
                <Pressable
                  style={styles.profileEditBtn}
                  onPress={() => {
                    setProfileOpen(false)
                    startEdit()
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={colors.onPrimary} />
                  <Text style={styles.profileEditText}>編集</Text>
                </Pressable>
                <Pressable style={styles.profileSheetClose} onPress={() => setProfileOpen(false)}>
                  <Text style={styles.profileSheetCloseText}>閉じる</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    )
  }

  if (isAlbum && editing) {
    return <View style={[styles.compactAlbumWrap, { marginTop: insets.top + 8 }]}>{editModal}</View>
  }

  return (
    <View style={[styles.wrap, isAlbum && styles.wrapAlbum]}>
      {!editing ? (
        <Pressable
          style={[
            styles.editBtn,
            isAlbum && [styles.editBtnAlbum, { top: insets.top + 8 }],
          ]}
          onPress={startEdit}
          hitSlop={12}
          accessibilityLabel="愛犬プロフィールを編集"
        >
          <IconEditSmall color={isAlbum ? GOOGLE_HOME.textPrimary : colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={[styles.col, isAlbum && [styles.colAlbum, { marginTop: insets.top + 8 }]]}>
        <View style={[styles.avatarWrap, editing && styles.avatarWrapEditing, isAlbum && styles.avatarWrapAlbum]}>
          {isAlbum ? (
            <AvatarSunsetRing size={avatarSize} energized={ringEnergized} tone="aurora">
              {avatarInner}
            </AvatarSunsetRing>
          ) : (
            <View style={styles.avatar}>{avatarInner}</View>
          )}
          {editing ? (
            <Pressable
              style={styles.camFab}
              onPress={() => void pickPhoto()}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="愛犬の写真を変更"
            >
              <Ionicons name="camera" size={15} color={colors.onPrimary} />
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
            <FormField label="名前">
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="例: モカ"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
              />
            </FormField>
            <FormField label="犬種">
              <TextInput
                style={styles.textInput}
                value={editBreed}
                onChangeText={setEditBreed}
                placeholder="犬種名で検索"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                autoCorrect={false}
              />
              {showBreedSuggestions ? (
                <FlatList
                  data={breedHits}
                  keyExtractor={(item) => item}
                  style={styles.breedSuggestionList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.breedSuggestionRow, editBreed === item && styles.breedSuggestionRowOn]}
                      onPress={() => setEditBreed(item)}
                    >
                      <Text style={styles.breedSuggestionText}>{item}</Text>
                    </Pressable>
                  )}
                />
              ) : null}
              {showBreedValidation ? (
                <Text style={styles.breedValidationText}>候補から犬種を選択してください。</Text>
              ) : null}
              {isExistingCustomBreed ? (
                <Text style={styles.breedValidationText}>保存済みの犬種です。変更する場合は候補から選んでください。</Text>
              ) : null}
            </FormField>
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
            <View style={[styles.nameRow, isAlbum && styles.nameRowAlbum]}>
              <Text style={[styles.name, isAlbum && styles.nameAlbum]}>{dog.name}</Text>
            </View>
            {metaParts.length > 0 || genderSymbol ? (
              isAlbum ? (
                <View style={styles.metaPillRow}>
                  {metaParts.map((part) => (
                    <View key={part} style={[styles.metaPill, styles.metaPillAlbum]}>
                      <Text style={[styles.metaPillTxt, styles.metaPillTxtAlbum]}>{part}</Text>
                    </View>
                  ))}
                  {genderSymbol ? (
                    <View style={[styles.metaPill, styles.metaPillAlbum]}>
                      <Text
                        style={[
                          styles.metaPillTxt,
                          styles.metaPillTxtAlbum,
                          { color: dog.gender === 'male' ? colors.genderMale : colors.genderFemale },
                        ]}
                      >
                        {genderSymbol}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.meta} numberOfLines={2}>
                  {[...metaParts, genderSymbol].filter(Boolean).join(' · ')}
                </Text>
              )
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { position: 'relative', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  compactAlbumWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  compactAlbumChip: {
    maxWidth: 168,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
    paddingLeft: 4,
    paddingRight: 12,
    backgroundColor: 'rgba(255,255,255,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  compactAlbumName: {
    flexShrink: 1,
    // チップの幅が maxWidth 168 で決め打ちなので、button のまま17pxに上げると
    // 3文字を超える名前が省略される。サイズだけ据え置く
    ...type.button,
    fontSize: 15,
    color: GOOGLE_HOME.textPrimary,
  },
  profileSheetBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.overlayScrim,
    paddingHorizontal: 16,
  },
  profileSheet: {
    borderRadius: 36,
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderEmphasis,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 10,
    overflow: 'hidden',
  },
  profileGlowPurple: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(182,108,255,0.16)',
  },
  profileGlowMint: {
    position: 'absolute',
    bottom: -90,
    left: -70,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(85,224,180,0.18)',
  },
  profileSheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderEmphasis,
    marginBottom: 16,
  },
  profileSheetHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileHero: { alignItems: 'center', marginTop: 4 },
  profileAvatarRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  profileAvatarGlass: {
    width: 108,
    height: 108,
    borderRadius: 54,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 3,
    borderColor: colors.borderEmphasis,
  },
  profileSheetCopy: {
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  profileSheetName: { ...type.title, color: colors.text },
  profileSheetMeta: { ...type.caption, color: colors.textSecondary, textAlign: 'center' as const },
  profileStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  profileStatPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  profileStatText: { ...type.label, color: colors.text },
  profileActionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  profileEditBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  profileEditText: { ...type.button, color: colors.onPrimary },
  profileSheetClose: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  profileSheetCloseText: { ...type.button, color: colors.text },
  profileEditBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.overlayScrim,
  },
  profileEditSheet: {
    maxHeight: '88%',
    borderRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 18,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  profileEditHead: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileEditTitle: { ...type.title, color: colors.text },
  profileEditCloseIcon: {
    position: 'absolute',
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlaySubtle,
  },
  profileEditScroll: { paddingBottom: 14, alignItems: 'center' },
  profileEditAvatar: {
    width: 116,
    height: 116,
    alignSelf: 'center',
    marginBottom: 10,
  },
  profileEditAvatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tintStrong,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  profileEditAvatarGlass: {
    width: 98,
    height: 98,
    borderRadius: 49,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.borderEmphasis,
  },
  profileEditFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  profileEditCancelBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  profileEditCancelText: { color: colors.textSecondary },
  profileEditSaveBtn: {
    backgroundColor: colors.primary,
  },
  profileEditSaveText: { color: colors.onPrimary },
  settingsWrap: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  settingsAvatarWrap: {
    width: 88,
    height: 88,
    marginBottom: 4,
  },
  settingsName: {
    ...type.title,
    color: colors.text,
    textAlign: 'center' as const,
  },
  settingsMeta: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center' as const,
    paddingHorizontal: 8,
  },
  settingsMetaMuted: {
    ...type.caption,
    color: colors.textLight,
    textAlign: 'center' as const,
  },
  settingsEditBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.tintWeak,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsEditBtnTxt: {
    ...type.button,
    color: colors.pillText,
  },
  wrapAlbum: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 0,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  editBtn: { position: 'absolute', top: 8, right: 16, zIndex: 10, padding: 8 },
  editBtnAlbum: { right: 16 },
  col: { alignItems: 'center', width: '100%' },
  colAlbum: { paddingHorizontal: 0 },
  avatarWrap: {
    position: 'relative',
    width: 88,
    height: 88,
    overflow: 'visible',
  },
  avatarWrapAlbum: { width: 124, height: 124 },
  /** 編集時：カメラFABがはみ出す分の余白（旧マイページと同系） */
  avatarWrapEditing: { marginBottom: 12, width: 96, height: 96 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.dogPhotoPlaceholderBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarAlbum: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camFab: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 2.5,
      },
      android: { elevation: 4 },
    }),
  },
  photoRemoveBtn: { marginTop: 8, paddingVertical: 6 },
  // 破壊的な副操作。押せる文字だが、ここを17pxにすると保存より目立つ
  photoRemoveTxt: { ...type.button, fontSize: 13, color: colors.error },
  name: { ...type.title, color: colors.text, textAlign: 'center' as const },
  nameAlbum: { color: GOOGLE_HOME.textPrimary },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  nameRowAlbum: { marginTop: 14 },
  nameGender: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  nameGenderAlbum: { fontSize: 26, lineHeight: 30 },
  meta: { marginTop: 6, ...type.caption, color: colors.textMuted, textAlign: 'center' as const },
  metaPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  metaPill: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaPillTxt: { ...type.label, color: colors.text, textAlign: 'center' as const, includeFontPadding: false },
  metaPillAlbum: {
    backgroundColor: GOOGLE_HOME.panelBg,
    borderColor: GOOGLE_HOME.panelBorder,
  },
  metaPillTxtAlbum: { color: GOOGLE_HOME.textSecondary },
  editFields: { alignSelf: 'stretch', width: '100%', marginTop: 12 },
  textInput: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...type.row,
    color: colors.text,
  },
  breedSuggestionList: {
    maxHeight: 220,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  breedSuggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breedSuggestionRowOn: { backgroundColor: colors.tintStrong },
  breedSuggestionText: { ...type.row, color: colors.text },
  breedValidationText: { marginTop: 6, ...type.caption, color: colors.textMuted },
  birthdayCard: {
    marginTop: 4,
    padding: 16,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  miniLbl: { ...type.label, color: colors.textMuted, marginBottom: 4 },
  miniHint: { ...type.caption, color: colors.textLight, marginBottom: 6 },
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
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.tintStrong },
  chipLbl: { ...type.label, color: colors.text },
  chipLblMuted: { ...type.label, color: colors.textMuted },
  // ♂♀ はチップ内のアイコン扱い。行間を持つ型を当てるとチップの高さが変わる
  symMale: { fontSize: 17, fontWeight: '800', color: colors.genderMale },
  symFemale: { fontSize: 17, fontWeight: '800', color: colors.genderFemale },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnGhost: { flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  btnGhostTxt: { ...type.button, color: colors.textLight },
  btnPri: { flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center' },
  btnPriTxt: { ...type.button, color: colors.onPrimary },
})
