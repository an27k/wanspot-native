import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Dimensions,
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
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeRemoteImage } from '@/components/common/SafeRemoteImage'
import { VlogGeneratingPanel } from '@/components/album/VlogGeneratingPanel'
import { RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { buildVlogRenderPayloadAsync } from '@/lib/vlog/build-payload'
import {
  requestVlogRender,
  simulateVlogGenerationStages,
  type VlogRenderStage,
} from '@/lib/vlog/render-client'
import { track } from '@/lib/analytics'
import { logUserEvent } from '@/lib/user-events'
import { pickMemoryMediaMulti } from '@/lib/image-picker'
import {
  formatVisitDate,
  formatVisitRecordError,
  insertMemory,
  softDeleteMemory,
  softDeleteVisit,
  updateVisit,
  uploadMemoryFile,
  type VisitPlate,
} from '@/lib/visits-memories'

const GRID_PAD = 16
const GRID_GAP = 10
const TILE_W = (Dimensions.get('window').width - GRID_PAD * 2 - GRID_GAP) / 2
const TILE_H = Math.round(TILE_W * 1.25)
const DECK_CARD_W = Dimensions.get('window').width - GRID_PAD * 2
const DECK_CARD_H = Math.min(360, Math.round(DECK_CARD_W * 1.02))

type Props = {
  userId: string | null
  dogName?: string | null
  plates: VisitPlate[]
  loading: boolean
  onReload: () => void
  onOpenTutorial?: () => void
}

type PickedMedia = { uri: string; mimeType: string }

function StarRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={22} color={colors.gold} />
        </Pressable>
      ))}
    </View>
  )
}

function EmptyAlbumMotion() {
  const float = useSharedValue(0)
  const glow = useSharedValue(0)

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [float, glow])

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: -4 + float.value * 5 },
      { rotateX: `${10 - float.value * 2}deg` },
      { scale: 0.78 + float.value * 0.02 },
    ],
    opacity: 0.42 + glow.value * 0.16,
  }))

  const midStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: 1 - float.value * 4 },
      { rotateX: `${6 - float.value * 1.5}deg` },
      { scale: 0.88 + float.value * 0.025 },
    ],
    opacity: 0.62 + glow.value * 0.16,
  }))

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: -float.value * 7 },
      { scale: 1 + float.value * 0.018 },
    ],
    shadowOpacity: 0.14 + glow.value * 0.1,
  }))

  return (
    <View style={styles.emptyCoverFlow}>
      <Animated.View entering={FadeInDown.delay(40).springify()} style={[styles.emptyGhostCard, styles.emptyGhostBack, backStyle]} />
      <Animated.View entering={FadeInDown.delay(90).springify()} style={[styles.emptyGhostCard, styles.emptyGhostMid, midStyle]} />
      <Animated.View entering={FadeInDown.delay(140).springify()} style={[styles.emptyGhostFront, frontStyle]}>
        <View style={[styles.glassTube, styles.emptyGlassTubeOne]} />
        <View style={[styles.glassTube, styles.emptyGlassTubeTwo]} />
        <View style={styles.emptyHeroIcon}>
          <Ionicons name="sparkles" size={24} color="#fff" />
        </View>
        <View style={styles.emptyGhostLineWide} />
        <View style={styles.emptyGhostLine} />
      </Animated.View>
    </View>
  )
}

function DeckGhostCard({ index }: { index: number }) {
  const depth = Math.min(index, 4)
  const ghostNo = String(index + 1).padStart(2, '0')
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeInDown.delay(index * 50).duration(260)}
      style={[
        styles.deckGhostCard,
        {
          zIndex: 20 - index,
          opacity: Math.max(0.42, 0.7 - depth * 0.08),
          transform: [
            { perspective: 900 },
            { translateY: -depth * 12 },
            { scale: 1 - depth * 0.032 },
            { rotateX: `${depth * 2.4}deg` },
            { rotateY: `${depth % 2 === 0 ? -depth * 1.8 : depth * 1.8}deg` },
          ],
        },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(85,224,180,0.18)', 'rgba(182,108,255,0.18)', 'rgba(255,255,255,0.2)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glassTube, styles.glassTubeOne]} />
      <View style={[styles.glassTube, styles.glassTubeTwo]} />
      <View style={[styles.glassTube, styles.glassTubeThree]} />
      <View style={styles.dateBadgeGhost}>
        <Text style={styles.dateBadgeGhostNo}>{ghostNo}</Text>
      </View>
      <View style={styles.deckGhostOrb} />
      <View style={styles.deckGhostLineWide} />
      <View style={styles.deckGhostLine} />
    </Animated.View>
  )
}

function FloatingDateBadge({ plate, ghostIndex }: { plate?: VisitPlate; ghostIndex?: number }) {
  const pulse = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    )
  }, [pulse])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.055 }],
    opacity: 0.88 + pulse.value * 0.12,
  }))

  const date = plate ? new Date(plate.visited_at) : null
  const month = date ? String(date.getMonth() + 1).padStart(2, '0') : '--'
  const day = date ? String(date.getDate()).padStart(2, '0') : '--'
  const no = String(plate?.visitOrdinal ?? ghostIndex ?? 1).padStart(2, '0')

  return (
    <Animated.View pointerEvents="none" style={[styles.dateBadge, animatedStyle]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(32,27,36,0.92)', 'rgba(127,92,255,0.82)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.dateBadgeMonth}>{month}</Text>
      <Text style={styles.dateBadgeDivider}>/</Text>
      <Text style={styles.dateBadgeDay}>{day}</Text>
      <View style={styles.dateBadgeNoWrap}>
        <Text style={styles.dateBadgeNo}>{no}</Text>
      </View>
    </Animated.View>
  )
}

