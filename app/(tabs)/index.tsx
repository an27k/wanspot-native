import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/AppHeader'
import { NearbySpotCard } from '@/components/nearby/NearbySpotCard'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { ensureSpotId } from '@/lib/ensureSpot'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetch } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

const GENRES = [
  { key: 'cafe', label: 'カフェ' },
  { key: 'park', label: '公園' },
  { key: 'restaurant', label: 'レストラン' },
  { key: 'veterinary_care', label: '動物病院' },
  { key: 'pet_store', label: 'ペットショップ' },
] as const

const DISTANCES = [
  { key: 500, label: '500m' },
  { key: 1000, label: '1km' },
  { key: 2000, label: '2km' },
  { key: 3000, label: '3km' },
] as const

type SortKey = 'distance' | 'rating' | 'likes'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'distance', label: '距離順' },
  { key: 'rating', label: '評価順' },
  { key: 'likes', label: 'いいね数' },
]

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

export default function NearbyTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [genre, setGenre] = useState<string>('cafe')
  const [distance, setDistance] = useState(1000)
  const [sortKey, setSortKey] = useState<SortKey>('distance')
  const [showSort, setShowSort] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locError, setLocError] = useState('')
  const [spots, setSpots] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocError('位置情報の許可が必要です')
        return
      }
      const pos = await Location.getCurrentPositionAsync({})
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    })()
  }, [])

  const fetchSpots = useCallback(async () => {
    if (!location) return
    setLoading(true)
    try {
      const res = await wanspotFetch(
        `/api/spots/nearby?lat=${location.lat}&lng=${location.lng}&radius=${distance}&type=${genre}`
      )
      const json = (await res.json()) as { spots?: PlaceResult[] }
      const list = json.spots ?? []
      setSpots(list)
      const placeIds = list.map((s) => s.place_id)
      if (placeIds.length === 0) {
        setLikeCounts({})
        setLikedMap({})
        return
      }
      const { data: rows } = await supabase.from('spots').select('id, place_id').in('place_id', placeIds)
      const idByPlace: Record<string, string> = {}
      for (const r of rows ?? []) idByPlace[r.place_id as string] = r.id as string
      const counts: Record<string, number> = {}
      const liked: Record<string, boolean> = {}
      const { data: { user } } = await supabase.auth.getUser()
      await Promise.all(
        placeIds.map(async (pid) => {
          const sid = idByPlace[pid]
          if (!sid) return
          const { count } = await supabase
            .from('spot_likes')
            .select('*', { count: 'exact', head: true })
            .eq('spot_id', sid)
          counts[pid] = count ?? 0
          if (user) {
            const { data: mine } = await supabase
              .from('spot_likes')
              .select('id')
              .eq('spot_id', sid)
              .eq('user_id', user.id)
              .maybeSingle()
            liked[pid] = !!mine
          }
        })
      )
      setLikeCounts(counts)
      setLikedMap(liked)
    } finally {
      setLoading(false)
    }
  }, [location, distance, genre])

  useEffect(() => {
    fetchSpots()
  }, [fetchSpots])

  const sorted = useMemo(() => {
    const loc = location
    return [...spots].sort((a, b) => {
      if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortKey === 'likes') return (likeCounts[b.place_id] ?? 0) - (likeCounts[a.place_id] ?? 0)
      if (!loc) return 0
      return (
        calcDistance(loc.lat, loc.lng, a.lat, a.lng) - calcDistance(loc.lat, loc.lng, b.lat, b.lng)
      )
    })
  }, [spots, sortKey, likeCounts, location])

  const openSpot = async (spot: PlaceResult) => {
    const id = await ensureSpotId(spot)
    if (id) router.push(`/spots/${id}`)
  }

  const toggleLike = async (spot: PlaceResult) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const sid = await ensureSpotId(spot)
    if (!sid) return
    const liked = likedMap[spot.place_id]
    if (liked) {
      await supabase.from('spot_likes').delete().eq('spot_id', sid).eq('user_id', user.id)
      setLikedMap((m) => ({ ...m, [spot.place_id]: false }))
      setLikeCounts((c) => ({ ...c, [spot.place_id]: Math.max(0, (c[spot.place_id] ?? 0) - 1) }))
    } else {
      await supabase.from('spot_likes').insert({ spot_id: sid, user_id: user.id })
      setLikedMap((m) => ({ ...m, [spot.place_id]: true }))
      setLikeCounts((c) => ({ ...c, [spot.place_id]: (c[spot.place_id] ?? 0) + 1 }))
    }
  }

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: padBottom }}
        keyboardShouldPersistTaps="handled"
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {GENRES.map((g) => (
            <Pressable
              key={g.key}
              onPress={() => setGenre(g.key)}
              style={[styles.chip, genre === g.key && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, genre === g.key && styles.chipTxtOn]}>{g.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.row2}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {DISTANCES.map((d) => (
              <Pressable
                key={d.key}
                onPress={() => setDistance(d.key)}
                style={[styles.chipB, distance === d.key && styles.chipBOn]}
              >
                <Text style={[styles.chipBTxt, distance === d.key && styles.chipBTxtOn]}>{d.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.sortBtn} onPress={() => setShowSort((s) => !s)}>
            <Text style={styles.sortBtnTxt}>{SORT_OPTIONS.find((o) => o.key === sortKey)?.label}</Text>
          </Pressable>
        </View>
        {showSort ? (
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map((o) => (
              <Pressable
                key={o.key}
                style={[styles.sortItem, sortKey === o.key && styles.sortItemOn]}
                onPress={() => {
                  setSortKey(o.key)
                  setShowSort(false)
                }}
              >
                <Text style={styles.sortItemTxt}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {locError ? <Text style={styles.err}>{locError}</Text> : null}
        {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.text} /> : null}
        {!loading && location && spots.length === 0 ? (
          <Text style={styles.empty}>近くにスポットが見つかりませんでした</Text>
        ) : null}
        <View style={styles.list}>
          {sorted.map((spot) => (
            <NearbySpotCard
              key={spot.place_id}
              spot={spot}
              likeCount={likeCounts[spot.place_id] ?? 0}
              liked={!!likedMap[spot.place_id]}
              distanceLabel={
                location ? formatDist(calcDistance(location.lat, location.lng, spot.lat, spot.lng)) : null
              }
              photoUri={spotPhotoUrl(spot.photo_ref, 400)}
              onPress={() => openSpot(spot)}
              onToggleLike={() => toggleLike(spot)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  filterRow: {
    flexGrow: 0,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxHeight: 52,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  chipTxtOn: { color: colors.text },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipB: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipBOn: { backgroundColor: colors.text },
  chipBTxt: { fontSize: 11, color: colors.textLight },
  chipBTxtOn: { color: colors.background },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.text,
  },
  sortBtnTxt: { color: colors.background, fontSize: 11, fontWeight: '700' },
  sortMenu: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  sortItem: { paddingVertical: 12, paddingHorizontal: 16 },
  sortItemOn: { backgroundColor: '#FFF9E0' },
  sortItemTxt: { fontWeight: '700', color: colors.text },
  err: { textAlign: 'center', color: colors.textMuted, marginTop: 16 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 24 },
  list: { padding: 16, gap: 12 },
})
