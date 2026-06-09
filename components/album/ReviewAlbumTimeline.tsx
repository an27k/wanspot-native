import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { BrandLoader } from '@/components/common/BrandLoader'
import { VlogProgressCard } from '@/components/album/VlogProgressCard'
import { RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { computeVlogProgress, countReviewedSpots } from '@/lib/album/vlog-progress'
import { pickMemoryMedia } from '@/lib/image-picker'
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

type UploadState = {
  visitId: string
  progress: number
  label: string
}

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
      <View style={styles.detailRoot}>
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
                  <Image source={{ uri: m.signedUrl }} style={styles.detailThumb} contentFit="cover" />
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
        <Ionicons name="images-outline" size={28} color={colors.brandDark} />
        <Text style={styles.tileEmptyTxt}>思い出を追加</Text>
        <Text style={styles.tileEmptySub} numberOfLines={1}>
          {plate.spot.name}
        </Text>
      </Pressable>
    )
  }

  return (
    <Pressable style={styles.tile} onPress={onOpen}>
      {cover?.signedUrl ? (
        <Image source={{ uri: cover.signedUrl }} style={styles.tileImg} contentFit="cover" />
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
  const [upload, setUpload] = useState<UploadState | null>(null)
  const [visitPickerOpen, setVisitPickerOpen] = useState(false)
  const [detailPlate, setDetailPlate] = useState<VisitPlate | null>(null)

  const runUpload = useCallback(
    async (visitId: string, spotId: string) => {
      if (!userId) return
      const picked = await pickMemoryMedia()
      if (!picked) return

      setUpload({ visitId, progress: 0, label: 'アップロード中...' })
      const uploaded = await uploadMemoryFile(userId, picked.uri, picked.mimeType, (p) =>
        setUpload({ visitId, progress: p, label: 'アップロード中...' })
      )
      if (!uploaded) {
        setUpload(null)
        Alert.alert('アップロードに失敗しました', '時間をおいて再度お試しください。')
        return
      }
      const { row, error } = await insertMemory({
        userId,
        visitId,
        spotId,
        storagePath: uploaded.path,
        mediaType: uploaded.mediaType,
      })
      setUpload(null)
      if (!row) {
        const detail = error ? formatVisitRecordError(error) : 'unknown error'
        console.warn('[runUpload]', detail)
        Alert.alert('保存に失敗しました', detail)
        return
      }
      onReload()
    },
    [userId, onReload]
  )

  const vlogStats = useMemo(() => {
    return computeVlogProgress(countReviewedSpots(plates))
  }, [plates])

  const displayDogName = dogName?.trim() || '愛犬'

  const openAddFlow = () => {
    if (!userId) {
      Alert.alert('ログインが必要です', '思い出を追加するにはログインしてください。')
      return
    }
    if (plates.length === 0) {
      Alert.alert('', '先にスポット詳細で「行った」を記録してください。')
      return
    }
    setVisitPickerOpen(true)
  }

  const onMainCta = () => {
    if (plates.length === 0) {
      router.push('/(tabs)/search')
      return
    }
    openAddFlow()
  }

  if (!userId) {
    return (
      <View style={styles.guest}>
        <Text style={styles.guestTxt}>ログインすると、自分だけのアルバムが使えます。</Text>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.intro}>
        <Text style={styles.introTitle}>
          おでかけをレビューして、{displayDogName}のVLOGを自動で作ろう🐶
        </Text>
        <Text style={styles.introSub}>
          レビューやコメント、写真・動画が多いほど、VLOGの内容も豊かになるよ
        </Text>
        <Text style={styles.introClosing}>誰にも公開されない、あなただけの思い出。</Text>
      </View>

      <VlogProgressCard
        dogName={dogName}
        count={vlogStats.current}
        max={vlogStats.target}
        onHelpPress={onOpenTutorial}
      />

      {upload ? (
        <View style={styles.uploadBar}>
          <BrandLoader size={32} />
          <Text style={styles.uploadTxt}>
            {upload.label} {Math.round(upload.progress * 100)}%
          </Text>
        </View>
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
              onAddMedia={() => void runUpload(plate.id, plate.spot_id)}
            />
          ))}
        </View>
      ) : null}

      <Pressable style={styles.addBtn} onPress={onMainCta}>
        <Text style={styles.addBtnTxt}>{plates.length === 0 ? 'スポットを探す' : '思い出を追加'}</Text>
      </Pressable>

      <Modal visible={visitPickerOpen} animationType="slide" onRequestClose={() => setVisitPickerOpen(false)}>
        <View style={styles.pickerRoot}>
          <View style={styles.pickerHead}>
            <Text style={styles.pickerTitle}>既存の訪問に追加</Text>
            <Pressable onPress={() => setVisitPickerOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {plates.map((p) => (
              <Pressable
                key={p.id}
                style={styles.spotRow}
                onPress={() => {
                  setVisitPickerOpen(false)
                  void runUpload(p.id, p.spot_id)
                }}
              >
                <Text style={styles.spotRowName}>{p.spot.name}</Text>
                <Text style={styles.spotRowCat}>
                  {formatVisitDate(p.visited_at)} · {p.spot.category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.pickerCancel} onPress={() => setVisitPickerOpen(false)}>
            <Text style={styles.pickerCancelTxt}>キャンセル</Text>
          </Pressable>
        </View>
      </Modal>

      {detailPlate ? (
        <PlateDetailModal
          plate={detailPlate}
          visible={detailPlate != null}
          onClose={() => setDetailPlate(null)}
          onReload={onReload}
          onAddMedia={() => void runUpload(detailPlate.id, detailPlate.spot_id)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GRID_PAD, gap: 14, marginTop: 4, paddingBottom: 8 },
  intro: { gap: 8, paddingHorizontal: 2, marginBottom: 2 },
  introTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 26,
  },
  introSub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  introClosing: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  addBtn: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 16,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  addBtnTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  uploadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadTxt: { fontSize: 13, fontWeight: '600', color: colors.text },
  loaderWrap: { paddingVertical: 40, alignItems: 'center' },
  guest: { padding: 24, alignItems: 'center' },
  guestTxt: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  tileEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.tintWeak,
  },
  tileEmptyTxt: { fontSize: 13, fontWeight: '800', color: colors.brandDark },
  tileEmptySub: { fontSize: 11, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 8 },
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
  pickerRoot: { flex: 1, backgroundColor: colors.paper },
  pickerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  pickerCancel: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  pickerCancelTxt: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  spotRow: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spotRowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  spotRowCat: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
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
})
