import { useCallback, useMemo, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BrandLoader } from '@/components/common/BrandLoader'
import { colors } from '@/constants/colors'
import {
  CACHE_TTL,
  getCacheEntry,
  isCacheFresh,
  readCache,
  writeCache,
} from '@/lib/client-cache'
import { ALBUM_RETENTION_DAYS, fetchAlbumPhotos, localDateKey, type DogPhoto } from '@/lib/dog-photos'
import { AlbumPhotoViewer } from './AlbumPhotoViewer'

const COLS = 4
const GAP = 4
const H_PADDING = 16

const PAST_TILE_PATTERN: { w: number; h: number }[] = [
  { w: 2, h: 2 },
  { w: 1, h: 1 },
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 1, h: 1 },
  { w: 1, h: 2 },
]

function pastTileSpec(index: number, totalPast: number): { w: number; h: number } {
  if (totalPast <= 2) return { w: 2, h: 2 }
  if (totalPast <= 4) return index % 2 === 0 ? { w: 2, h: 1 } : { w: 1, h: 1 }
  return PAST_TILE_PATTERN[index % PAST_TILE_PATTERN.length]
}

/** YYYY-MM-DD → M/D（オレンジ日付ラベル用） */
function shortDateOrange(takenOn: string): string {
  const [, m, d] = takenOn.split('-')
  if (!m || !d) return takenOn
  return `${Number(m)}/${Number(d)}`
}

type MosaicItem =
  | { key: string; kind: 'today'; photo: DogPhoto | null; w: number; h: number }
  | { key: string; kind: 'past'; photo: DogPhoto; w: number; h: number }

function buildMosaicItems(todayPhoto: DogPhoto | null, pastPhotos: DogPhoto[]): MosaicItem[] {
  const items: MosaicItem[] = [{ key: 'today', kind: 'today', photo: todayPhoto, w: 2, h: 2 }]
  pastPhotos.forEach((photo, i) => {
    const spec = pastTileSpec(i, pastPhotos.length)
    items.push({ key: photo.id, kind: 'past', photo, ...spec })
  })
  return items
}

type Placement = MosaicItem & { row: number; col: number }

function packMosaic(items: MosaicItem[], cols: number): { placements: Placement[]; rowCount: number } {
  const occupied: boolean[][] = []
  const placements: Placement[] = []

  const ensureRow = (r: number) => {
    while (occupied.length <= r) occupied.push(Array(cols).fill(false))
  }

  const canPlace = (row: number, col: number, w: number, h: number) => {
    if (col + w > cols) return false
    for (let dr = 0; dr < h; dr++) {
      ensureRow(row + dr)
      for (let dc = 0; dc < w; dc++) {
        if (occupied[row + dr][col + dc]) return false
      }
    }
    return true
  }

  const mark = (row: number, col: number, w: number, h: number) => {
    for (let dr = 0; dr < h; dr++) {
      ensureRow(row + dr)
      for (let dc = 0; dc < w; dc++) occupied[row + dr][col + dc] = true
    }
  }

  for (const item of items) {
    let placed = false
    for (let r = 0; !placed; r++) {
      for (let c = 0; c <= cols - item.w; c++) {
        if (canPlace(r, c, item.w, item.h)) {
          mark(r, c, item.w, item.h)
          placements.push({ ...item, row: r, col: c })
          placed = true
          break
        }
      }
    }
  }

  const rowCount = occupied.length
  return { placements, rowCount }
}

type Props = {
  userId: string | null
  todayPhoto: DogPhoto | null
  onCaptureToday: () => void
  saving?: boolean
}

