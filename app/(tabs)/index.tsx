import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg'
import { AppHeader } from '@/components/AppHeader'
import { IconPaw } from '@/components/IconPaw'
import { RunningDog, PowState } from '@/components/DogStates'
import { HEART_ICON } from '@/lib/constants'
import { fetchUserWalkAreaTags } from '@/lib/fetch-user-walk-area-tags'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
import { supabase } from '@/lib/supabase'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { POST_ONBOARDING_TUTORIAL_KEY } from '@/lib/onboarding-constants'
import { spotPhotoUrl, wanspotFetch } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

const ICON_FILTER_FUNNEL = require('@/assets/icon-filter-funnel.png')

const GENRES = [
  { key: 'cafe', label: 'カフェ' },
  { key: 'park', label: '公園' },
  { key: 'restaurant', label: 'レストラン' },
  { key: 'veterinary_care', label: '動物病院' },
  { key: 'pet_hotel', label: 'ペットホテル' },
  { key: 'pet_store', label: 'ペットショップ' },
  { key: 'grooming', label: 'トリミング' },
] as const

const DISTANCES = [
  { key: 1000, label: '1km' },
  { key: 3000, label: '3km' },
  { key: 5000, label: '5km' },
] as const

type DistanceKey = (typeof DISTANCES)[number]['key']

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

const IconHeart = ({ filled }: { filled: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill={filled ? HEART_ICON.filled : 'none'}
      stroke={filled ? HEART_ICON.filled : HEART_ICON.strokeEmpty}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

const IconStar = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="#FFD84D" stroke="#FFD84D" strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

const IconMoney = ({ filled }: { filled: boolean }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill={filled ? '#FFD84D' : '#e8e8e8'}>
    <Circle cx="12" cy="12" r="10" />
    <SvgText x="12" y="16" textAnchor="middle" fontSize="12" fill={filled ? '#1a1a1a' : '#bbb'} fontWeight="bold">
      ¥
    </SvgText>
  </Svg>
)

const PriceLevel = ({ level }: { level: number | null }) => {
  if (level === null || level === undefined) return <Text style={styles.qMark}>?</Text>
  return (
    <View style={styles.priceRow}>
      {[1, 2, 3, 4].map((i) => (
        <IconMoney key={i} filled={i <= level} />
      ))}
    </View>
  )
}

const IconSort = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M3 6h18M3 12h12M3 18h6" />
  </Svg>
)

const IconGoogle = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
)

