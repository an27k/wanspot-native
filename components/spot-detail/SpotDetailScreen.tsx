import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { AppHeader } from '@/components/AppHeader'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetchJson } from '@/lib/wanspot-api'

const { width: WIN_W } = Dimensions.get('window')

type SpotRow = {
  id: string
  place_id: string
  name: string
  category: string
  address: string | null
  lat: number | null
  lng: number | null
}

type DetailJson = {
  photos?: { photo_reference?: string }[]
  rating?: number
  formatted_address?: string
}

type CheckInReviewRow = { rating: number | null; comment: string | null; created_at: string | null }

export default function SpotDetailScreen({ spotId }: { spotId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [spot, setSpot] = useState<SpotRow | null>(null)
  const [detail, setDetail] = useState<DetailJson | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [summary, setSummary] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<CheckInReviewRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    const { data: row } = await supabase.from('spots').select('*').eq('id', spotId).maybeSingle()
    if (!row) {
      setSpot(null)
      setLoading(false)
      return
    }
    setSpot(row as SpotRow)
    const d = await wanspotFetchJson<DetailJson>(
      `/api/spots/detail?place_id=${encodeURIComponent(row.place_id)}`
    )
    setDetail(d)
    const { count } = await supabase
      .from('spot_likes')
      .select('*', { count: 'exact', head: true })
      .eq('spot_id', spotId)
    setLikeCount(count ?? 0)
    if (user) {
      const { data: mine } = await supabase
        .from('spot_likes')
        .select('id')
        .eq('spot_id', spotId)
        .eq('user_id', user.id)
        .maybeSingle()
      setLiked(!!mine)
    }
    const ai = await wanspotFetchJson<{ summary?: string }>('/api/ai-summary', {
      method: 'POST',
      json: {
        place_id: row.place_id,
        name: row.name,
        category: row.category,
        rating: d?.rating ?? null,
        address: (d?.formatted_address as string) ?? row.address ?? '',
      },
    }).catch(() => ({}) as { summary?: string })
    setSummary(typeof ai.summary === 'string' ? ai.summary : null)
    const { data: rev } = await supabase
      .from('check_ins')
      .select('rating, comment, created_at')
      .eq('spot_id', spotId)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30)
    setReviews((rev ?? []) as CheckInReviewRow[])
    setLoading(false)
  }, [spotId])

  useEffect(() => {
    load()
  }, [load])

  const toggleLike = async () => {
    if (!userId || !spot) {
      Alert.alert('ログインが必要です')
      return
    }
    if (liked) {
      await supabase.from('spot_likes').delete().eq('spot_id', spotId).eq('user_id', userId)
      setLiked(false)
      setLikeCount((c) => Math.max(0, c - 1))
    } else {
      await supabase.from('spot_likes').insert({ spot_id: spotId, user_id: userId })
      setLiked(true)
      setLikeCount((c) => c + 1)
    }
  }

  const checkIn = async () => {
    if (!userId || !spot) {
      Alert.alert('ログインが必要です')
      return
    }
    const { error } = await supabase.from('check_ins').insert({
      spot_id: spotId,
      user_id: userId,
      rating: 0,
      comment: null,
    })
    if (error && !error.message.includes('duplicate')) {
      Alert.alert('エラー', error.message)
      return
    }
    Alert.alert('チェックインしました')
  }

  const refs =
    detail?.photos?.map((p) => p.photo_reference).filter(Boolean) as string[] | undefined
  const uris = (refs ?? []).map((r) => spotPhotoUrl(r, 800)).filter(Boolean) as string[]

  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 24

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="スポット" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.text} />
      </View>
    )
  }

  if (!spot) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="スポット" onBack={() => router.back()} />
        <Text style={styles.empty}>スポットが見つかりません</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppHeader variant="back" title={spot.name} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
        {uris.length > 0 ? (
          <FlatList
            horizontal
            pagingEnabled
            data={uris}
            keyExtractor={(u) => u}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={{ width: WIN_W, height: 220 }} resizeMode="cover" />
            )}
          />
        ) : (
          <View style={[styles.heroPh, { width: WIN_W }]} />
        )}
        <View style={styles.pad}>
          <Text style={styles.cat}>{spot.category}</Text>
          <Text style={styles.name}>{spot.name}</Text>
          <Text style={styles.addr}>
            {detail?.formatted_address ?? spot.address ?? '—'}
          </Text>
          {detail?.rating != null && detail.rating > 0 ? (
            <Text style={styles.rate}>Google ★ {detail.rating.toFixed(1)}</Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable style={styles.actBtn} onPress={toggleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={colors.text} />
              <Text style={styles.actTxt}>いいね {likeCount}</Text>
            </Pressable>
            <Pressable style={styles.actBtn} onPress={checkIn}>
              <Ionicons name="paw" size={22} color={colors.text} />
              <Text style={styles.actTxt}>行った</Text>
            </Pressable>
          </View>
          {summary ? (
            <View style={styles.aiBox}>
              <Text style={styles.aiTitle}>AIまとめ</Text>
              <Text style={styles.aiBody}>{summary}</Text>
            </View>
          ) : null}
          <Text style={styles.revTitle}>レビュー</Text>
          {reviews.length === 0 ? (
            <Text style={styles.revEmpty}>まだレビューがありません</Text>
          ) : (
            reviews.map((r, i) => (
              <View key={i} style={styles.revCard}>
                {r.rating != null && r.rating > 0 ? (
                  <Text style={styles.revRate}>★ {r.rating.toFixed(1)}</Text>
                ) : null}
                <Text style={styles.revBody}>{r.comment}</Text>
                {r.created_at ? (
                  <Text style={styles.revDate}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  heroPh: { height: 220, backgroundColor: colors.border },
  pad: { padding: 16 },
  cat: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  addr: { fontSize: 14, color: colors.textLight, marginTop: 8, lineHeight: 20 },
  rate: { marginTop: 8, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actTxt: { fontWeight: '700', color: colors.text },
  aiBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiTitle: { fontWeight: '800', marginBottom: 8, color: colors.text },
  aiBody: { fontSize: 14, lineHeight: 22, color: colors.textLight },
  revTitle: { fontWeight: '800', fontSize: 16, marginTop: 24, color: colors.text },
  revEmpty: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  revCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  revRate: { fontWeight: '700', color: colors.text, marginBottom: 6 },
  revBody: { fontSize: 14, lineHeight: 22, color: colors.textLight },
  revDate: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
})
