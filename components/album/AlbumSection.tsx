import { useCallback, useState } from 'react'
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import {
  CACHE_TTL,
  getCacheEntry,
  isCacheFresh,
  readCache,
  writeCache,
} from '@/lib/client-cache'
import { ALBUM_RETENTION_DAYS, fetchAlbumPhotos, type DogPhoto } from '@/lib/dog-photos'
import { REVIEW_ALBUM_TAB_ENABLED } from '@/lib/feature-flags'
import { supabase } from '@/lib/supabase'

const COLS = 3
const CARD_PADDING = 16
const GRID_GAP = 8

function tileSize(screenWidth: number): number {
  const inner = screenWidth - CARD_PADDING * 2
  return Math.floor((inner - GRID_GAP * (COLS - 1)) / COLS)
}

/** YYYY-MM-DD → M/D 表記 */
function shortDate(takenOn: string): string {
  const [, m, d] = takenOn.split('-')
  if (!m || !d) return takenOn
  return `${Number(m)}/${Number(d)}`
}

/** マイページ内のアルバム（カメラで撮った「今日の1枚」が溜まる） */
export function AlbumSection() {
  const router = useRouter()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const [photos, setPhotos] = useState<DogPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<DogPhoto | null>(null)
  const screenW = Dimensions.get('window').width
  const size = tileSize(screenW - 32)

  const load = useCallback(async (force = false) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setPhotos([])
      setLoading(false)
      return
    }

    const cacheKey = `dog:album:${user.id}`
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

    const next = await fetchAlbumPhotos(user.id)
    writeCache(cacheKey, next)
    setPhotos(next)
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load(false)
    }, [load])
  )

  if (!REVIEW_ALBUM_TAB_ENABLED) return null

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>アルバム</Text>
        <Text style={styles.retention}>保存{ALBUM_RETENTION_DAYS}日間</Text>
      </View>

      {!loading && photos.length === 0 ? (
        <Pressable style={styles.empty} onPress={() => router.push('/(tabs)/camera')}>
          <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyTxt}>アルバムタブで「今日の1枚」を残そう</Text>
        </Pressable>
      ) : (
        <View style={styles.grid}>
          {photos.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.tile, { width: size, height: size }]}
              onPress={() => setViewer(p)}
            >
              <Image source={{ uri: p.image_url }} style={styles.tileImg} contentFit="cover" transition={120} />
              <View style={styles.tileDate}>
                <Text style={styles.tileDateTxt}>{shortDate(p.taken_on)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Modal visible={viewer != null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewerRoot} onPress={() => setViewer(null)}>
          {viewer ? (
            <Image source={{ uri: viewer.image_url }} style={styles.viewerImg} contentFit="contain" />
          ) : null}
          <Pressable style={styles.viewerClose} onPress={() => setViewer(null)}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: CARD_PADDING,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'stretch',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { ...type.heading, color: colors.text },
  retention: { ...type.caption, color: colors.textMuted },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyTxt: { ...type.caption, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.cardBg },
  tileImg: { width: '100%', height: '100%' },
  tileDate: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // 写真タイルの日付。見るだけの情報なのでマイクロラベルのまま上げない
  tileDateTxt: { ...type.label, color: '#fff' },
  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerImg: { width: '100%', height: '80%' },
  viewerClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