export default function NearbyPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [genre, setGenre] = useState('cafe')
  const [distance, setDistance] = useState<DistanceKey>(1000)
  const [spots, setSpots] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('distance')
  const [showSort, setShowSort] = useState(false)
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [spotsFetchError, setSpotsFetchError] = useState('')
  const [likedOnlyFilter, setLikedOnlyFilter] = useState(false)
  const [likedPlaceIds, setLikedPlaceIds] = useState<Set<string>>(() => new Set())
  const [showObTutorial, setShowObTutorial] = useState(false)
  const [userWalkTags, setUserWalkTags] = useState<string[]>([])

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const v = await AsyncStorage.getItem(POST_ONBOARDING_TUTORIAL_KEY)
          if (v === '1') setShowObTutorial(true)
        } catch {
          /* ignore */
        }
        const tags = await fetchUserWalkAreaTags(supabase)
        setUserWalkTags(tags)
      })()
    }, [])
  )

  const dismissObTutorial = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(POST_ONBOARDING_TUTORIAL_KEY)
    } catch {
      /* ignore */
    }
    setShowObTutorial(false)
  }, [])

  useEffect(() => {
    const valid = new Set(DISTANCES.map((d) => d.key))
    if (!valid.has(distance)) setDistance(DISTANCES[0].key)
  }, [distance])

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem('ob_area')
        const prefWide = await AsyncStorage.getItem('pref_nearby_wide')
        let wide = prefWide === '1'
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { useLocationBased?: boolean }
            if (parsed?.useLocationBased) wide = true
          } catch {
            /* ignore */
          }
        }
        if (wide) setDistance(3000)
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError('位置情報を取得できませんでした')
        return
      }
      const pos = await Location.getCurrentPositionAsync({})
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    })()
  }, [])

  useEffect(() => {
    if (!location) return
    setLoading(true)
    setSpotsFetchError('')
    const q = `/api/spots/nearby?lat=${location.lat}&lng=${location.lng}&radius=${distance}&type=${genre}`
    void wanspotFetch(q)
      .then(async (r) => {
        let data: { spots?: PlaceResult[]; error?: string } = {}
        try {
          data = (await r.json()) as { spots?: PlaceResult[]; error?: string }
        } catch {
          setSpots([])
          setSpotsFetchError('スポット情報の解析に失敗しました')
          return
        }
        if (!r.ok) {
          setSpots([])
          setSpotsFetchError(typeof data.error === 'string' ? data.error : `スポットの取得に失敗しました (${r.status})`)
          return
        }
        setSpots(data.spots ?? [])
      })
      .catch(() => {
        setSpots([])
        setSpotsFetchError('ネットワークエラーです。API の URL（EXPO_PUBLIC_WANSPOT_API_URL / https://www.wanspot.app）を確認してください')
      })
      .finally(() => setLoading(false))
  }, [location, genre, distance])

  useEffect(() => {
    if (spots.length === 0) return
    const fetchLikes = async () => {
      const placeIds = spots.map((s) => s.place_id)
      const { data } = await supabase.from('spots').select('id, place_id').in('place_id', placeIds)
      if (!data) return
      const counts: Record<string, number> = {}
      await Promise.all(
        data.map(async (row) => {
          const { count } = await supabase
            .from('spot_likes')
            .select('*', { count: 'exact', head: true })
            .eq('spot_id', row.id)
          counts[row.place_id] = count ?? 0
        })
      )
      setLikeCounts(counts)
    }
    void fetchLikes()
  }, [spots])

  const reloadUserLikedPlaceIds = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLikedPlaceIds(new Set())
      return
    }
    const { data: likes } = await supabase.from('spot_likes').select('spot_id').eq('user_id', user.id)
    if (!likes?.length) {
      setLikedPlaceIds(new Set())
      return
    }
    const spotIds = [...new Set(likes.map((l) => l.spot_id).filter(Boolean))]
    const { data: rows } = await supabase.from('spots').select('place_id').in('id', spotIds)
    setLikedPlaceIds(new Set((rows ?? []).map((r) => r.place_id).filter(Boolean)))
  }, [])

  useFocusEffect(
    useCallback(() => {
      void reloadUserLikedPlaceIds()
    }, [reloadUserLikedPlaceIds])
  )

  const handleSpotLikeChange = useCallback((placeId: string, liked: boolean) => {
    setLikedPlaceIds((prev) => {
      const next = new Set(prev)
      if (liked) next.add(placeId)
      else next.delete(placeId)
      return next
    })
  }, [])

  const sortedSpots = useMemo(() => {
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

  const displayedSpots = useMemo(() => {
    if (!likedOnlyFilter) return sortedSpots
    return sortedSpots.filter((s) => likedPlaceIds.has(s.place_id))
  }, [sortedSpots, likedOnlyFilter, likedPlaceIds])

  const currentSort = SORT_OPTIONS.find((o) => o.key === sortKey)!

  return (
    <View style={styles.main}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreBar}>
          {GENRES.map((g) => (
            <TouchableOpacity
              key={g.key}
              onPress={() => setGenre(g.key)}
              style={[styles.genreChip, genre === g.key ? styles.genreChipOn : styles.genreChipOff]}
            >
              <Text style={[styles.genreTxt, genre === g.key ? styles.genreTxtOn : styles.genreTxtOff]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.distRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.distScroll}
            contentContainerStyle={styles.distScrollContent}
          >
            {DISTANCES.map((d) => (
              <TouchableOpacity
                key={d.key}
                onPress={() => setDistance(d.key)}
                style={[styles.distChip, distance === d.key ? styles.distChipOn : styles.distChipOff]}
              >
                <Text style={[styles.distTxt, distance === d.key ? styles.distTxtOn : styles.distTxtOff]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.distRowSpacer} />
          <View style={styles.distRowActions}>
            <TouchableOpacity
              style={[styles.likeFilterBtn, likedOnlyFilter ? styles.likeFilterBtnOn : styles.likeFilterBtnOff]}
              onPress={() => setLikedOnlyFilter((v) => !v)}
              accessibilityLabel={likedOnlyFilter ? 'いいねしたお店のみ表示中。タップで全件表示' : 'いいねしたお店のみ表示'}
              accessibilityRole="button"
            >
              <Image
                source={ICON_FILTER_FUNNEL}
                style={[styles.likeFilterIcon, likedOnlyFilter && styles.likeFilterIconOn]}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <Text style={[styles.likeFilterTxt, likedOnlyFilter && styles.likeFilterTxtOn]}>いいね</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSort(true)}>
              <IconSort />
              <Text style={styles.sortBtnTxt}>{currentSort.label}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.list}>
          {error ? <Text style={styles.err}>{error}</Text> : null}
          {spotsFetchError ? <Text style={styles.err}>{spotsFetchError}</Text> : null}
          {loading ? <RunningDog label="近くのスポットを探し中..." /> : null}
          {!loading && !error && !spotsFetchError && spots.length === 0 && location ? (
            <PowState label="近くにスポットが見つかりませんでした" />
          ) : null}
          {!loading &&
          !error &&
          !spotsFetchError &&
          spots.length > 0 &&
          likedOnlyFilter &&
          displayedSpots.length === 0 ? (
            <PowState label="この条件ではいいねしたお店がありません" />
          ) : null}
          {displayedSpots.map((spot) => (
            <SpotCard
              key={spot.place_id}
              spot={spot}
              likeCount={likeCounts[spot.place_id] ?? 0}
              userLocation={location}
              userWalkTags={userWalkTags}
              onOpenDetail={(id) => router.push(`/spots/${id}`)}
              onLikeStateChange={handleSpotLikeChange}
            />
          ))}
        </View>
      </ScrollView>

      <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
        <Pressable style={styles.sortOverlay} onPress={() => setShowSort(false)}>
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortItem, sortKey === opt.key && styles.sortItemOn]}
                onPress={() => {
                  setSortKey(opt.key)
                  setShowSort(false)
                }}
              >
                <Text style={[styles.sortItemTxt, sortKey === opt.key && styles.sortItemTxtOn]}>
                  {opt.label}
                  {sortKey === opt.key ? ' ✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showObTutorial} transparent animationType="fade" onRequestClose={() => void dismissObTutorial()}>
        <Pressable style={styles.obTutOverlay} onPress={() => void dismissObTutorial()}>
          <Pressable style={styles.obTutCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.obTutTitle}>さあ、一緒に探そう！</Text>
            <Text style={styles.obTutBody}>
              ワンちゃんと行きたいカフェや公園を見つけたら、
              <Text style={styles.obTutEm}>ハートでいいね</Text>
              してみてください。いいねが増えるほど「好き」の傾向が伝わり、
              <Text style={styles.obTutEm}>専属AIのおすすめやまとめの精度が上がります。</Text>
              {'\n\n'}
              まずは気軽に<Text style={styles.obTutEm}>5件以上</Text>
              いいねして、ワクワクするスポット探しのスタートを切りましょう。お気に入りはマイページの「いいね一覧」からいつでも見られます。
            </Text>
            <TouchableOpacity style={styles.obTutBtn} onPress={() => void dismissObTutorial()}>
              <Text style={styles.obTutBtnTxt}>OK</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function SpotCard({
  spot,
  likeCount,
  userLocation,
  userWalkTags,
  onOpenDetail,
  onLikeStateChange,
}: {
  spot: PlaceResult
  likeCount: number
  userLocation: { lat: number; lng: number } | null
  userWalkTags: string[]
  onOpenDetail: (id: string) => void
  onLikeStateChange?: (placeId: string, liked: boolean) => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const [spotId, setSpotId] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [localLikeCount, setLocalLikeCount] = useState(likeCount)
  const [likeLoading, setLikeLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<{ keywords: string[]; summary: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const uri = spotPhotoUrl(spot.photo_ref, 288)

  useEffect(() => {
    setLocalLikeCount(likeCount)
  }, [likeCount])

  useEffect(() => {
    const fetchLikeData = async () => {
      const { data: spotRow } = await supabase.from('spots').select('id').eq('place_id', spot.place_id).single()
      if (!spotRow) return
      setSpotId(spotRow.id)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: myLike } = await supabase
          .from('spot_likes')
          .select('id')
          .eq('spot_id', spotRow.id)
          .eq('user_id', user.id)
          .maybeSingle()
        setLiked(!!myLike)
      }
    }
    void fetchLikeData()
  }, [spot.place_id])

  const handleOpenDetail = async () => {
    if (spotId) {
      onOpenDetail(spotId)
      return
    }
    const { data: spotRow, error } = await supabase
      .from('spots')
      .upsert(
        {
          place_id: spot.place_id,
          name: spot.name,
          category: spot.category,
          address: spot.address,
          lat: spot.lat,
          lng: spot.lng,
          rating: spot.rating,
          price_level: spot.price_level,
        },
        { onConflict: 'place_id' }
      )
      .select('id')
      .single()
    if (!error && spotRow) {
      setSpotId(spotRow.id)
      onOpenDetail(spotRow.id)
    }
  }

  const handleLike = async () => {
    if (likeLoading) return
    playLikeHeartAnimation(scaleAnim)
    setLikeLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLikeLoading(false)
      return
    }

    if (!liked) {
      const { data: spotRow, error: spotErr } = await supabase
        .from('spots')
        .upsert(
          {
            place_id: spot.place_id,
            name: spot.name,
            category: spot.category,
            address: spot.address,
            lat: spot.lat,
            lng: spot.lng,
            rating: spot.rating,
            price_level: spot.price_level,
          },
          { onConflict: 'place_id' }
        )
        .select('id')
        .single()
      if (spotErr || !spotRow) {
        setLikeLoading(false)
        return
      }
      await supabase.from('spot_likes').insert({ user_id: user.id, spot_id: spotRow.id })
      setLiked(true)
      setLocalLikeCount((c) => c + 1)
      onLikeStateChange?.(spot.place_id, true)
    } else {
      const { data: spotRow } = await supabase.from('spots').select('id').eq('place_id', spot.place_id).single()
      if (spotRow)
        await supabase.from('spot_likes').delete().eq('user_id', user.id).eq('spot_id', spotRow.id)
      setLiked(false)
      setLocalLikeCount((c) => Math.max(0, c - 1))
      onLikeStateChange?.(spot.place_id, false)
    }
    setLikeLoading(false)
  }

  const handleAiSummary = async () => {
    if (aiSummary || aiLoading) return
    setAiLoading(true)
    const res = await wanspotFetch('/api/ai-summary', {
      method: 'POST',
      json: {
        place_id: spot.place_id,
        name: spot.name,
        category: spot.category,
        rating: spot.rating,
        address: spot.address,
        reviews: [],
        userContext: {
          walkAreaTags: userWalkTags,
          lat: userLocation?.lat ?? null,
          lng: userLocation?.lng ?? null,
        },
      },
    })
    const data = (await res.json()) as { keywords?: string[]; summary?: string }
    setAiSummary(
      data.keywords && data.summary ? { keywords: data.keywords, summary: data.summary } : {
        keywords: [],
        summary: typeof data.summary === 'string' ? data.summary : '',
      }
    )
    setAiLoading(false)
  }

  const distLabel =
    userLocation &&
    (() => {
      const d = calcDistance(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
      return d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`
    })()

  return (
    <TouchableOpacity style={styles.card} onPress={handleOpenDetail} activeOpacity={0.95}>
      <View style={styles.cardPhoto}>
        {uri ? <Image source={{ uri }} style={styles.cardImg} resizeMode="cover" /> : null}
        <View style={styles.heartCol}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              onPress={() => void handleLike()}
              disabled={likeLoading}
              style={styles.heartCircle}
            >
              <IconHeart filled={liked} />
            </TouchableOpacity>
          </Animated.View>
          {localLikeCount > 0 ? (
            <Text style={styles.likeCnt}>{localLikeCount}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.spotCat}>{spot.category}</Text>
          <View style={styles.cardMeta}>
            {spot.rating ? (
              <View style={styles.rateRow}>
                <IconGoogle />
                <IconStar />
                <Text style={styles.rateSmall}>{spot.rating}</Text>
                <PriceLevel level={spot.price_level} />
              </View>
            ) : null}
            {distLabel ? <Text style={styles.distSmall}>{distLabel}</Text> : null}
          </View>
        </View>
        <Text style={styles.spotName}>{spot.name}</Text>
        <Text style={styles.spotAddr}>{spot.address}</Text>
        {!aiSummary && !aiLoading ? (
          <TouchableOpacity style={styles.aiBtn} onPress={() => void handleAiSummary()}>
            <IconPaw size={11} color="#aaa" />
            <Text style={styles.aiBtnTxt}> AIまとめを見る</Text>
          </TouchableOpacity>
        ) : null}
        {aiLoading ? <RunningDog label="AIまとめを生成中..." /> : null}
        {aiSummary && !aiLoading ? (
          <View style={styles.aiBox}>
            <View style={styles.kwRow}>
              {aiSummary.keywords.map((kw) => (
                <Text key={kw} style={styles.kw}>
                  {kw}
                </Text>
              ))}
            </View>
            <Text style={styles.aiSum}>{aiSummary.summary}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f7f6f3' },
  scroll: { flex: 1 },
  scrollContent: {},
  genreBar: {
    maxHeight: 64,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  /** 検索の discover タブ（discTab）と同形状のカードボタン。選択のみ黄色 */
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  genreChipOn: { backgroundColor: '#FFD84D' },
  genreChipOff: { backgroundColor: '#f5f5f5' },
  genreTxt: { fontSize: 12, fontWeight: '800' },
  genreTxtOn: { color: '#1a1a1a' },
  genreTxtOff: { color: '#888' },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  /** 距離チップは内容幅で左詰め（flex:1 しない） */
  distScroll: { flexGrow: 0, flexShrink: 1, maxHeight: 40 },
  distScrollContent: { flexDirection: 'row', alignItems: 'center', flexGrow: 0 },
  distRowSpacer: { flex: 1, minWidth: 8 },
  distRowActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  likeFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
  },
  likeFilterIcon: { width: 12, height: 12, tintColor: '#888' },
  likeFilterIconOn: { tintColor: '#fff' },
  likeFilterBtnOff: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e8e8e8',
  },
  likeFilterBtnOn: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  likeFilterTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
  likeFilterTxtOn: { color: '#fff' },
  distChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  distChipOn: { backgroundColor: '#1a1a1a' },
  distChipOff: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8' },
  distTxt: { fontSize: 12 },
  distTxtOn: { color: '#fff' },
  distTxtOff: { color: '#888' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
  },
  sortBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  err: { textAlign: 'center', paddingVertical: 32, color: '#aaa', fontSize: 14 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  cardPhoto: { height: 144, backgroundColor: '#e8e4de', position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  heartCol: { position: 'absolute', top: 8, right: 8, alignItems: 'center', gap: 4 },
  heartCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCnt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C9A227',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardBody: { padding: 12, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spotCat: {
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#FFF9E0',
    color: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateSmall: { fontSize: 12, color: '#888' },
  distSmall: { fontSize: 12, color: '#aaa' },
  spotName: { fontWeight: '700', fontSize: 14, color: '#1a1a1a' },
  spotAddr: { fontSize: 12, color: '#aaa' },
  aiBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  aiBtnTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
  aiBox: { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: '#FFFBEC' },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kw: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFD84D',
    color: '#1a1a1a',
  },
  aiSum: { fontSize: 12, lineHeight: 18, color: '#555' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  qMark: { fontSize: 12, color: '#ccc' },
  sortOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 180, paddingRight: 16 },
  sortMenu: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
    minWidth: 140,
    overflow: 'hidden',
  },
  sortItem: { paddingVertical: 10, paddingHorizontal: 16 },
  sortItemOn: { backgroundColor: '#FFF9E0' },
  sortItemTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
  sortItemTxtOn: { color: '#1a1a1a' },
  obTutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  obTutCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  obTutTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  obTutBody: { fontSize: 15, lineHeight: 24, color: '#555' },
  obTutEm: { fontWeight: '800', color: '#1a1a1a' },
  obTutBtn: {
    marginTop: 18,
    backgroundColor: '#FFD84D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  obTutBtnTxt: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
})
