import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from '@react-navigation/native'
import Svg, { Path } from 'react-native-svg'
import { AppHeader } from '@/components/AppHeader'
import { AdNativeCard } from '@/components/AdNativeCard'
import { NearbySpotCard } from '@/components/nearby/NearbySpotCard'
import { RunningDog, PowState } from '@/components/DogStates'
import { fetchUserWalkAreaTags } from '@/lib/fetch-user-walk-area-tags'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { isAdsMobileSdkInitialized, prepareSearchTabAdsOnce } from '@/lib/prepare-search-ads'
import { supabase } from '@/lib/supabase'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { POST_ONBOARDING_TUTORIAL_KEY } from '@/lib/onboarding-constants'
import { track } from '@/lib/analytics'
import { wanspotFetch } from '@/lib/wanspot-api'
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

const IconSort = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M3 6h18M3 12h12M3 18h6" />
  </Svg>
)

export default function NearbyPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
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
  const [obTutorialDogName, setObTutorialDogName] = useState('')
  const [userWalkTags, setUserWalkTags] = useState<string[]>([])
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [adsRuntimeReady, setAdsRuntimeReady] = useState(false)
  const adsPrimedRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const v = await AsyncStorage.getItem(POST_ONBOARDING_TUTORIAL_KEY)
          if (v === '1') {
            setShowObTutorial(true)
            const {
              data: { user },
            } = await supabase.auth.getUser()
            if (user) {
              const { data: dogRow } = await supabase
                .from('dogs')
                .select('name')
                .eq('user_id', user.id)
                .maybeSingle()
              const n = typeof dogRow?.name === 'string' ? dogRow.name.trim() : ''
              setObTutorialDogName(n)
            } else {
              setObTutorialDogName('')
            }
          }
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

  const fetchNearbySpots = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!location) return
      const silent = opts?.silent === true
      if (!silent) {
        setLoading(true)
        setSpotsFetchError('')
      }
      const q = `/api/spots/nearby?lat=${location.lat}&lng=${location.lng}&radius=${distance}&type=${genre}`
      try {
        const r = await wanspotFetch(q)
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
          setSpotsFetchError(
            typeof data.error === 'string' ? data.error : `スポットの取得に失敗しました (${r.status})`
          )
          return
        }
        setSpots(data.spots ?? [])
      } catch {
        setSpots([])
        setSpotsFetchError(
          'ネットワークエラーです。API の URL（EXPO_PUBLIC_WANSPOT_API_URL / https://www.wanspot.app）を確認してください'
        )
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [location, genre, distance]
  )

  useEffect(() => {
    void fetchNearbySpots()
  }, [fetchNearbySpots])

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

  const onPullRefreshNearby = useCallback(async () => {
    setPullRefreshing(true)
    try {
      await reloadUserLikedPlaceIds()
      await fetchNearbySpots({ silent: true })
      const tags = await fetchUserWalkAreaTags(supabase)
      setUserWalkTags(tags)
    } finally {
      setPullRefreshing(false)
    }
  }, [fetchNearbySpots, reloadUserLikedPlaceIds])

  useFocusEffect(
    useCallback(() => {
      void reloadUserLikedPlaceIds()
    }, [reloadUserLikedPlaceIds])
  )

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      const run = async () => {
        try {
          if (!adsEnabledForDevice()) {
            if (!cancelled) setAdsRuntimeReady(false)
            return
          }
          if (isAdsMobileSdkInitialized()) {
            adsPrimedRef.current = true
            if (!cancelled) setAdsRuntimeReady(true)
            return
          }
          if (adsPrimedRef.current) {
            if (!cancelled) setAdsRuntimeReady(true)
            return
          }
          // 起動直後の負荷と競合を避ける（検索と同じ安全側の遅延）
          await new Promise((r) => setTimeout(r, 800))
          if (cancelled) return
          await prepareSearchTabAdsOnce()
          adsPrimedRef.current = true
          if (!cancelled) setAdsRuntimeReady(true)
        } catch (e) {
          console.warn(`prepareSearchTabAds failed (nearby): ${String((e as unknown) ?? '')}`)
          if (!cancelled) setAdsRuntimeReady(false)
        }
      }

      void run()

      return () => {
        cancelled = true
      }
    }, [])
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

  const AD_ROW_EVERY = 5
  const shouldShowAdAfter = (index: number, total: number) =>
    (index + 1) % AD_ROW_EVERY === 0 || (index + 1 === total && total < AD_ROW_EVERY)

  return (
    <View style={styles.main}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={onPullRefreshNearby}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
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
          {displayedSpots.map((spot, index) => (
            <View key={spot.place_id}>
              <NearbySpotCard
                spot={spot}
                likeCount={likeCounts[spot.place_id] ?? 0}
                userLocation={location}
                userWalkTags={userWalkTags}
                onOpenDetail={(id) => router.push(`/spots/${id}`)}
                onLikeStateChange={handleSpotLikeChange}
              />
              {isFocused && shouldShowAdAfter(index, displayedSpots.length) ? (
                <AdNativeCard adsReady={adsRuntimeReady} />
              ) : null}
            </View>
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
            <Text style={styles.obTutTitle}>
              {`${obTutorialDogName.trim() || 'ワン'}ちゃんとお出かけの準備！`}
            </Text>
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
  genreTxtOn: { color: '#2b2a28' },
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
    backgroundColor: '#2b2a28',
    borderColor: '#2b2a28',
  },
  likeFilterTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
  likeFilterTxtOn: { color: '#fff' },
  distChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  distChipOn: { backgroundColor: '#2b2a28' },
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
    backgroundColor: '#2b2a28',
  },
  sortBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  err: { textAlign: 'center', paddingVertical: 32, color: '#aaa', fontSize: 14 },
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
  sortItemTxtOn: { color: '#2b2a28' },
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
  obTutTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2b2a28',
    marginBottom: 12,
    textAlign: 'center',
  },
  obTutBody: { fontSize: 15, lineHeight: 24, color: '#555' },
  obTutEm: { fontWeight: '800', color: '#2b2a28' },
  obTutBtn: {
    marginTop: 18,
    backgroundColor: '#FFD84D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  obTutBtnTxt: { fontSize: 16, fontWeight: '800', color: '#2b2a28' },
})