function PlateDetailModal({
  plate,
  visible,
  onClose,
  onReload,
  onAddMedia,
}: {
  plate: VisitPlate
  visible: boolean
  onClose: () => void
  onReload: () => void
  onAddMedia: () => void
}) {
  const insets = useSafeAreaInsets()
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState(plate.comment ?? '')
  const [rating, setRating] = useState(plate.rating ?? 0)
  const [saving, setSaving] = useState(false)

  const saveEdit = async () => {
    setSaving(true)
    await updateVisit(plate.id, {
      comment: comment.trim() || null,
      rating: rating > 0 ? rating : null,
    })
    setSaving(false)
    setEditing(false)
    onReload()
  }

  const deletePlate = () => {
    Alert.alert('プレートを削除', '思い出も非表示になります（復元不可の論理削除）。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await softDeleteVisit(plate.id)
          onClose()
          onReload()
        },
      },
    ])
  }

  const deleteMemory = (memoryId: string) => {
    Alert.alert('メディアを削除', 'この写真/動画を非表示にします。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await softDeleteMemory(memoryId)
          onReload()
        },
      },
    ])
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.detailRoot, { paddingTop: insets.top }]}>
        <View style={styles.detailHead}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {plate.spot.name}
          </Text>
          <View style={styles.detailHeadActions}>
            <Pressable style={styles.detailIconBtn} onPress={() => setEditing(true)} hitSlop={8} accessibilityLabel="レビューを編集">
              <Ionicons name="create-outline" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable style={[styles.detailIconBtn, styles.detailDeleteIconBtn]} onPress={deletePlate} hitSlop={8} accessibilityLabel="レビューを削除">
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.detailBody}>
          <Text style={styles.detailMeta}>
            {formatVisitDate(plate.visited_at)} · {plate.spot.category} · {plate.visitOrdinal}回目
          </Text>

          {plate.rating ? (
            <View style={styles.ratingDisplay}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= plate.rating! ? 'star' : 'star-outline'}
                  size={16}
                  color={colors.gold}
                />
              ))}
            </View>
          ) : null}

          {plate.comment ? <Text style={styles.comment}>{plate.comment}</Text> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {plate.memories.map((m) => (
              <Pressable key={m.id} style={styles.detailThumbWrap} onLongPress={() => deleteMemory(m.id)}>
                {m.signedUrl ? (
                  <SafeRemoteImage
                    uri={m.signedUrl}
                    style={styles.detailThumb}
                    contentFit="cover"
                    recyclingKey={m.id}
                    fallback={<View style={[styles.detailThumb, styles.thumbPlaceholder]} />}
                  />
                ) : (
                  <View style={[styles.detailThumb, styles.thumbPlaceholder]} />
                )}
                {m.media_type === 'video' ? (
                  <View style={styles.videoBadge}>
                    <Ionicons name="play" size={14} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            ))}
            <Pressable style={styles.addThumb} onPress={onAddMedia}>
              <Ionicons name="add" size={28} color={colors.brandDark} />
            </Pressable>
          </ScrollView>

        </ScrollView>

        <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
          <Pressable style={styles.modalBg} onPress={() => setEditing(false)}>
            <Pressable style={styles.editSheet} onPress={() => {}}>
              <Text style={styles.editTitle}>プレートを編集</Text>
              <Text style={styles.editLbl}>ひとこと（日記）</Text>
              <TextInput
                style={styles.input}
                value={comment}
                onChangeText={setComment}
                placeholder="今日の思い出..."
                multiline
                maxLength={500}
              />
              <Text style={styles.editLbl}>評価</Text>
              <StarRow value={rating} onChange={setRating} />
              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={() => void saveEdit()}
              >
                <Text style={styles.saveBtnTxt}>{saving ? '保存中...' : '保存'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </Modal>
  )
}

/**
 * 思い出コンポーザー — 写真選択・評価・ひとことを1つの「レビュー」として保存。
 * 保存完了で VLOG ゲージが進む体験につなげる。
 */
function MemoryComposerModal({
  plate,
  dogName,
  userId,
  visible,
  onClose,
  onSaved,
}: {
  plate: VisitPlate
  dogName: string
  userId: string
  visible: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const insets = useSafeAreaInsets()
  const [picked, setPicked] = useState<PickedMedia[]>([])
  const [rating, setRating] = useState(plate.rating ?? 0)
  const [comment, setComment] = useState(plate.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')

  const existingCount = plate.memories.length
  const towardVlog = Math.max(0, 2 - existingCount - picked.length)

  const addMedia = async () => {
    const items = await pickMemoryMediaMulti(10)
    if (!items) return
    setPicked((prev) => [...prev, ...items].slice(0, 10))
  }

  const removePicked = (index: number) => {
    setPicked((prev) => prev.filter((_, i) => i !== index))
  }

  const canSave = picked.length > 0 || rating !== (plate.rating ?? 0) || comment.trim() !== (plate.comment ?? '')

  const save = async () => {
    if (saving || !canSave) return
    setSaving(true)
    try {
      let failed = 0
      for (let i = 0; i < picked.length; i++) {
        setSaveLabel(`思い出を保存中 ${i + 1}/${picked.length}`)
        const item = picked[i]
        const uploaded = await uploadMemoryFile(userId, item.uri, item.mimeType)
        if (!uploaded.ok) {
          console.warn('[MemoryComposer] upload failed:', uploaded.message)
          failed++
          continue
        }
        const { row, error } = await insertMemory({
          userId,
          visitId: plate.id,
          spotId: plate.spot_id,
          storagePath: uploaded.path,
          mediaType: uploaded.mediaType,
        })
        if (!row) {
          console.warn('[MemoryComposer] insert failed:', error ? formatVisitRecordError(error) : 'unknown')
          failed++
        }
      }

      const trimmed = comment.trim()
      if (rating !== (plate.rating ?? 0) || trimmed !== (plate.comment ?? '')) {
        setSaveLabel('メモを保存中...')
        await updateVisit(plate.id, {
          comment: trimmed || null,
          rating: rating > 0 ? rating : null,
        })
      }

      if (failed > 0) {
        Alert.alert(
          '一部の保存に失敗しました',
          `${failed}件の写真・動画を保存できませんでした。時間をおいて再度お試しください。`
        )
      }
      track('memory_review_saved', {
        media_count: picked.length - failed,
        has_rating: rating > 0,
        has_comment: trimmed.length > 0,
      })
      setPicked([])
      onSaved()
    } finally {
      setSaving(false)
      setSaveLabel('')
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.composerRoot, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.composerHead}>
          <Pressable onPress={onClose} hitSlop={8} disabled={saving}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.composerHeadCenter}>
            <Text style={styles.composerTitle} numberOfLines={1}>
              {plate.spot.name}
            </Text>
            <Text style={styles.composerMeta}>
              {formatVisitDate(plate.visited_at)} · {plate.visitOrdinal}回目
            </Text>
          </View>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.composerBody} keyboardShouldPersistTaps="handled">
          <View style={styles.composerHero}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(85,224,180,0.22)', 'rgba(182,108,255,0.16)', 'rgba(255,255,255,0.94)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.composerHeroIcon}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </View>
            <Text style={styles.composerKicker}>REVIEW ALBUM</Text>
            <Text style={styles.composerLead}>レビューをアルバムに残す</Text>
            <Text style={styles.composerHeroSub} numberOfLines={2}>
              写真・評価・ひとことを残すと、アルバムに追加されてVlog素材として選べます。
            </Text>
            <View style={styles.composerProgressPill}>
              <Ionicons name={towardVlog > 0 ? 'images-outline' : 'checkmark-circle'} size={14} color={towardVlog > 0 ? '#7F5CFF' : '#1D9B72'} />
              <Text style={[styles.composerHint, towardVlog <= 0 && styles.composerHintDone]}>
                {towardVlog > 0 ? `写真・動画あと${towardVlog}枚でVlog素材` : 'このスポットはVlog素材ばっちり'}
              </Text>
            </View>
          </View>

          <View style={styles.mediaPanel}>
            <View style={styles.mediaPanelHead}>
              <Text style={styles.composerLbl}>写真・動画</Text>
              <Text style={styles.mediaCountTxt}>{picked.length}/10</Text>
            </View>
            <View style={styles.mediaGrid}>
              {picked.length === 0 ? (
                <Pressable style={styles.mediaAddLarge} onPress={() => void addMedia()} disabled={saving}>
                  <View style={styles.mediaAddOrb}>
                    <Ionicons name="images" size={28} color="#fff" />
                  </View>
                  <Text style={styles.mediaAddLargeTxt}>写真・動画をえらぶ</Text>
                  <Text style={styles.mediaAddLargeSub}>まずは1枚から。あとで追加できます。</Text>
                </Pressable>
              ) : (
                <>
                  {picked.map((item, i) => (
                    <View key={`${item.uri}-${i}`} style={styles.mediaCell}>
                      {item.mimeType.startsWith('video/') ? (
                        <View style={[styles.mediaThumb, styles.mediaVideo]}>
                          <Ionicons name="play-circle" size={28} color="#fff" />
                          <Text style={styles.mediaVideoTxt}>動画</Text>
                        </View>
                      ) : (
                        <Image source={{ uri: item.uri }} style={styles.mediaThumb} contentFit="cover" />
                      )}
                      <Pressable style={styles.mediaRemove} onPress={() => removePicked(i)} hitSlop={6} disabled={saving}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable style={styles.mediaAdd} onPress={() => void addMedia()} disabled={saving}>
                    <Ionicons name="add" size={24} color="#7F5CFF" />
                    <Text style={styles.mediaAddTxt}>追加</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <View style={styles.composerSection}>
            <Text style={styles.composerLbl}>このスポット、どうだった？</Text>
            <StarRow value={rating} onChange={setRating} />
          </View>

          <View style={styles.composerSection}>
            <Text style={styles.composerLbl}>ひとことメモ</Text>
            <TextInput
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder={`${dogName}、たのしそうだった？`}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              editable={!saving}
            />
          </View>
        </ScrollView>

        <View style={styles.composerFooter}>
          <Pressable
            style={[styles.composerSave, (!canSave || saving) && styles.composerSaveDisabled]}
            disabled={!canSave || saving}
            onPress={() => void save()}
          >
            <Text style={[styles.composerSaveTxt, (!canSave || saving) && styles.composerSaveTxtDisabled]}>
              {saving ? saveLabel || '保存中...' : picked.length > 0 ? `レビューを残す（${picked.length}枚）` : 'レビューを残す'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function FeedTile({
  plate,
  onOpen,
  onAddMedia,
}: {
  plate: VisitPlate
  onOpen: () => void
  onAddMedia: () => void
}) {
  const cover = plate.memories[0]
  const isEmpty = plate.memories.length === 0

  if (isEmpty) {
    return (
      <Pressable style={[styles.tile, styles.tileEmpty]} onPress={onAddMedia}>
        <View style={styles.tileEmptyIcon}>
          <Ionicons name="camera" size={22} color="#fff" />
        </View>
        <Text style={styles.tileEmptyTxt}>レビューを残す</Text>
        <Text style={styles.tileEmptySub} numberOfLines={2}>
          {plate.spot.name}
        </Text>
        <View style={styles.tileEmptyBadge}>
          <Text style={styles.tileEmptyBadgeTxt}>写真2枚でVLOG素材に</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Pressable style={styles.tile} onPress={onOpen}>
      {cover?.signedUrl ? (
        <SafeRemoteImage
          uri={cover.signedUrl}
          style={styles.tileImg}
          contentFit="cover"
          recyclingKey={cover.id}
          fallback={<View style={[styles.tileImg, styles.thumbPlaceholder]} />}
        />
      ) : (
        <View style={[styles.tileImg, styles.thumbPlaceholder]} />
      )}
      <View style={styles.tileGrad} />
      {plate.rating ? (
        <View style={styles.tileStar}>
          <Ionicons name="star" size={12} color={colors.gold} />
          <Text style={styles.tileStarTxt}>{plate.rating}</Text>
        </View>
      ) : null}
      {cover?.media_type === 'video' ? (
        <View style={styles.tilePlay}>
          <Ionicons name="play" size={12} color="#fff" />
        </View>
      ) : null}
      <View style={styles.tileCaption}>
        <Text style={styles.tileSpot} numberOfLines={1}>
          {plate.spot.name}
        </Text>
        <Text style={styles.tileDate}>{formatVisitDate(plate.visited_at)}</Text>
      </View>
    </Pressable>
  )
}

function ReviewDeckCard({
  plate,
  index,
  selected,
  selectionMode,
  onOpen,
  onSelect,
  onAddMedia,
}: {
  plate: VisitPlate
  index: number
  selected: boolean
  selectionMode: boolean
  onOpen: () => void
  onSelect: () => void
  onAddMedia: () => void
}) {
  const cover = plate.memories[0]
  const hasReview = plate.memories.length > 0 || !!plate.comment || !!plate.rating
  const depth = Math.min(index, 4)
  const cardStyle = [
    styles.deckCard,
    {
      minHeight: hasReview ? (index === 0 ? DECK_CARD_H : Math.round(DECK_CARD_H * 0.82)) : 236,
      zIndex: 20 - index,
      opacity: selectionMode ? 1 : Math.max(0.76, 1 - depth * 0.07),
      transform: [
        { perspective: 900 },
        { translateY: index === 0 ? 0 : -depth * 12 },
        { scale: 1 - depth * 0.032 },
        { rotateX: `${depth * 2.4}deg` },
        { rotateY: `${depth % 2 === 0 ? -depth * 1.8 : depth * 1.8}deg` },
      ],
    },
    selected && styles.deckCardSelected,
    !hasReview && styles.deckCardEmpty,
  ]

  if (!hasReview) {
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(260)} style={cardStyle}>
        <Pressable style={styles.deckEmptyInner} onPress={onAddMedia}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(85,224,180,0.22)', 'rgba(182,108,255,0.16)', 'rgba(255,255,255,0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.glassTube, styles.glassTubeOne]} />
          <View style={[styles.glassTube, styles.glassTubeTwo]} />
          <View style={[styles.glassTube, styles.glassTubeThree]} />
          <FloatingDateBadge plate={plate} />
          <View style={styles.deckEmptyIcon}>
            <Ionicons name="sparkles" size={22} color="#fff" />
          </View>
          <Text style={styles.deckEmptyKicker}>REVIEW ALBUM</Text>
          <Text style={styles.deckEmptyTitle}>レビューをアルバムに残す</Text>
          <Text style={styles.deckEmptySub} numberOfLines={2}>
            {plate.spot.name}
          </Text>
          <View style={styles.deckEmptyPill}>
            <Ionicons name="images-outline" size={14} color="#7F5CFF" />
            <Text style={styles.deckEmptyPillText}>このレビューからVlog化できます</Text>
          </View>
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(260)} style={cardStyle}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.04)', 'rgba(127,92,255,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.glassTube, styles.cardGlassTubeTop]} />
      <View pointerEvents="none" style={[styles.glassTube, styles.cardGlassTubeBottom]} />
      <FloatingDateBadge plate={plate} />
      <Pressable
        style={styles.deckPressable}
        onPress={selectionMode ? onSelect : onOpen}
        onLongPress={onSelect}
        delayLongPress={260}
        accessibilityRole="button"
        accessibilityLabel={selectionMode ? 'Vlogに使うレビューを選択' : 'レビュー詳細を開く'}
      >
        <View style={styles.deckPhoto}>
          {cover?.signedUrl ? (
            <SafeRemoteImage
              uri={cover.signedUrl}
              style={styles.deckPhotoImg}
              contentFit="cover"
              recyclingKey={cover.id}
              fallback={<View style={[styles.deckPhotoImg, styles.thumbPlaceholder]} />}
            />
          ) : (
            <View style={[styles.deckPhotoImg, styles.thumbPlaceholder]} />
          )}
          <View style={styles.deckPhotoScrim} />
          {cover?.media_type === 'video' ? (
            <View style={styles.deckVideoBadge}>
              <Ionicons name="play" size={13} color="#fff" />
            </View>
          ) : null}
          {selectionMode || selected ? (
            <View style={styles.deckSelectPill}>
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={17}
                color={selected ? '#FF765F' : '#5D514C'}
              />
              <Text style={[styles.deckSelectText, selected && styles.deckSelectTextOn]}>
                {selected ? '選択中' : '選択'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.deckInfo}>
          <View style={styles.deckTitleRow}>
            <Text style={styles.deckTitle} numberOfLines={1}>
              {plate.spot.name}
            </Text>
            <Pressable
              style={styles.deckEditBtn}
              onPress={(event) => {
                event.stopPropagation()
                onOpen()
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="レビュー詳細と編集を開く"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#5D514C" />
            </Pressable>
          </View>
          <View style={styles.deckMetaRow}>
            <Ionicons name="calendar-outline" size={14} color="#725F58" />
            <Text style={styles.deckMeta}>{formatVisitDate(plate.visited_at)}</Text>
            {plate.rating ? (
              <>
                <Text style={styles.deckDot}>・</Text>
                <Ionicons name="star" size={14} color={colors.gold} />
                <Text style={styles.deckMeta}>{plate.rating}</Text>
              </>
            ) : null}
          </View>
          <Text style={styles.deckComment} numberOfLines={2}>
            {plate.comment?.trim() || '写真・評価・ひとことを追加すると、このレビューをVlog素材として選べます。'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

export function ReviewAlbumTimeline({ userId, dogName, plates, loading, onReload, onOpenTutorial }: Props) {
  const router = useRouter()
  const [detailPlate, setDetailPlate] = useState<VisitPlate | null>(null)
  const [composerPlate, setComposerPlate] = useState<VisitPlate | null>(null)
  const [selectedPlateIds, setSelectedPlateIds] = useState<Set<string>>(() => new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationStage, setGenerationStage] = useState<VlogRenderStage>('selecting')
  const [generateBusy, setGenerateBusy] = useState(false)

  const reviewedPlates = useMemo(
    () => plates.filter((plate) => plate.memories.length > 0 || !!plate.comment || !!plate.rating),
    [plates]
  )
  const selectedPlates = useMemo(
    () => reviewedPlates.filter((plate) => selectedPlateIds.has(plate.id)),
    [reviewedPlates, selectedPlateIds]
  )
  const selectedCount = selectedPlates.length

  const displayDogName = dogName?.trim() || '愛犬'

  const openComposer = useCallback((plate: VisitPlate) => {
    setDetailPlate(null)
    setComposerPlate(plate)
  }, [])

  const onComposerSaved = useCallback(() => {
    setComposerPlate(null)
    onReload()
    setCelebrating(true)
    setTimeout(() => setCelebrating(false), 4000)
  }, [onReload])

  const togglePlateSelection = useCallback((plate: VisitPlate) => {
    if (plate.memories.length === 0 && !plate.comment && !plate.rating) {
      openComposer(plate)
      return
    }
    setSelectionMode(true)
    setSelectedPlateIds((prev) => {
      const next = new Set(prev)
      if (next.has(plate.id)) {
        next.delete(plate.id)
      } else {
        next.add(plate.id)
      }
      return next
    })
  }, [openComposer])

  const clearSelection = useCallback(() => {
    setSelectedPlateIds(new Set())
    setSelectionMode(false)
  }, [])

  const handleGenerateVlog = useCallback(async () => {
    if (generateBusy || generating || selectedPlates.length === 0 || !userId) return
    setGenerateBusy(true)
    setGenerating(true)
    setGenerationStage('selecting')
    track('vlog_generate_start', { selected_count: selectedPlates.length })
    logUserEvent({ eventType: 'vlog_generate', userId, props: { spot_count: selectedPlates.length } })

    const payload = await buildVlogRenderPayloadAsync(selectedPlates, displayDogName)

    try {
      await simulateVlogGenerationStages(setGenerationStage)
      const res = await requestVlogRender(payload)
      if (res.ok) {
        track('vlog_generate_success')
        router.push({ pathname: '/vlog/preview', params: { uri: res.result.videoUrl } })
        return
      }
      if (res.error.code === 'not_ready') {
        track('vlog_generate_demo')
        router.push({ pathname: '/vlog/preview', params: { demo: '1' } })
        return
      }
      Alert.alert('VLOG生成に失敗しました', res.error.message)
    } finally {
      setGenerating(false)
      setGenerateBusy(false)
    }
  }, [generateBusy, generating, selectedPlates, userId, displayDogName, router])

  if (!userId) {
    return (
      <View style={styles.guest}>
        <Text style={styles.guestTxt}>ログインすると、自分だけのアルバムが使えます。</Text>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.albumAura}>
        <View style={styles.albumAuraWarm} />
        <View style={styles.albumAuraMint} />
      </View>
      {reviewedPlates.length > 0 ? (
        <View style={styles.deckHeaderCompact}>
          <Pressable
            style={styles.deckVlogButton}
            onPress={() => setSelectionMode(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Vlogにするレビューを選ぶ"
          >
            <Ionicons name="film-outline" size={19} color="#fff" />
            <Text style={styles.deckVlogButtonText}>Vlogを作る</Text>
          </Pressable>
        </View>
      ) : null}

      {selectionMode ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(160)} style={styles.selectionBar}>
          <Text style={styles.selectionBarText}>Vlogにするレビューを{selectedCount}件選択中</Text>
          <Pressable onPress={clearSelection} hitSlop={8} accessibilityRole="button" accessibilityLabel="選択を解除">
            <Text style={styles.selectionBarCancel}>キャンセル</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {celebrating ? (
        <Animated.View entering={FadeInDown.springify()} exiting={FadeOut.duration(200)} style={styles.celebration}>
          <Text style={styles.celebrationTitle}>レビューをアルバムに追加しました</Text>
          <Text style={styles.celebrationSub}>アルバムに追加しました。タップするとVlog素材に選べます。</Text>
        </Animated.View>
      ) : null}

      {loading && plates.length === 0 ? (
        <View style={styles.loadingDeck}>
          <View style={styles.loadingOrb}>
            <Ionicons name="sparkles" size={22} color="#FF765F" />
          </View>
          <Text style={styles.loadingTitle}>レビューアルバムを準備中</Text>
          <Text style={styles.loadingSub}>写真とレビューをカードに並べています</Text>
          <View style={styles.loadingCard}>
            <View style={styles.loadingPhoto} />
            <View style={styles.loadingLineWide} />
            <View style={styles.loadingLine} />
          </View>
        </View>
      ) : plates.length > 0 ? (
        <View style={styles.deck}>
          {plates.map((plate, index) => (
            <ReviewDeckCard
              key={plate.id}
              plate={plate}
              index={index}
              selected={selectedPlateIds.has(plate.id)}
              selectionMode={selectionMode}
              onOpen={() => setDetailPlate(plate)}
              onSelect={() => togglePlateSelection(plate)}
              onAddMedia={() => openComposer(plate)}
            />
          ))}
          {plates.length < 3
            ? Array.from({ length: 3 - plates.length }).map((_, i) => (
                <DeckGhostCard key={`deck-ghost-${i}`} index={plates.length + i} />
              ))
            : null}
        </View>
      ) : !loading ? (
        <View style={styles.emptyCard}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(85,224,180,0.22)', 'rgba(182,108,255,0.16)', 'rgba(255,255,255,0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <EmptyAlbumMotion />
          <Text style={styles.emptyKicker}>REVIEW ALBUM</Text>
          <Text style={styles.emptyTitle}>レビューがここに並びます</Text>
          <Text style={styles.emptySub}>
            行ったスポットでレビューを書くと、この空間にカードが増えて、選んだレビューからVlog化できます。
          </Text>
          <Pressable style={styles.addBtn} onPress={() => router.push('/(tabs)/search')}>
            <Text style={styles.addBtnTxt}>スポットを探して記録する</Text>
          </Pressable>
        </View>
      ) : null}

      {selectedCount > 0 || generating ? (
        <View style={styles.vlogDockWrap}>
          <Pressable
            style={[styles.vlogDock, selectedCount === 0 && styles.vlogDockDisabled]}
            onPress={() => void handleGenerateVlog()}
            disabled={selectedCount === 0 || generateBusy || generating}
            accessibilityRole="button"
            accessibilityLabel={selectedCount > 0 ? `${selectedCount}件のレビューでVlogを作る` : 'レビューを選択してVlogを作る'}
          >
            <View style={styles.vlogThumbStack}>
              {selectedPlates.slice(0, 3).map((plate, index) => {
                const cover = plate.memories[0]
                return (
                  <View key={plate.id} style={[styles.vlogThumb, { marginLeft: index === 0 ? 0 : -10 }]}>
                    {cover?.signedUrl ? (
                      <SafeRemoteImage
                        uri={cover.signedUrl}
                        style={styles.vlogThumbImg}
                        contentFit="cover"
                        recyclingKey={cover.id}
                        fallback={<View style={[styles.vlogThumbImg, styles.thumbPlaceholder]} />}
                      />
                    ) : (
                      <Ionicons name="images" size={16} color="#FF765F" />
                    )}
                  </View>
                )
              })}
              {selectedCount === 0 ? (
                <View style={styles.vlogThumb}>
                  <Ionicons name="sparkles-outline" size={16} color="#FF765F" />
                </View>
              ) : null}
            </View>
            <View style={styles.vlogDockCopy}>
              <Text style={[styles.vlogDockTitle, selectedCount === 0 && styles.vlogDockTitleDisabled]}>
                {selectedCount > 0 ? `${selectedCount}件のレビューでVlogを作る` : 'レビューを選んでVlogへ'}
              </Text>
              <Text style={styles.vlogDockSub}>選んだカードだけを映像素材にします</Text>
            </View>
            <View style={[styles.vlogDockArrow, selectedCount === 0 && styles.vlogDockArrowDisabled]}>
              <Ionicons name={generating ? 'hourglass-outline' : 'arrow-forward'} size={20} color="#fff" />
            </View>
          </Pressable>
          <VlogGeneratingPanel stage={generationStage} visible={generating} />
        </View>
      ) : null}

      {detailPlate ? (
        <PlateDetailModal
          plate={detailPlate}
          visible={detailPlate != null}
          onClose={() => setDetailPlate(null)}
          onReload={onReload}
          onAddMedia={() => openComposer(detailPlate)}
        />
      ) : null}

      {composerPlate && userId ? (
        <MemoryComposerModal
          plate={composerPlate}
          dogName={displayDogName}
          userId={userId}
          visible={composerPlate != null}
          onClose={() => setComposerPlate(null)}
          onSaved={onComposerSaved}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GRID_PAD, gap: 14, marginTop: 4, paddingBottom: 8, position: 'relative' },
  albumAura: {
    position: 'absolute',
    left: -16,
    right: -16,
    top: -40,
    height: 360,
    overflow: 'hidden',
  },
  albumAuraWarm: {
    position: 'absolute',
    top: 6,
    right: -72,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,207,119,0.24)',
  },
  albumAuraMint: {
    position: 'absolute',
    top: 148,
    left: -76,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(94,240,210,0.20)',
  },
  deckHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  deckHeaderCompact: {
    minHeight: 40,
    alignItems: 'flex-end',
    marginTop: -2,
    marginBottom: -4,
  },
  deckHeaderActions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  deckVlogButton: {
    minWidth: 112,
    height: 38,
    borderRadius: 19,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F5CFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  deckVlogButtonText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  selectionBar: {
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.62)',
  },
  selectionBarText: { fontSize: 14, fontWeight: '900', color: '#2E2825' },
  selectionBarCancel: { fontSize: 13, fontWeight: '800', color: '#FF765F' },
  deck: {
    alignItems: 'center',
    gap: -18,
    paddingTop: 2,
    paddingBottom: 32,
  },
  deckCard: {
    position: 'relative',
    width: DECK_CARD_W,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(246,248,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#22113A',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  deckCardHero: {
    minHeight: DECK_CARD_H,
    transform: [{ perspective: 900 }, { scale: 1 }],
  },
  deckCardPreview: {
    minHeight: 122,
    opacity: 0.72,
    transform: [{ perspective: 900 }, { scale: 0.93 }, { rotateX: '3deg' }],
  },
  deckCardSelected: {
    borderWidth: 2,
    borderColor: 'rgba(255,118,95,0.95)',
    shadowColor: '#FF765F',
    shadowOpacity: 0.26,
    shadowRadius: 22,
  },
  deckCardEmpty: {
    minHeight: 236,
    backgroundColor: 'rgba(246,248,255,0.92)',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.82)',
    opacity: 1,
    transform: [{ perspective: 900 }, { scale: 1 }],
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.22,
    shadowRadius: 28,
  },
  deckGhostCard: {
    width: DECK_CARD_W,
    minHeight: 188,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(218,230,234,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    shadowColor: '#22113A',
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
  },
  glassTube: {
    position: 'absolute',
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#fff',
    shadowOpacity: 0.34,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  glassTubeOne: {
    top: 24,
    left: 28,
    width: '66%',
    transform: [{ rotate: '-7deg' }],
  },
  glassTubeTwo: {
    top: 74,
    right: 22,
    width: '54%',
    height: 18,
    opacity: 0.74,
    transform: [{ rotate: '8deg' }],
  },
  glassTubeThree: {
    bottom: 28,
    left: 44,
    width: '48%',
    height: 16,
    opacity: 0.58,
    transform: [{ rotate: '-3deg' }],
  },
  cardGlassTubeTop: {
    top: 18,
    left: 22,
    width: '64%',
    opacity: 0.48,
    transform: [{ rotate: '-6deg' }],
  },
  cardGlassTubeBottom: {
    bottom: 84,
    right: 18,
    width: '56%',
    height: 18,
    opacity: 0.36,
    transform: [{ rotate: '7deg' }],
  },
  deckGhostOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(127,92,255,0.24)',
  },
  deckGhostLineWide: { width: '46%', height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.54)' },
  deckGhostLine: { width: '30%', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.38)' },
  dateBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 6,
    minWidth: 92,
    height: 46,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    shadowColor: '#22113A',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  dateBadgeMonth: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -1,
    color: '#fff',
    fontFamily: Platform.select({ ios: 'AvenirNextCondensed-Heavy', default: undefined }),
  },
  dateBadgeDivider: {
    marginHorizontal: 1,
    fontSize: 16,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.6)',
  },
  dateBadgeDay: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -1.6,
    color: '#DFFCF4',
    fontFamily: Platform.select({ ios: 'AvenirNextCondensed-Heavy', default: undefined }),
  },
  dateBadgeNoWrap: {
    marginLeft: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  dateBadgeNo: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    color: '#fff',
    fontFamily: Platform.select({ ios: 'AvenirNextCondensed-Heavy', default: undefined }),
  },
  dateBadgeGhost: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 54,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32,27,36,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  dateBadgeGhostNo: {
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -1.4,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: Platform.select({ ios: 'AvenirNextCondensed-Heavy', default: undefined }),
  },
  deckPressable: { flex: 1 },
  deckPhoto: {
    height: 210,
    margin: 10,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#2A2522',
  },
  deckPhotoImg: { ...StyleSheet.absoluteFillObject },
  deckPhotoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  deckVideoBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  deckSelectPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  deckSelectText: { fontSize: 11, fontWeight: '800', color: '#5D514C' },
  deckSelectTextOn: { color: '#FF765F' },
  deckInfo: { paddingHorizontal: 18, paddingTop: 2, paddingBottom: 18, gap: 9 },
  deckTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deckTitle: { flex: 1, fontSize: 21, fontWeight: '900', color: '#2D2522', lineHeight: 27 },
  deckEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.54)',
  },
  deckMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deckMeta: { fontSize: 13, fontWeight: '700', color: '#725F58' },
  deckDot: { fontSize: 13, fontWeight: '900', color: '#8B7A73' },
  deckComment: { fontSize: 14, fontWeight: '700', lineHeight: 21, color: '#4B3B36' },
  deckEmptyInner: {
    minHeight: 236,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  deckEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7F5CFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  deckEmptyKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(46,40,37,0.44)',
  },
  deckEmptyTitle: { fontSize: 20, fontWeight: '900', color: '#2A2522', lineHeight: 27 },
  deckEmptySub: { fontSize: 13, fontWeight: '800', color: '#5E514C', textAlign: 'center' },
  deckEmptyPill: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(46,40,37,0.08)',
  },
  deckEmptyPillText: { fontSize: 12, fontWeight: '900', color: '#7F5CFF' },
  vlogDockWrap: { gap: 8, paddingTop: 4 },
  vlogDock: {
    minHeight: 64,
    borderRadius: 32,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    shadowColor: '#24584E',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  vlogDockDisabled: { opacity: 0.78 },
  vlogThumbStack: { flexDirection: 'row', alignItems: 'center', minWidth: 44 },
  vlogThumb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  vlogThumbImg: { width: '100%', height: '100%' },
  vlogDockCopy: { flex: 1, gap: 2 },
  vlogDockTitle: { fontSize: 16, fontWeight: '900', color: '#2E2825' },
  vlogDockTitleDisabled: { color: '#786B65' },
  vlogDockSub: { fontSize: 11, fontWeight: '700', color: '#756861' },
  vlogDockArrow: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF765F',
  },
  vlogDockArrowDisabled: { backgroundColor: 'rgba(142,142,147,0.58)' },
  intro: { gap: 6, paddingHorizontal: 2, marginTop: 2 },
  introTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: GOOGLE_HOME.textPrimary,
    lineHeight: 26,
  },
  introSub: {
    fontSize: 13,
    fontWeight: '600',
    color: GOOGLE_HOME.textSecondary,
    lineHeight: 18,
  },
  emptyCard: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  emptyCoverFlow: {
    width: '100%',
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPreviewStage: {
    width: '100%',
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyGhostCard: {
    position: 'absolute',
    width: '72%',
    height: 78,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.52)',
  },
  emptyGhostBack: {
    top: 4,
    transform: [{ perspective: 900 }, { rotateX: '10deg' }, { scale: 0.78 }],
    opacity: 0.5,
  },
  emptyGhostMid: {
    top: 28,
    transform: [{ perspective: 900 }, { rotateX: '6deg' }, { scale: 0.88 }],
    opacity: 0.72,
  },
  emptyGhostFront: {
    position: 'absolute',
    top: 56,
    width: '86%',
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.86)',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  emptyGlassTubeOne: {
    top: 10,
    left: 18,
    width: '70%',
    height: 16,
    opacity: 0.7,
    transform: [{ rotate: '-5deg' }],
  },
  emptyGlassTubeTwo: {
    bottom: 12,
    right: 16,
    width: '56%',
    height: 14,
    opacity: 0.54,
    transform: [{ rotate: '6deg' }],
  },
  emptyGhostLineWide: {
    marginTop: 8,
    width: '44%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(127,92,255,0.18)',
  },
  emptyGhostLine: {
    marginTop: 6,
    width: '28%',
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(127,92,255,0.12)',
  },
  emptyHeroCard: {
    position: 'absolute',
    top: 70,
    width: '86%',
    height: 96,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.64)',
    shadowColor: '#FF765F',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  emptyHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F5CFF',
  },
  emptyKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(46,40,37,0.44)',
  },
  emptyHeroLineWide: { width: '54%', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.76)' },
  emptyHeroLine: { width: '36%', height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.54)' },
  emptyParticle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  emptyParticleOne: { top: 42, left: 50 },
  emptyParticleTwo: { top: 70, right: 46, backgroundColor: 'rgba(111,240,211,0.8)' },
  emptyParticleThree: { bottom: 18, left: 74, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,211,111,0.82)' },
  emptyTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#2A2522',
    textAlign: 'center',
    lineHeight: 26,
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5E514C',
    textAlign: 'center',
    lineHeight: 20,
  },
  addBtn: {
    marginTop: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 15,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  addBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  celebration: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  celebrationTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  celebrationSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  loaderWrap: { paddingVertical: 40, alignItems: 'center' },
  loadingDeck: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  loadingOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    marginBottom: 2,
  },
  loadingTitle: { fontSize: 17, fontWeight: '900', color: GOOGLE_HOME.textPrimary },
  loadingSub: { fontSize: 12, fontWeight: '700', color: GOOGLE_HOME.textSecondary, marginBottom: 8 },
  loadingCard: {
    alignSelf: 'stretch',
    borderRadius: 22,
    padding: 10,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  loadingPhoto: { height: 132, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.48)' },
  loadingLineWide: { width: '68%', height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.62)' },
  loadingLine: { width: '44%', height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.48)' },
  guest: { padding: 24, alignItems: 'center' },
  guestTxt: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#26252B',
    borderWidth: 1,
    borderColor: '#3A3A3F',
  },
  tileEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(60,60,67,0.24)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
  },
  tileEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  tileEmptyTxt: { fontSize: 13, fontWeight: '800', color: '#2A2522' },
  tileEmptySub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6E6E73',
    textAlign: 'center',
  },
  tileEmptyBadge: {
    marginTop: 4,
    backgroundColor: '#F1F1F3',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tileEmptyBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#5A5A5F' },
  tileImg: { ...StyleSheet.absoluteFillObject },
  tileGrad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  tileCaption: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  tileSpot: { fontSize: 13, fontWeight: '800', color: '#fff' },
  tileDate: { marginTop: 2, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  tileStar: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tileStarTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  tilePlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholder: { backgroundColor: '#e8e8e8' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  editSheet: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  editTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  editLbl: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  starRow: { flexDirection: 'row', gap: 4 },
  saveBtn: {
    marginTop: 8,
    backgroundColor: colors.textPrimary,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  detailRoot: { flex: 1, backgroundColor: colors.paper },
  detailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  detailHeadActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42,37,34,0.06)',
  },
  detailDeleteIconBtn: {
    backgroundColor: '#7F5CFF',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  detailBody: { padding: 16, gap: 12 },
  detailMeta: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  ratingDisplay: { flexDirection: 'row', gap: 2 },
  comment: { fontSize: 15, lineHeight: 24, color: colors.text, fontWeight: '600' },
  thumbRow: { gap: 8, paddingVertical: 4 },
  detailThumbWrap: { position: 'relative' },
  detailThumb: { width: 120, height: 120, borderRadius: 12, backgroundColor: colors.cardBg },
  videoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
  },
  composerRoot: { flex: 1, backgroundColor: '#F7F3EE' },
  composerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(46,40,37,0.08)',
    backgroundColor: 'rgba(255,255,255,0.84)',
  },
  composerHeadCenter: { flex: 1, alignItems: 'center', gap: 1 },
  composerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  composerMeta: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  composerBody: { padding: 16, gap: 14 },
  composerHero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.13,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  composerHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F5CFF',
    shadowColor: '#7F5CFF',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  composerKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(46,40,37,0.44)',
  },
  composerLead: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, lineHeight: 27, textAlign: 'center' },
  composerHeroSub: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  composerProgressPill: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(46,40,37,0.08)',
  },
  composerHint: { fontSize: 12, fontWeight: '900', color: '#7F5CFF' },
  composerHintDone: { color: colors.success },
  mediaPanel: {
    borderRadius: 24,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(46,40,37,0.08)',
  },
  mediaPanelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mediaCountTxt: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaCell: { position: 'relative' },
  mediaThumb: {
    width: (Dimensions.get('window').width - 32 - 16) / 3,
    height: (Dimensions.get('window').width - 32 - 16) / 3,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  mediaVideo: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#2A2522',
  },
  mediaVideoTxt: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  mediaRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaAdd: {
    width: (Dimensions.get('window').width - 32 - 16) / 3,
    height: (Dimensions.get('window').width - 32 - 16) / 3,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(127,92,255,0.5)',
    backgroundColor: 'rgba(127,92,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mediaAddTxt: { fontSize: 10, fontWeight: '900', color: '#7F5CFF', textAlign: 'center', paddingHorizontal: 4 },
  mediaAddLarge: {
    width: '100%',
    minHeight: 150,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(127,92,255,0.42)',
    backgroundColor: 'rgba(127,92,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaAddOrb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F5CFF',
  },
  mediaAddLargeTxt: { fontSize: 16, fontWeight: '900', color: colors.textPrimary },
  mediaAddLargeSub: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  composerSection: {
    gap: 10,
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(46,40,37,0.08)',
  },
  composerLbl: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  composerFooter: {
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(46,40,37,0.08)',
    backgroundColor: 'rgba(247,243,238,0.94)',
  },
  composerSave: {
    backgroundColor: '#7F5CFF',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#7F5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  composerSaveDisabled: { backgroundColor: '#E5E5E5', shadowOpacity: 0, elevation: 0 },
  composerSaveTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  composerSaveTxtDisabled: { color: '#999' },
})
