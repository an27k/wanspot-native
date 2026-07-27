import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { NearbyMapView } from '@/components/map/NearbyMapView'
import { MapFilterBar } from '@/components/map/MapFilterBar'
import { NearbySpotCarousel } from '@/components/nearby/NearbySpotCarousel'
import { RunningDog } from '@/components/DogStates'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'
import {
  NEARBY_GENRE_ALL,
  NEARBY_INDOOR_ONLY_STORAGE_KEY,
  NEARBY_MAP_CONDITIONS_STORAGE_KEY,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import {
  CACHE_TTL,
  geoBucket,
  getCacheEntry,
  invalidateCachePrefix,
  isCacheFresh,
  readCache,
  writeCache,
} from '@/lib/client-cache'
import { resolveSessionLocation } from '@/lib/location-session'
import {
  fetchAllNearbySpotsWithExpansion,
  fetchNearbySpotsForGenreWithExpansion,
} from '@/lib/nearby/fetch-nearby-spots'
import {
  activeConditionCount,
  applyMapConditions,
  EMPTY_MAP_CONDITIONS,
  type MapConditionFilter,
} from '@/lib/nearby/map-filter'
import { sortPlacesByScore } from '@/lib/nearby/place-score'
import { sheetSpotFromPlace, sheetSpotFromUserRow, type SheetSpot } from '@/lib/nearby/sheet-spot'
import { fetchLikedSpotsForUser } from '@/lib/fetch-user-spot-lists'
import { ensureSpotId } from '@/lib/ensureSpot'
import { openSpotDetail } from '@/lib/open-spot-detail'
import { supabase } from '@/lib/supabase'
import { wanspotFetch } from '@/lib/wanspot-api'
import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import type { PlaceResult } from '@/types/places'

const FILTER_BAR_H = 52
const SEARCH_BAR_H = 56

/** サーバーが返す検索中心。駅・エリア解決時は現在地ではなくその座標が距離の基準になる */
type SearchCenter = { lat: number; lng: number; source: 'user' | 'station' | 'area' }

/** 検索バーフォーカス時のサジェスト（全国どこでも意味が通る条件語のみ） */
const SEARCH_SUGGESTIONS = [
  'ドッグラン',
  '室内ドッグラン',
  '大型犬可',
  '雨の日OK',
  '犬と泊まれる',
  'ドッグビーチ',
  '犬と温泉',
]

function NearbyPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const topSafe = insets.top + 8
  const searchBarTop = topSafe
  const filterBarTop = searchBarTop + SEARCH_BAR_H
  const overlayTop = filterBarTop + FILTER_BAR_H

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)
  const [locationError, setLocationError] = useState('')

  /** null = 全ジャンル表示（デフォルト）。チップ再タップで解除して全表示に戻る */
  const [genre, setGenre] = useState<MapGenreKey | null>(null)
  const [prefsReady, setPrefsReady] = useState(false)
  /** 店内OK・テラスOK・いいねの条件フィルタ。ジャンルと直交して重ね掛けできる */
  const [conditions, setConditions] = useState<MapConditionFilter>(EMPTY_MAP_CONDITIONS)
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceResult[]>([])
  const [spotsLoading, setSpotsLoading] = useState(false)
  const [spotsFetchError, setSpotsFetchError] = useState('')

  const [likedRows, setLikedRows] = useState<SheetSpot[]>([])
  const [selectedSpot, setSelectedSpot] = useState<SheetSpot | null>(null)
  const [likedOverrides, setLikedOverrides] = useState<Record<string, boolean>>({})

  /** テキスト検索（旧検索ホームから統合）。結果はマップのピン＋カルーセルに流す */
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<PlaceResult[] | null>(null)
  const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(null)

  const clearSearch = useCallback(() => {
    setQuery('')
    setSearchResults(null)
    setSearchCenter(null)
    setSelectedSpot(null)
    Keyboard.dismiss()
  }, [])

  const executeSearch = useCallback(
    async (rawQuery: string) => {
      const trimmed = rawQuery.trim()
      if (!trimmed) return
      Keyboard.dismiss()
      setSearchFocused(false)
      setSearchLoading(true)
      try {
        const locationParam = location ? `&lat=${location.lat}&lng=${location.lng}` : ''
        const res = await wanspotFetch(`/api/spots/search?q=${encodeURIComponent(trimmed)}${locationParam}`)
        const data = (await res.json()) as { spots?: PlaceResult[]; search_center?: SearchCenter | null }
        const spots = data.spots ?? []
        setSearchResults(spots)
        const sc = data.search_center
        setSearchCenter(sc && typeof sc.lat === 'number' && typeof sc.lng === 'number' ? sc : null)
        setSelectedSpot(null)
      } catch {
        setSearchResults([])
        setSearchCenter(null)
      } finally {
        setSearchLoading(false)
      }
    },
    [location]
  )

  const searchActive = searchResults !== null

  // 保存済みの条件を復元（旧 店内OK 単独キーからのマイグレーション込み）。
  // ジャンルは復元しない — デフォルト表示は常に「現在地の全ジャンル」（ジャンル絞りはセッション内のみ）
  useEffect(() => {
    void (async () => {
      try {
        const savedConditions = await AsyncStorage.getItem(NEARBY_MAP_CONDITIONS_STORAGE_KEY)
        if (savedConditions) {
          const parsed = JSON.parse(savedConditions) as Partial<MapConditionFilter>
          setConditions({
            indoorOnly: parsed.indoorOnly === true,
            terraceOnly: parsed.terraceOnly === true,
            likedOnly: parsed.likedOnly === true,
          })
        } else {
          // 旧バージョンの店内OK単独トグルを引き継ぐ
          const legacyIndoor = await AsyncStorage.getItem(NEARBY_INDOOR_ONLY_STORAGE_KEY)
          if (legacyIndoor === '1') setConditions((c) => ({ ...c, indoorOnly: true }))
        }
      } catch {
        /* ignore */
      } finally {
        setPrefsReady(true)
      }
    })()
  }, [])

  const handleSelectGenre = useCallback(
    (next: MapGenreKey | null) => {
      // 検索結果表示中にジャンルを触ったら「ブラウズに戻る」操作として検索を閉じる
      if (searchActive) clearSearch()
      setGenre(next)
      setSelectedSpot(null)
    },
    [searchActive, clearSearch]
  )

  const handleToggleCondition = useCallback((key: keyof MapConditionFilter) => {
    setConditions((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      void AsyncStorage.setItem(NEARBY_MAP_CONDITIONS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const clearConditions = useCallback(() => {
    setConditions(EMPTY_MAP_CONDITIONS)
    void AsyncStorage.setItem(NEARBY_MAP_CONDITIONS_STORAGE_KEY, JSON.stringify(EMPTY_MAP_CONDITIONS))
  }, [])

  const refreshLocation = useCallback(async () => {
    const result = await resolveSessionLocation(location)
    if (!result.ok) {
      if (result.permissionDenied) {
        setLocation(null)
        setLocationPermissionDenied(true)
        setLocationError('')
        return false
      }
      setLocationError(result.error)
      return false
    }
    setLocationPermissionDenied(false)
    setLocationError('')
    if (result.changed) setLocation(result.location)
    return true
  }, [location])

  useFocusEffect(
    useCallback(() => {
      void refreshLocation()
    }, [refreshLocation])
  )

  const loadNearbySpots = useCallback(
    async (force = false) => {
      if (!location || !prefsReady) return

      const genreKey = genre ?? NEARBY_GENRE_ALL
      const cacheKey = `nearby:spots:${genreKey}:${geoBucket(location.lat, location.lng)}:exp`
      if (!force && isCacheFresh(cacheKey, CACHE_TTL.NEARBY_SPOTS_MS)) {
        const cached = readCache<{ spots: PlaceResult[]; error: string }>(cacheKey)
        if (cached) {
          setNearbyPlaces(cached.spots)
          setSpotsFetchError(cached.error)
          return
        }
      }

      const stale = readCache<{ spots: PlaceResult[]; error: string }>(cacheKey)
      if (stale) {
        setNearbyPlaces(stale.spots)
        setSpotsFetchError(stale.error)
      } else {
        setSpotsLoading(true)
      }

      const { spots, error } =
        genre === null
          ? await fetchAllNearbySpotsWithExpansion(location)
          : await fetchNearbySpotsForGenreWithExpansion(location, genre)
      writeCache(cacheKey, { spots, error: error ?? '' })
      setNearbyPlaces(spots)
      setSpotsFetchError(error ?? '')
      setSpotsLoading(false)
    },
    [location?.lat, location?.lng, genre, prefsReady]
  )

  useEffect(() => {
    void loadNearbySpots()
  }, [loadNearbySpots])

  const loadUserLists = useCallback(
    async (force = false) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLikedRows([])
        return
      }

      const locKey = location ? geoBucket(location.lat, location.lng) : 'none'
      const cacheKey = `nearby:user-lists:v5:${user.id}:${locKey}`

      if (!force && isCacheFresh(cacheKey, CACHE_TTL.USER_LISTS_MS)) {
        const cached = readCache<{ liked: SheetSpot[] }>(cacheKey)
        if (cached) {
          setLikedRows(cached.liked)
          return
        }
      }

      const stale = readCache<{ liked: SheetSpot[] }>(cacheKey)
      if (stale && !force && getCacheEntry(cacheKey)) {
        setLikedRows(stale.liked)
      }

      const likedRes = await fetchLikedSpotsForUser(supabase, user.id)
      if (!likedRes.ok) {
        console.warn('[nearby] fetchLikedSpotsForUser', likedRes.code ?? '', likedRes.error)
        if (!stale) setLikedRows([])
        return
      }

      const liked = (likedRes.spots as UserSpotRow[])
        .map(sheetSpotFromUserRow)
        .filter((s): s is SheetSpot => s != null)
      writeCache(cacheKey, { liked })
      setLikedRows(liked)
    },
    [location?.lat, location?.lng]
  )

  // いいねは常時ロード（ハート表示・いいね条件フィルタ・全ジャンル表示への合流に使う）
  useEffect(() => {
    void loadUserLists(false)
  }, [loadUserLists])

  // 朝のお散歩予報通知は初期タブ（ここ）からも予約する（設定タブを開かなくても翌朝から届く）。
  // 予報から本文を事前計算するため位置と散歩時間設定を渡す。犬名は設定タブ側の同期が上書きで貼り直す。
  // 起動直後の負荷を避けて少し遅らせる
  useEffect(() => {
    if (!location) return
    const t = setTimeout(() => {
      void (async () => {
        const [{ syncWalkAdviceMorningNotification }, { getWalkTimeHour }] = await Promise.all([
          import('@/lib/notifications/walk-advice-morning'),
          import('@/lib/weather/walk-time-pref'),
        ])
        const walkHour = await getWalkTimeHour()
        void syncWalkAdviceMorningNotification(null, { location, walkHour })
      })()
    }, 4000)
    return () => clearTimeout(t)
  }, [location?.lat, location?.lng])

  const likedPlaceIds = useMemo(() => {
    const set = new Set(likedRows.map((r) => r.placeId).filter(Boolean))
    for (const [pid, v] of Object.entries(likedOverrides)) {
      if (v) set.add(pid)
      else set.delete(pid)
    }
    return set
  }, [likedRows, likedOverrides])

  const items = useMemo(() => {
    // 検索結果表示中: 結果を検索中心（駅・エリア解決があればそちら）からの距離順で表示。条件フィルタは重ね掛け
    if (searchResults !== null) {
      const base = searchCenter ?? location
      const sorted = base ? sortPlacesByScore(searchResults, base) : searchResults
      return applyMapConditions(
        sorted.map(sheetSpotFromPlace),
        conditions,
        (s) => likedPlaceIds.has(s.placeId)
      )
    }

    const scored = sortPlacesByScore(nearbyPlaces, location).map(sheetSpotFromPlace)
    // 全ジャンル表示のときは、取得半径の外にあるいいねスポットも棚に合流させる
    let base = scored
    if (genre === null && likedRows.length > 0) {
      const seen = new Set(scored.map((s) => s.placeId).filter(Boolean))
      base = [...scored, ...likedRows.filter((s) => s.placeId && !seen.has(s.placeId))]
    }
    return applyMapConditions(base, conditions, (s) => likedPlaceIds.has(s.placeId))
  }, [searchResults, searchCenter, nearbyPlaces, location, genre, likedRows, conditions, likedPlaceIds])

  // 検索直後は先頭の結果を選択してマップを検索エリアへ寄せる（カルーセルとピンが即同期する）
  useEffect(() => {
    if (!searchActive) return
    if (selectedSpot) return
    if (items.length > 0) setSelectedSpot(items[0])
    // items は検索結果確定後に同期的に決まるため、この effect は検索完了ごとに一度だけ効く
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchActive, searchResults])

  // 絞り込みで選択中スポットが消えたら、選択も静かに外す
  useEffect(() => {
    if (!selectedSpot) return
    if (!items.some((s) => s.key === selectedSpot.key)) setSelectedSpot(null)
  }, [items, selectedSpot])

  const handleOpenDetail = useCallback(
    (spot: SheetSpot) => {
      openSpotDetail(router, spot)
    },
    [router]
  )

  const handleToggleLike = useCallback(
    async (spot: SheetSpot) => {
      const next = !likedPlaceIds.has(spot.placeId)
      setLikedOverrides((prev) => ({ ...prev, [spot.placeId]: next }))
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/(auth)/login')
        return
      }
      let spotId = spot.spotUuid
      if (!spotId) {
        const place: PlaceResult = {
          place_id: spot.placeId,
          name: spot.name,
          category: spot.category,
          lat: spot.lat,
          lng: spot.lng,
          address: spot.address,
          photo_ref: spot.photoRef,
          rating: spot.rating,
          price_level: spot.priceLevel,
          price_label: spot.priceLabel,
          user_ratings_total: spot.userRatingsTotal,
        }
        spotId = await ensureSpotId(place)
      }
      if (!spotId) return
      if (next) {
        await supabase.from('spot_likes').insert({ user_id: user.id, spot_id: spotId })
      } else {
        await supabase.from('spot_likes').delete().eq('user_id', user.id).eq('spot_id', spotId)
      }
      invalidateCachePrefix('nearby:user-lists:')
      void loadUserLists(true)
    },
    [likedPlaceIds, router, loadUserLists]
  )

  const conditionCount = activeConditionCount(conditions)
  const carouselBottom = TAB_BAR_HEIGHT + insets.bottom + 12
  const showEmpty =
    !spotsLoading && !searchLoading && items.length === 0 && (searchActive || !!location)

  const emptyCopy = searchActive
    ? conditionCount > 0
      ? {
          title: '条件に合う検索結果がありませんでした',
          hint: '店内OK・テラスOKは確認済みのお店だけを表示しています。',
          action: '条件をすべて解除',
        }
      : {
          title: '検索結果が見つかりませんでした',
          hint: '駅名・エリア名や、別のことばで試してみてください。',
          action: null,
        }
    : conditionCount > 0
      ? {
          title: '条件に合うスポットがこの範囲に見つかりませんでした',
          hint: '店内OK・テラスOKは確認済みのお店だけを表示しています。',
          action: '条件をすべて解除',
        }
      : {
          title: '近くにスポットが見つかりませんでした',
          hint: '別のジャンルを試すか、位置情報をご確認ください。',
          action: null,
        }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <View style={styles.flex}>
        <View style={styles.mapArea}>
          <NearbyMapView
            markers={items}
            selectedSpot={selectedSpot}
            userLocation={location}
            onSelectSpot={setSelectedSpot}
            onClearSelection={() => setSelectedSpot(null)}
            topInset={overlayTop}
            bottomInset={carouselBottom + 150}
          />

          {locationPermissionDenied ? (
            <View style={[styles.permissionBanner, { top: overlayTop + 8 }]}>
              <Text style={styles.permissionBannerTxt}>
                近くのスポットとお散歩予報には位置情報の許可が必要です（別の許可項目ではありません）。
              </Text>
              <View style={styles.permissionBtnRow}>
                <TouchableOpacity style={styles.permissionBtn} onPress={() => void refreshLocation()}>
                  <Text style={styles.permissionBtnTxt}>許可を確認</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.permissionBtnGhost} onPress={() => void Linking.openSettings()}>
                  <Text style={styles.permissionBtnGhostTxt}>設定を開く</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {locationError ? (
            <Text style={[styles.errOverlay, { top: overlayTop + 8 }]}>{locationError}</Text>
          ) : null}
          {spotsFetchError ? (
            <Text style={[styles.errOverlay, { top: overlayTop + 8 }]}>{spotsFetchError}</Text>
          ) : null}

          {spotsLoading || searchLoading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <RunningDog label={searchLoading ? 'スポットを検索中...' : '近くのスポットを探し中...'} />
            </View>
          ) : null}
        </View>

        {/* 地図上部: 検索バー（旧検索ホームから統合）＋フィルタバー */}
        <View style={styles.mapOverlays} pointerEvents="box-none">
          <View style={[styles.searchBarWrap, { top: searchBarTop }]}>
            <View style={styles.searchPill}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onSubmitEditing={() => void executeSearch(query)}
                placeholder="スポット・駅・エリアを検索"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 || searchActive ? (
                <TouchableOpacity onPress={clearSearch} hitSlop={8} accessibilityLabel="検索をクリア">
                  <Ionicons name="close-circle" size={18} color="#BBB" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {searchActive ? (
            <View style={[styles.resultBar, { top: filterBarTop + 8 }]}>
              <Text style={styles.resultBarTxt} numberOfLines={1}>
                「{query.trim()}」の検索結果 {items.length}件
              </Text>
              <TouchableOpacity onPress={clearSearch} hitSlop={8} accessibilityLabel="検索結果を閉じる">
                <Text style={styles.resultBarClose}>閉じる</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MapFilterBar
              genre={genre}
              conditions={conditions}
              onSelectGenre={handleSelectGenre}
              onToggleCondition={handleToggleCondition}
              topInset={filterBarTop}
            />
          )}

          {searchFocused && !searchActive ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={[styles.sugRow, { top: overlayTop + 4 }]}
              contentContainerStyle={styles.sugRowContent}
            >
              {SEARCH_SUGGESTIONS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.sugChip}
                  onPress={() => {
                    setQuery(tag)
                    void executeSearch(tag)
                  }}
                >
                  <Text style={styles.sugChipTxt}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* 地図下の横スワイプカルーセル（常設・シートは廃止） */}
        {items.length > 0 ? (
          <NearbySpotCarousel
            items={items}
            selectedKey={selectedSpot?.key ?? null}
            userLocation={location}
            likedPlaceIds={likedPlaceIds}
            onToggleLike={(s) => void handleToggleLike(s)}
            onPressSpot={handleOpenDetail}
            onSelectSpot={setSelectedSpot}
            bottomOffset={carouselBottom}
          />
        ) : null}

        {showEmpty ? (
          <View style={[styles.emptyCard, { bottom: carouselBottom }]}>
            <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
            <Text style={styles.emptyHint}>{emptyCopy.hint}</Text>
            {emptyCopy.action ? (
              <TouchableOpacity style={styles.emptyActionBtn} onPress={clearConditions}>
                <Text style={styles.emptyActionTxt}>{emptyCopy.action}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  mapArea: { flex: 1, zIndex: 1 },
  mapOverlays: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
    elevation: 2,
  },
  permissionBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    zIndex: 11,
  },
  permissionBannerTxt: { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },
  permissionBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permissionBtn: {
    backgroundColor: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  permissionBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permissionBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  permissionBtnGhostTxt: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  errOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    textAlign: 'center',
    fontSize: 13,
    color: '#c44',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 8,
    borderRadius: 8,
    zIndex: 11,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,246,243,0.96)',
    zIndex: 7,
  },
  emptyCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
    zIndex: 9,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  searchBarWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 5,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary, paddingVertical: 0 },
  resultBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  resultBarTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  resultBarClose: { fontSize: 13, fontWeight: '800', color: colors.brandDark },
  sugRow: { position: 'absolute', left: 0, right: 0 },
  sugRowContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  sugChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sugChipTxt: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  emptyHint: { fontSize: 12, color: '#888', lineHeight: 18 },
  emptyActionBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.brandButton,
    borderWidth: 1,
    borderColor: colors.brandDark,
  },
  emptyActionTxt: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
})

export default function NearbyPageScreen() {
  return (
    <ScreenErrorBoundary label="map">
      <NearbyPage />
    </ScreenErrorBoundary>
  )
}
