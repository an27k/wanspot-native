import { useCallback, useMemo, useState } from 'react'
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
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeRemoteImage } from '@/components/common/SafeRemoteImage'
import { VlogProgressCard } from '@/components/album/VlogProgressCard'
import { RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { computeVlogProgressFromPlates } from '@/lib/album/vlog-progress'
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
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Ionicons name="create-outline" size={22} color={colors.textMuted} />
          </Pressable>
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

          <Pressable style={styles.deletePlateBtn} onPress={deletePlate}>
            <Text style={styles.deletePlateTxt}>プレートを削除</Text>
          </Pressable>
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
          <Text style={styles.composerLead}>{dogName}との思い出をのこそう🐾</Text>
          {towardVlog > 0 ? (
            <Text style={styles.composerHint}>写真・動画あと{towardVlog}枚でVLOGの1スポット分</Text>
          ) : (
            <Text style={styles.composerHintDone}>このスポットはVLOG素材ばっちり！</Text>
          )}

          <View style={styles.mediaGrid}>
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
              <Ionicons name="images" size={24} color={colors.primary} />
              <Text style={styles.mediaAddTxt}>{picked.length === 0 ? '写真・動画をえらぶ' : '追加'}</Text>
            </Pressable>
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
              {saving ? saveLabel || '保存中...' : picked.length > 0 ? `思い出をのこす（${picked.length}枚）` : '思い出をのこす'}
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
        <Text style={styles.tileEmptyTxt}>思い出をのこす</Text>
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

export function ReviewAlbumTimeline({ userId, dogName, plates, loading, onReload, onOpenTutorial }: Props) {
  const router = useRouter()
  const [detailPlate, setDetailPlate] = useState<VisitPlate | null>(null)
  const [composerPlate, setComposerPlate] = useState<VisitPlate | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationStage, setGenerationStage] = useState<VlogRenderStage>('selecting')
  const [generateBusy, setGenerateBusy] = useState(false)

  const vlogStats = useMemo(() => computeVlogProgressFromPlates(plates), [plates])

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

  const handleGenerateVlog = useCallback(async () => {
    if (generateBusy || generating || !vlogStats.isUnlocked || !userId) return
    setGenerateBusy(true)
    setGenerating(true)
    setGenerationStage('selecting')
    track('vlog_generate_start')
    logUserEvent({ eventType: 'vlog_generate', userId, props: { spot_count: vlogStats.completeUnits } })

    const payload = await buildVlogRenderPayloadAsync(plates, displayDogName)

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
  }, [generateBusy, generating, vlogStats.isUnlocked, userId, plates, displayDogName, router])

  if (!userId) {
    return (
      <View style={styles.guest}>
        <Text style={styles.guestTxt}>ログインすると、自分だけのアルバムが使えます。</Text>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <VlogProgressCard
        dogName={dogName}
        progress={vlogStats}
        onHelpPress={onOpenTutorial}
        generating={generating}
        generationStage={generationStage}
        generateBusy={generateBusy}
        onGeneratePress={() => void handleGenerateVlog()}
      />

      {!vlogStats.isUnlocked && !generating ? (
        <View style={styles.intro}>
          <Text style={styles.introTitle}>{displayDogName}のVLOGを作ろう！</Text>
          <Text style={styles.introSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            5スポット・各2枚以上の思い出で今月のVLOGが完成🐾
          </Text>
        </View>
      ) : null}

      {celebrating ? (
        <Animated.View entering={FadeInDown.springify()} exiting={FadeOut.duration(200)} style={styles.celebration}>
          <Text style={styles.celebrationTitle}>思い出をのこしました🐾</Text>
          <Text style={styles.celebrationSub}>{displayDogName}のVLOGがまた一歩、完成にちかづいたよ</Text>
        </Animated.View>
      ) : null}

      {loading && plates.length === 0 ? (
        <View style={styles.loaderWrap}>
          <RunningDog label="レビューを読み込み中..." />
        </View>
      ) : plates.length > 0 ? (
        <View style={styles.grid}>
          {plates.map((plate) => (
            <FeedTile
              key={plate.id}
              plate={plate}
              onOpen={() => setDetailPlate(plate)}
              onAddMedia={() => openComposer(plate)}
            />
          ))}
        </View>
      ) : !loading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>まずはおでかけから🐾</Text>
          <Text style={styles.emptySub}>
            スポット詳細で「行った」を押すと、{'\n'}ここに思い出のカードがならぶよ
          </Text>
          <Pressable style={styles.addBtn} onPress={() => router.push('/(tabs)/search')}>
            <Text style={styles.addBtnTxt}>スポットを探す</Text>
          </Pressable>
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
  wrap: { paddingHorizontal: GRID_PAD, gap: 14, marginTop: 4, paddingBottom: 8 },
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
    alignItems: 'center',
    gap: 8,
    backgroundColor: GOOGLE_HOME.panelBg,
    borderRadius: GOOGLE_HOME.radiusPanel,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.panelBorder,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: GOOGLE_HOME.textPrimary },
  emptySub: {
    fontSize: 13,
    fontWeight: '600',
    color: GOOGLE_HOME.textSecondary,
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
    borderColor: '#4A4A50',
    backgroundColor: 'rgba(22,20,26,0.35)',
    paddingHorizontal: 10,
  },
  tileEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  tileEmptyTxt: { fontSize: 13, fontWeight: '800', color: GOOGLE_HOME.textPrimary },
  tileEmptySub: {
    fontSize: 11,
    fontWeight: '600',
    color: GOOGLE_HOME.textSecondary,
    textAlign: 'center',
  },
  tileEmptyBadge: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tileEmptyBadgeTxt: { fontSize: 10, fontWeight: '700', color: colors.pillText },
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
  deletePlateBtn: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  deletePlateTxt: { fontSize: 13, fontWeight: '700', color: '#E84335' },
  composerRoot: { flex: 1, backgroundColor: colors.paper },
  composerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  composerHeadCenter: { flex: 1, alignItems: 'center', gap: 1 },
  composerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  composerMeta: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  composerBody: { padding: 16, gap: 14 },
  composerLead: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, lineHeight: 25 },
  composerHint: { fontSize: 12, fontWeight: '700', color: colors.pillText, marginTop: -8 },
  composerHintDone: { fontSize: 12, fontWeight: '700', color: colors.success, marginTop: -8 },
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
    borderColor: colors.primary,
    backgroundColor: colors.tintWeak,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mediaAddTxt: { fontSize: 10, fontWeight: '800', color: colors.brandDark, textAlign: 'center', paddingHorizontal: 4 },
  composerSection: { gap: 8 },
  composerLbl: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  composerFooter: {
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.paper,
  },
  composerSave: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  composerSaveDisabled: { backgroundColor: '#E5E5E5', shadowOpacity: 0, elevation: 0 },
  composerSaveTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  composerSaveTxtDisabled: { color: '#999' },
})