export function AlbumMosaic({ userId, todayPhoto, onCaptureToday, saving }: Props) {
  const [photos, setPhotos] = useState<DogPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<DogPhoto | null>(null)

  const contentWidth = Dimensions.get('window').width - H_PADDING * 2
  const unit = (contentWidth - GAP * (COLS - 1)) / COLS

  const load = useCallback(
    async (force = false) => {
      if (!userId) {
        setPhotos([])
        setLoading(false)
        return
      }

      const cacheKey = `dog:album:${userId}`
      if (!force && isCacheFresh(cacheKey, CACHE_TTL.ALBUM_MS)) {
        const cached = readCache<DogPhoto[]>(cacheKey)
        if (cached) {
          setPhotos(cached)
          setLoading(false)
          return
        }
      }

      const stale = readCache<DogPhoto[]>(cacheKey)
      if (stale) setPhotos(stale)
      else if (force || !getCacheEntry(cacheKey)) setLoading(true)

      const next = await fetchAlbumPhotos(userId)
      writeCache(cacheKey, next)
      setPhotos(next)
      setLoading(false)
    },
    [userId]
  )

  useFocusEffect(
    useCallback(() => {
      void load(false)
    }, [load])
  )

  const todayKey = localDateKey()
  const pastPhotos = useMemo(
    () => photos.filter((p) => p.taken_on !== todayKey),
    [photos, todayKey]
  )

  const items = useMemo(() => buildMosaicItems(todayPhoto, pastPhotos), [todayPhoto, pastPhotos])
  const { placements, rowCount } = useMemo(() => packMosaic(items, COLS), [items])
  const mosaicHeight = rowCount * unit + Math.max(0, rowCount - 1) * GAP

  // 親の todayPhoto 更新時にアルバムも同期
  useFocusEffect(
    useCallback(() => {
      if (todayPhoto && userId) {
        const cacheKey = `dog:album:${userId}`
        const cached = readCache<DogPhoto[]>(cacheKey)
        if (cached && !cached.some((p) => p.id === todayPhoto.id)) {
          void load(true)
        }
      }
    }, [todayPhoto, userId, load])
  )

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>これまでの1枚</Text>
        <Text style={styles.retention}>保存{ALBUM_RETENTION_DAYS}日間</Text>
      </View>

      {loading && photos.length === 0 && !todayPhoto ? (
        <View style={styles.loaderWrap}>
          <BrandLoader size={72} />
        </View>
      ) : (
        <View style={[styles.mosaic, { height: mosaicHeight }]}>
          {placements.map((p) => {
            const left = p.col * (unit + GAP)
            const top = p.row * (unit + GAP)
            const width = p.w * unit + (p.w - 1) * GAP
            const height = p.h * unit + (p.h - 1) * GAP

            if (p.kind === 'today') {
              if (p.photo) {
                return (
                  <Pressable
                    key={p.key}
                    style={[styles.tile, { left, top, width, height }]}
                    onPress={() => setViewer(p.photo)}
                  >
                    <Image source={{ uri: p.photo.image_url }} style={styles.tileImg} contentFit="cover" transition={120} />
                    <View style={styles.dateLbl}>
                      <Text style={styles.dateTxt}>{shortDateOrange(p.photo.taken_on)}</Text>
                    </View>
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeTxt}>今日</Text>
                    </View>
                  </Pressable>
                )
              }
              return (
                <Pressable
                  key={p.key}
                  style={[styles.tile, styles.todayCta, { left, top, width, height }, saving && { opacity: 0.6 }]}
                  onPress={onCaptureToday}
                  disabled={saving}
                >
                  <Ionicons name="camera" size={28} color="#2b2a28" />
                  <Text style={styles.todayCtaTxt}>今日の1枚を撮る</Text>
                </Pressable>
              )
            }

            return (
              <Pressable
                key={p.key}
                style={[styles.tile, { left, top, width, height }]}
                onPress={() => setViewer(p.photo)}
              >
                <Image source={{ uri: p.photo.image_url }} style={styles.tileImg} contentFit="cover" transition={120} />
                <View style={styles.dateLbl}>
                  <Text style={styles.dateTxt}>{shortDateOrange(p.photo.taken_on)}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}

      {!loading && pastPhotos.length === 0 && !todayPhoto ? (
        <Text style={styles.emptyHint}>まだ写真がありません。左上のタイルから今日の1枚を残しましょう。</Text>
      ) : null}

      <AlbumPhotoViewer photo={viewer} onClose={() => setViewer(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: H_PADDING, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  retention: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  loaderWrap: { alignItems: 'center', paddingVertical: 40 },
  mosaic: { position: 'relative', width: '100%' },
  tile: {
    position: 'absolute',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.cardBg,
  },
  tileImg: { width: '100%', height: '100%' },
  todayCta: {
    backgroundColor: '#FF8A1F',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  todayCtaTxt: { fontSize: 13, fontWeight: '800', color: '#2b2a28', textAlign: 'center' },
  dateLbl: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dateTxt: { fontSize: 11, fontWeight: '800', color: '#FF8A1F' },
  todayBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#FF8A1F',
  },
  todayBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#2b2a28' },
  emptyHint: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
})
