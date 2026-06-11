import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import {
  NearbyBottomSheet,
  type NearbySheetHandle,
  type NearbySheetTab,
} from '@/components/nearby/NearbyBottomSheet'
import { colors } from '@/constants/colors'
import { NearbyMapView } from '@/components/map/NearbyMapView'
import { MapFilterBar } from '@/components/map/MapFilterBar'
import { GenreIcon } from '@/components/nearby/GenreIcon'
import { RunningDog } from '@/components/DogStates'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'
import {
  DEFAULT_MAP_GENRE,
  MAP_GENRE_COLOR,
  MAP_LIKE_COLOR,
  NEARBY_MAP_GENRE_STORAGE_KEY,
  NEARBY_RADIUS_M,
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
import { fetchNearbySpotsForGenreWithExpansion } from '@/lib/nearby/fetch-nearby-spots'
import { calcDistanceMeters, isWithinRadiusM } from '@/lib/nearby/geo'
import { isSameMapFilter, mapFilterLabel, type MapFilter } from '@/lib/nearby/map-filter'
import { sortPlacesByScore } from '@/lib/nearby/place-score'
import { sheetSpotFromPlace, sheetSpotFromUserRow, type SheetSpot } from '@/lib/nearby/sheet-spot'
import { fetchLikedSpotsForUser } from '@/lib/fetch-user-spot-lists'
import { ensureSpotId } from '@/lib/ensureSpot'
import { openSpotDetail } from '@/lib/open-spot-detail'
import { supabase } from '@/lib/supabase'
import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import type { PlaceResult } from '@/types/places'

const FILTER_BAR_H = 52

function isMapGenreKey(v: string): v is MapGenreKey {
  return (
    v === 'cafe' ||
    v === 'park' ||
    v === 'restaurant' ||
    v === 'dog_run' ||
    v === 'veterinary_care' ||
    v === 'pet_hotel'
  )
}

const HeartHeaderIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill={MAP_LIKE_COLOR}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

function NearbyPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const topSafe = insets.top + 8
  const filterBarTop = topSafe
  const overlayTop = filterBarTop + FILTER_BAR_H

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)
  const [locationError, setLocationError] = useState('')

  const [genre, setGenre] = useState<MapGenreKey>(DEFAULT_MAP_GENRE)
  const [genreReady, setGenreReady] = useState(false)
  const [activeFilter, setActiveFilter] = useState<MapFilter | null>({ kind: 'like' })
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceResult[]>([])
  const [spotsLoading, setSpotsLoading] = useState(false)
  const [spotsFetchError, setSpotsFetchError] = useState('')

  const [likedRows, setLikedRows] = useState<SheetSpot[]>([])
  const [userListsLoading, setUserListsLoading] = useState(false)

  const [selectedSpot, setSelectedSpot] = useState<SheetSpot | null>(null)
  const [likedOverrides, setLikedOverrides] = useState<Record<string, boolean>>({})
  const [sheetBottomInset, setSheetBottomInset] = useState(0)
  const [sheetIndex, setSheetIndex] = useState(-1)
  const sheetControl = useRef<NearbySheetHandle>(null)
  const sheetAnimatedIndex = useSharedValue(-1)

  const sheetTab: NearbySheetTab = useMemo(() => {
    if (activeFilter?.kind === 'like') return 'like'
    return 'score'
  }, [activeFilter])

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(NEARBY_MAP_GENRE_STORAGE_KEY)
        if (saved && isMapGenreKey(saved)) setGenre(saved)
      } catch {
        /* ignore */
      } finally {
        setGenreReady(true)
      }
    })()
  }, [])

  const clearFilter = useCallback(() => {
    setActiveFilter(null)
    setSelectedSpot(null)
    setSheetBottomInset(0)
    setSheetIndex(-1)
    sheetControl.current?.close()
  }, [])

  const handleFilterSelect = useCallback(
    (f: MapFilter) => {
      if (isSameMapFilter(activeFilter, f)) {
        requestAnimationFrame(() => sheetControl.current?.open())
        return
      }
      if (f.kind === 'genre') {
        setGenre(f.genre)
        void AsyncStorage.setItem(NEARBY_MAP_GENRE_STORAGE_KEY, f.genre)
      }
      setActiveFilter(f)
      setSelectedSpot(null)
      requestAnimationFrame(() => sheetControl.current?.open())
    },
    [activeFilter]
  )

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
      let cancelled = false
      void (async () => {
        const ok = await refreshLocation()
        if (cancelled || !ok) return
      })()
      return () => {
        cancelled = true
      }
    }, [refreshLocation])
  )

  const handleSheetIndexChange = useCallback((index: number) => {
    setSheetIndex(index)
    if (index >= 0) setSelectedSpot(null)
  }, [])

  const loadNearbySpots = useCallback(
    async (force = false) => {
      if (!location || !genreReady || activeFilter?.kind !== 'genre') return

      const cacheKey = `nearby:spots:${genre}:${geoBucket(location.lat, location.lng)}:exp`
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

      const { spots, error } = await fetchNearbySpotsForGenreWithExpansion(location, genre)
      writeCache(cacheKey, { spots, error: error ?? '' })
      setNearbyPlaces(spots)
      setSpotsFetchError(error ?? '')
      setSpotsLoading(false)
    },
    [location?.lat, location?.lng, genre, genreReady, activeFilter?.kind]
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
        setUserListsLoading(false)
        return
      }

      const locKey = location ? geoBucket(location.lat, location.lng) : 'none'
      const cacheKey = `nearby:user-lists:v2:${user.id}:${locKey}`

      const needsPhotoRefresh = (rows: SheetSpot[]) =>
        rows.some((s) => s.placeId.length > 0 && !s.photoRef)

      if (!force && isCacheFresh(cacheKey, CACHE_TTL.USER_LISTS_MS)) {
        const cached = readCache<{ liked: SheetSpot[] }>(cacheKey)
        if (cached && !needsPhotoRefresh(cached.liked)) {
          setLikedRows(cached.liked)
          setUserListsLoading(false)
          return
        }
      }

      const stale = readCache<{ liked: SheetSpot[] }>(cacheKey)
      if (stale) {
        setLikedRows(stale.liked)
      } else if (force || !getCacheEntry(cacheKey)) {
        setUserListsLoading(true)
      }

      const likedRes = await fetchLikedSpotsForUser(supabase, user.id)

      const origin = location
      const filterRow = (rows: UserSpotRow[]) => {
        if (!origin) return []
        return rows
          .map(sheetSpotFromUserRow)
          .filter((s): s is SheetSpot => s != null)
          .filter((s) => isWithinRadiusM(origin, s, NEARBY_RADIUS_M))
          .sort(
            (a, b) =>
              calcDistanceMeters(origin.lat, origin.lng, a.lat, a.lng) -
              calcDistanceMeters(origin.lat, origin.lng, b.lat, b.lng)
          )
      }

      const liked = likedRes.ok ? filterRow(likedRes.spots) : []
      writeCache(cacheKey, { liked })
      setLikedRows(liked)
      setUserListsLoading(false)
    },
    [location?.lat, location?.lng]
  )

  useEffect(() => {
    if (activeFilter?.kind !== 'like') return
    if (!location) return
    void loadUserLists(false)
  }, [activeFilter?.kind, location?.lat, location?.lng, loadUserLists])

  useEffect(() => {
    if (activeFilter?.kind !== 'like') return
    if (userListsLoading) return
    requestAnimationFrame(() => sheetControl.current?.open())
  }, [activeFilter?.kind, userListsLoading, likedRows.length])

  useFocusEffect(
    useCallback(() => {
      setActiveFilter({ kind: 'like' })
      if (location) {
        void loadUserLists(false)
      }
      requestAnimationFrame(() => sheetControl.current?.open())
    }, [location?.lat, location?.lng, loadUserLists])
  )

  const scoreSheetSpots = useMemo(() => {
    const sorted = sortPlacesByScore(nearbyPlaces, location)
    const genreLabel =
      activeFilter?.kind === 'genre' ? mapFilterLabel(activeFilter) : null
    return sorted.map((p) => {
      const row = sheetSpotFromPlace(p)
      return genreLabel ? { ...row, category: genreLabel } : row
    })
  }, [nearbyPlaces, location, activeFilter])

  const sheetItems = useMemo(() => {
    if (!activeFilter) return []
    if (activeFilter.kind === 'like') return likedRows
    return scoreSheetSpots
  }, [activeFilter, likedRows, scoreSheetSpots])

  const mapMarkers = activeFilter ? sheetItems : []

  const handleOpenDetail = useCallback(
    (spot: SheetSpot) => {
      openSpotDetail(router, spot)
    },
    [router]
  )

  const likedPlaceIds = useMemo(() => {
    const set = new Set(likedRows.map((r) => r.placeId).filter(Boolean))
    for (const [pid, v] of Object.entries(likedOverrides)) {
      if (v) set.add(pid)
      else set.delete(pid)
    }
    return set
  }, [likedRows, likedOverrides])

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

  const emptyCopy =
    sheetTab === 'like'
      ? { title: '近くのいいねはまだありません', hint: '気になるスポットにいいねしてみましょう。' }
      : { title: '近くにスポットが見つかりませんでした', hint: '別のジャンルを試すか、位置情報をご確認ください。' }

  const sheetListExpanded = activeFilter !== null && sheetIndex >= 1
  const showRecenter = activeFilter === null

  const headerIcon = useMemo(() => {
    if (!activeFilter) return null
    if (activeFilter.kind === 'genre') {
      return <GenreIcon genre={activeFilter.genre} size={22} color={MAP_GENRE_COLOR[activeFilter.genre]} />
    }
    if (activeFilter.kind === 'like') return <HeartHeaderIcon />
    return null
  }, [activeFilter])

  const headerTitle = activeFilter ? mapFilterLabel(activeFilter) : ''

  const listLoading =
    (spotsLoading && sheetTab === 'score') || (userListsLoading && sheetTab !== 'score')

  return (
    <GestureHandlerRootView style={styles.flex}>
      <BottomSheetModalProvider>
        <View style={styles.flex}>
          <View style={styles.mapArea}>
            <NearbyMapView
              markers={mapMarkers}
              likedPlaceIds={likedPlaceIds}
              visitedPlaceIds={new Set<string>()}
              selectedSpot={selectedSpot}
              userLocation={location}
              onSelectSpot={setSelectedSpot}
              onClearSelection={() => setSelectedSpot(null)}
              onOpenDetail={handleOpenDetail}
              sheetOpen={sheetListExpanded}
              showRecenter={showRecenter}
              sheetAnimatedIndex={sheetAnimatedIndex}
              bottomInset={sheetBottomInset}
              topInset={overlayTop}
              pinGenre={activeFilter?.kind === 'genre' ? activeFilter.genre : undefined}
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

            {spotsLoading && activeFilter?.kind === 'genre' ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <RunningDog label="近くのスポットを探し中..." />
              </View>
            ) : null}
          </View>

          {/* 地図UI（ジャンルフィルタ）— リストより下のレイヤー。お散歩アラートは検索タブ上部カードへ移設 */}
          <View style={styles.mapOverlays} pointerEvents="box-none">
            <MapFilterBar active={activeFilter} onSelect={handleFilterSelect} topInset={filterBarTop} />
          </View>

          {/* リストは最前面 — 上げたときに地図UIの裏へ隠れる */}
          <View style={styles.sheetHost} pointerEvents="box-none">
            <NearbyBottomSheet
              ref={sheetControl}
              open={activeFilter !== null}
              animatedIndex={sheetAnimatedIndex}
              tab={sheetTab}
              items={sheetItems}
              userLocation={location}
              loading={listLoading}
              emptyTitle={emptyCopy.title}
              emptyHint={emptyCopy.hint}
              onDiscover={() => router.push('/(tabs)/search')}
              onPressSpot={handleOpenDetail}
              likedPlaceIds={likedPlaceIds}
              onToggleLike={(s) => void handleToggleLike(s)}
              onClose={clearFilter}
              headerIcon={headerIcon}
              headerTitle={headerTitle}
              headerCount={sheetItems.length}
              onSheetPositionChange={setSheetBottomInset}
              onSheetIndexChange={handleSheetIndexChange}
            />
          </View>
        </View>
      </BottomSheetModalProvider>

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
  sheetHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
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
})

export default function NearbyPageScreen() {
  return (
    <ScreenErrorBoundary label="map">
      <NearbyPage />
    </ScreenErrorBoundary>
  )
}
