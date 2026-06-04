import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import * as Location from 'expo-location'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapAppMenu } from '@/components/map/MapAppMenu'
import {
  NearbyBottomSheet,
  type NearbySheetHandle,
  type NearbySheetTab,
} from '@/components/nearby/NearbyBottomSheet'
import { NearbyMapView } from '@/components/map/NearbyMapView'
import { RunningDog } from '@/components/DogStates'
import {
  DEFAULT_MAP_GENRE,
  matchesGenre,
  NEARBY_MAP_GENRE_STORAGE_KEY,
  NEARBY_RADIUS_M,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import { fetchNearbySpotsForGenre } from '@/lib/nearby/fetch-nearby-spots'
import { calcDistanceMeters, isWithinRadiusM } from '@/lib/nearby/geo'
import { sortPlacesByScore } from '@/lib/nearby/place-score'
import { sheetSpotFromPlace, sheetSpotFromUserRow, type SheetSpot } from '@/lib/nearby/sheet-spot'
import { fetchCheckedInSpotsForUser, fetchLikedSpotsForUser } from '@/lib/fetch-user-spot-lists'
import { ensureSpotId } from '@/lib/ensureSpot'
import { useWeather } from '@/lib/weather/use-weather'
import { supabase } from '@/lib/supabase'
import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import type { PlaceResult } from '@/types/places'

const DEFAULT_SHEET_BOTTOM = 280

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

export default function NearbyPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const topSafe = insets.top + 8
  const mapTopControls = topSafe + 52

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)
  const [locationError, setLocationError] = useState('')

  const [genre, setGenre] = useState<MapGenreKey>(DEFAULT_MAP_GENRE)
  const [genreReady, setGenreReady] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceResult[]>([])
  const [spotsLoading, setSpotsLoading] = useState(false)
  const [spotsFetchError, setSpotsFetchError] = useState('')

  const [sheetTab, setSheetTab] = useState<NearbySheetTab>('score')
  const [likedRows, setLikedRows] = useState<SheetSpot[]>([])
  const [visitedRows, setVisitedRows] = useState<SheetSpot[]>([])
  const [userListsLoading, setUserListsLoading] = useState(false)

  const [selectedSpot, setSelectedSpot] = useState<SheetSpot | null>(null)
  // いいねの楽観的更新（DB反映前でもハートを即時に切り替える）
  const [likedOverrides, setLikedOverrides] = useState<Record<string, boolean>>({})
  const [sheetBottomInset, setSheetBottomInset] = useState(DEFAULT_SHEET_BOTTOM)
  const [sheetIndex, setSheetIndex] = useState(1)
  const sheetControl = useRef<NearbySheetHandle>(null)
  // シートの開閉に追従するインデックス（0:収納〜2:全開）。下のグラデーション演出に使用。
  const sheetAnimatedIndex = useSharedValue(1)

  const weather = useWeather(location)

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

  const handleGenreChange = useCallback((g: MapGenreKey) => {
    setGenre(g)
    setSelectedSpot(null)
    void AsyncStorage.setItem(NEARBY_MAP_GENRE_STORAGE_KEY, g)
  }, [])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        const { status } = await Location.getForegroundPermissionsAsync()
        if (cancelled) return
        if (status !== 'granted') {
          setLocation(null)
          setLocationPermissionDenied(true)
          setLocationError('')
          return
        }
        setLocationPermissionDenied(false)
        try {
          const pos = await Location.getCurrentPositionAsync({})
          if (cancelled) return
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setLocationError('')
        } catch {
          if (!cancelled) setLocationError('位置情報を取得できませんでした')
        }
      })()
      return () => {
        cancelled = true
      }
    }, [])
  )

  const loadNearbySpots = useCallback(async () => {
    if (!location || !genreReady) return
    setSpotsLoading(true)
    setSpotsFetchError('')
    const { spots, error } = await fetchNearbySpotsForGenre(location, NEARBY_RADIUS_M, genre)
    setNearbyPlaces(spots)
    setSpotsFetchError(error ?? '')
    setSpotsLoading(false)
  }, [location, genre, genreReady])

  useEffect(() => {
    void loadNearbySpots()
  }, [loadNearbySpots])

  const loadUserLists = useCallback(async () => {
    setUserListsLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLikedRows([])
      setVisitedRows([])
      setUserListsLoading(false)
      return
    }

    const [likedRes, visitedRes] = await Promise.all([
      fetchLikedSpotsForUser(supabase, user.id),
      fetchCheckedInSpotsForUser(supabase, user.id),
    ])

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

    if (likedRes.ok) setLikedRows(filterRow(likedRes.spots))
    else setLikedRows([])

    if (visitedRes.ok) setVisitedRows(filterRow(visitedRes.spots))
    else setVisitedRows([])

    setUserListsLoading(false)
  }, [location])

  useFocusEffect(
    useCallback(() => {
      void loadUserLists()
    }, [loadUserLists])
  )

  const scoreSheetSpots = useMemo(() => {
    const sorted = sortPlacesByScore(nearbyPlaces, location)
    return sorted.map(sheetSpotFromPlace)
  }, [nearbyPlaces, location])

  // ❤︎ / ☑︎ も選択中ジャンルで絞り込む
  const likedFiltered = useMemo(
    () => likedRows.filter((s) => matchesGenre(s.category, genre)),
    [likedRows, genre]
  )
  const visitedFiltered = useMemo(
    () => visitedRows.filter((s) => matchesGenre(s.category, genre)),
    [visitedRows, genre]
  )

  const sheetItems = useMemo(() => {
    if (sheetTab === 'like') return likedFiltered
    if (sheetTab === 'visited') return visitedFiltered
    return scoreSheetSpots
  }, [sheetTab, likedFiltered, visitedFiltered, scoreSheetSpots])

  const mapMarkers = sheetItems

  const handleOpenDetail = useCallback(
    async (spot: SheetSpot) => {
      if (spot.spotUuid) {
        router.push(`/spots/${spot.spotUuid}`)
        return
      }
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
      const id = await ensureSpotId(place)
      if (id) router.push(`/spots/${id}`)
    },
    [router]
  )

  const handleTabChange = useCallback((tab: NearbySheetTab) => {
    setSheetTab(tab)
    setSelectedSpot(null)
  }, [])

  // 現在いいね済みの placeId 集合（DB + 楽観的更新）
  const likedPlaceIds = useMemo(() => {
    const set = new Set(likedRows.map((r) => r.placeId).filter(Boolean))
    for (const [pid, v] of Object.entries(likedOverrides)) {
      if (v) set.add(pid)
      else set.delete(pid)
    }
    return set
  }, [likedRows, likedOverrides])

  // カード右上のいいねトグル（score タブの Google プレイスは spot_id を解決してから操作）
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
      void loadUserLists()
    },
    [likedPlaceIds, router, loadUserLists]
  )

  const emptyCopy =
    sheetTab === 'like'
      ? { title: 'このジャンルのいいねはまだありません', hint: 'ジャンルを変えるか、気になるスポットにいいねしてみましょう。' }
      : sheetTab === 'visited'
        ? { title: 'このジャンルの記録はまだありません', hint: 'ジャンルを変えるか、行ったスポットを記録してみましょう。' }
        : { title: '近くにスポットが見つかりませんでした', hint: 'ジャンルを変えるか、位置情報をご確認ください。' }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <BottomSheetModalProvider>
        <View style={styles.flex}>
          <View style={styles.mapArea}>
            <NearbyMapView
              pinMode={sheetTab}
              genre={genre}
              markers={mapMarkers}
              likedPlaceIds={likedPlaceIds}
              selectedSpot={selectedSpot}
              userLocation={location}
              onSelectSpot={setSelectedSpot}
              onClearSelection={() => setSelectedSpot(null)}
              onOpenDetail={(s) => void handleOpenDetail(s)}
              onSortChange={handleTabChange}
              onGenreChange={handleGenreChange}
              listMode={sheetIndex >= 1}
              onShowMap={() => sheetControl.current?.collapse()}
              sheetAnimatedIndex={sheetAnimatedIndex}
              bottomInset={sheetBottomInset}
              topInset={topSafe}
            />

            {sheetIndex < 1 ? (
              <MapAppMenu topOffset={topSafe} tempC={weather?.tempC ?? null} />
            ) : null}

            {locationPermissionDenied ? (
              <View style={[styles.permissionBanner, { top: mapTopControls + 48 }]}>
                <Text style={styles.permissionBannerTxt}>現在地を表示するには位置情報の許可が必要です。</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={() => void Linking.openSettings()}>
                  <Text style={styles.permissionBtnTxt}>設定を開く</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {locationError ? (
              <Text style={[styles.errOverlay, { top: mapTopControls + 48 }]}>{locationError}</Text>
            ) : null}
            {spotsFetchError ? (
              <Text style={[styles.errOverlay, { top: mapTopControls + 48 }]}>{spotsFetchError}</Text>
            ) : null}

            {spotsLoading && sheetTab === 'score' ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <RunningDog label="近くのスポットを探し中..." />
              </View>
            ) : null}
          </View>

          <NearbyBottomSheet
            ref={sheetControl}
            animatedIndex={sheetAnimatedIndex}
            tab={sheetTab}
            items={sheetItems}
            userLocation={location}
            loading={(spotsLoading && sheetTab === 'score') || (userListsLoading && sheetTab !== 'score')}
            emptyTitle={emptyCopy.title}
            emptyHint={emptyCopy.hint}
            onDiscover={() => router.push('/(tabs)/search')}
            onPressSpot={(s) => void handleOpenDetail(s)}
            likedPlaceIds={likedPlaceIds}
            onToggleLike={(s) => void handleToggleLike(s)}
            onSheetPositionChange={setSheetBottomInset}
            onSheetIndexChange={setSheetIndex}
          />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f7f6f3' },
  mapArea: { flex: 1 },
  permissionBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 16,
    gap: 12,
    zIndex: 11,
  },
  permissionBannerTxt: { fontSize: 14, color: '#2b2a28', lineHeight: 22 },
  permissionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#2b2a28',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  permissionBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
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
