import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  Linking,
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
import { AppHeader } from '@/components/AppHeader'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
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
import { setAnalyticsLocation } from '@/lib/analytics-context'
import { logUserEvent } from '@/lib/user-events'
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
import { sortPlacesByScore, type WalkSituation } from '@/lib/nearby/place-score'
import { sheetSpotFromPlace, sheetSpotFromUserRow, type SheetSpot } from '@/lib/nearby/sheet-spot'
import { dedupeSameSpots } from '@/lib/nearby/spread-overlapping'
import { fetchLikedSpotsForUser } from '@/lib/fetch-user-spot-lists'
import { ensureSpotId } from '@/lib/ensureSpot'
import { openSpotDetail } from '@/lib/open-spot-detail'
import { supabase } from '@/lib/supabase'
import { wanspotFetch } from '@/lib/wanspot-api'
import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import { useWeather } from '@/lib/weather/use-weather'
import { useDogProfile } from '@/components/dog/useDogProfile'
import type { PlaceResult } from '@/types/places'

const FILTER_BAR_H = 52
const SEARCH_BAR_H = 56

/** 検索窓の予測候補（Google Places Autocomplete。地名・駅・施設） */
type PlacePrediction = { place_id: string; main_text: string; secondary_text: string }

/** 確定した検索地点。この地点を中心に周辺スポットを取得・表示する */
type SearchAnchor = { lat: number; lng: number; label: string }

function NearbyPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  // 共通 AppHeader がセーフエリアを受け持つため、地図内は純粋な余白だけでよい。
  const topSafe = 8
  const searchBarTop = topSafe
  const filterBarTop = searchBarTop + SEARCH_BAR_H
  const overlayTop = filterBarTop + FILTER_BAR_H

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)
  const weather = useWeather(location)
  const { dog } = useDogProfile()
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
  /** いいね処理中のスポット。連打による二重 INSERT を防ぐ */
  const likeInFlightRef = useRef<Set<string>>(new Set())

  /** 地図検索窓（Googleマップ型）: 地名・駅・施設名を予測 → 確定地点の周辺スポットを全表示 */
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [resolving, setResolving] = useState(false)
  const [searchAnchor, setSearchAnchor] = useState<SearchAnchor | null>(null)

  // 入力に追従して予測候補を取得（350msデバウンス・2文字以上）
  useEffect(() => {
    const trimmed = query.trim()
    if (!searchFocused || trimmed.length < 2) {
      setPredictions([])
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const bias = location ? `&lat=${location.lat}&lng=${location.lng}` : ''
          const res = await wanspotFetch(
            `/api/places/autocomplete?q=${encodeURIComponent(trimmed)}${bias}`,
            { auth: false }
          )
          const json = (await res.json()) as { predictions?: PlacePrediction[] }
          setPredictions(json.predictions ?? [])
        } catch {
          setPredictions([])
        }
      })()
    }, 350)
    return () => clearTimeout(t)
  }, [query, searchFocused, location?.lat, location?.lng])

  const clearSearch = useCallback(() => {
    setQuery('')
    setPredictions([])
    setSearchAnchor(null) // 地点を外したら現在地表示に戻る
    setSelectedSpot(null)
    Keyboard.dismiss()
  }, [])

  /** 予測候補を確定 → 座標解決してその地点を検索アンカーにする */
  const selectPrediction = useCallback(async (p: PlacePrediction) => {
    Keyboard.dismiss()
    setSearchFocused(false)
    setPredictions([])
    setQuery(p.main_text)
    setResolving(true)
    try {
      const res = await wanspotFetch(`/api/places/resolve?place_id=${encodeURIComponent(p.place_id)}`, {
        auth: false,
      })
      if (!res.ok) return
      const json = (await res.json()) as { lat?: number; lng?: number; name?: string }
      if (typeof json.lat === 'number' && typeof json.lng === 'number') {
        setSelectedSpot(null)
        setSearchAnchor({ lat: json.lat, lng: json.lng, label: p.main_text })
        // どのエリアに関心があるか（おでかけ先の需要分析）
        logUserEvent({ eventType: 'area_search', props: { label: p.main_text, lat: json.lat, lng: json.lng } })
      }
    } catch {
      /* 解決失敗時は現状維持（現在地表示のまま） */
    } finally {
      setResolving(false)
    }
  }, [])

  const searchActive = searchAnchor !== null

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

  const handleSelectGenre = useCallback((next: MapGenreKey | null) => {
    // 検索地点を選んでいる間もアンカーは維持する（ジャンル絞り込みで現在地に戻さない）
    setGenre(next)
    setSelectedSpot(null)
  }, [])

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
    // 分析文脈へ供給（許可済みの位置のみ。以降のイベントに自動で添えられる）
    setAnalyticsLocation(result.location)
    if (result.changed) setLocation(result.location)
    return true
  }, [location])

  useFocusEffect(
    useCallback(() => {
      void refreshLocation()
    }, [refreshLocation])
  )

  // 地図の初回表示を記録（現在地周辺のブラウズ行動。位置が取れていれば一緒に残る）
  const mapViewLoggedRef = useRef(false)
  useEffect(() => {
    if (!location || mapViewLoggedRef.current) return
    mapViewLoggedRef.current = true
    logUserEvent({ eventType: 'map_view' })
  }, [location?.lat, location?.lng])

  const loadNearbySpots = useCallback(
    async (force = false) => {
      // 検索地点があればそこを中心に、なければ現在地を中心に取得する
      const center = searchAnchor ?? location
      if (!center || !prefsReady) return

      const genreKey = genre ?? NEARBY_GENRE_ALL
      const cacheKey = `nearby:spots:${genreKey}:${geoBucket(center.lat, center.lng)}:exp`
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
          ? await fetchAllNearbySpotsWithExpansion(center)
          : await fetchNearbySpotsForGenreWithExpansion(center, genre)
      writeCache(cacheKey, { spots, error: error ?? '' })
      setNearbyPlaces(spots)
      setSpotsFetchError(error ?? '')
      setSpotsLoading(false)
    },
    [location?.lat, location?.lng, searchAnchor?.lat, searchAnchor?.lng, genre, prefsReady]
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
        void syncWalkAdviceMorningNotification(null, { location, walkHour, dogBreed: dog?.breed ?? null })
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

  /**
   * 並び順に効かせる状況。雨の日に屋外を、大型犬にサイズ制限のある店を
   * 上位に出さないためのもの。天気も犬情報も取れなければ距離と確実性だけで並ぶ。
   */
  const situation = useMemo<WalkSituation>(
    () => ({
      rainy: weather.data?.condition === 'rain' || weather.data?.condition === 'snow' || weather.data?.condition === 'thunder',
      dogSize: dog?.size ?? null,
    }),
    [weather.data?.condition, dog?.size]
  )

  const items = useMemo(() => {
    const center = searchAnchor ?? location
    const scored = sortPlacesByScore(nearbyPlaces, center, situation).map(sheetSpotFromPlace)
    // 現在地×全ジャンル表示のときだけ、取得半径の外にあるいいねスポットも棚に合流させる
    let base = scored
    if (!searchAnchor && genre === null && likedRows.length > 0) {
      const seen = new Set(scored.map((s) => s.placeId).filter(Boolean))
      base = [...scored, ...likedRows.filter((s) => s.placeId && !seen.has(s.placeId))]
    }
    // 同一施設が別スポットとして二重登録されているケースを1件に畳む
    return applyMapConditions(dedupeSameSpots(base), conditions, (s) => likedPlaceIds.has(s.placeId))
  }, [searchAnchor, nearbyPlaces, location, genre, likedRows, conditions, likedPlaceIds, situation])

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
      // 連打すると再レンダー前の同じ状態から2回とも「いいね追加」と判定され、二重 INSERT になる
      if (likeInFlightRef.current.has(spot.placeId)) return
      likeInFlightRef.current.add(spot.placeId)
      const next = !likedPlaceIds.has(spot.placeId)
      setLikedOverrides((prev) => ({ ...prev, [spot.placeId]: next }))
      /** 保存に失敗したらハートの見た目を元に戻す（赤いのに未保存、を防ぐ） */
      const rollback = () => {
        setLikedOverrides((prev) => ({ ...prev, [spot.placeId]: !next }))
      }
      try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        rollback()
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
      if (!spotId) {
        rollback()
        return
      }
      const { error } = next
        ? await supabase.from('spot_likes').insert({ user_id: user.id, spot_id: spotId })
        : await supabase.from('spot_likes').delete().eq('user_id', user.id).eq('spot_id', spotId)
      if (error) {
        rollback()
        return
      }
      invalidateCachePrefix('nearby:user-lists:')
      void loadUserLists(true)
      } catch {
        rollback()
      } finally {
        likeInFlightRef.current.delete(spot.placeId)
      }
    },
    [likedPlaceIds, router, loadUserLists]
  )

  const conditionCount = activeConditionCount(conditions)
  const carouselBottom = TAB_BAR_HEIGHT + insets.bottom + 12
  const showEmpty =
    !spotsLoading && !resolving && items.length === 0 && (searchActive || !!location)

  const emptyCopy = searchActive
    ? conditionCount > 0
      ? {
          title: '条件に合うスポットがこの周辺にありませんでした',
          hint: '店内OK・テラスOKは確認済みのお店だけを表示しています。',
          action: '条件をすべて解除',
        }
      : {
          title: 'この周辺のスポットが見つかりませんでした',
          hint: '少し広いエリア名や近くの駅名で試してみてください。',
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
        <AppHeader />
        <View style={styles.mapContent}>
          <View style={styles.mapArea}>
          <NearbyMapView
            markers={items}
            selectedSpot={selectedSpot}
            focusCenter={searchAnchor}
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

          {spotsLoading || resolving ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <RunningDog label={resolving ? '場所を探しています...' : '周辺のスポットを探し中...'} />
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
                onSubmitEditing={() => {
                  if (predictions[0]) void selectPrediction(predictions[0])
                }}
                placeholder="現在地以外の場所・駅・スポット名で検索"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 || searchActive ? (
                <TouchableOpacity onPress={clearSearch} hitSlop={8} accessibilityLabel="検索をクリア">
                  <Ionicons name="close-circle" size={18} color={colors.textHint} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* ジャンル・条件バーは検索地点選択中も表示（アンカーを維持したまま絞り込める） */}
          <MapFilterBar
            genre={genre}
            conditions={conditions}
            onSelectGenre={handleSelectGenre}
            onToggleCondition={handleToggleCondition}
            topInset={filterBarTop}
          />

          {searchActive ? (
            <View style={[styles.resultBar, { top: overlayTop + 4 }]}>
              <Text style={styles.resultBarTxt} numberOfLines={1}>
                {searchAnchor!.label} 周辺のスポット {items.length}件
              </Text>
              <TouchableOpacity onPress={clearSearch} hitSlop={8} accessibilityLabel="検索地点を解除して現在地に戻る">
                <Text style={styles.resultBarClose}>現在地に戻る</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* 予測候補ドロップダウン（Googleマップ型: 地名・駅・施設） */}
          {searchFocused && predictions.length > 0 ? (
            <View style={[styles.predList, { top: filterBarTop + 4 }]}>
              {predictions.map((pItem) => (
                <TouchableOpacity
                  key={pItem.place_id}
                  style={styles.predRow}
                  onPress={() => void selectPrediction(pItem)}
                >
                  <Ionicons name="location-outline" size={17} color={colors.textSecondary} />
                  <View style={styles.predTextCol}>
                    <Text style={styles.predMain} numberOfLines={1}>
                      {pItem.main_text}
                    </Text>
                    {pItem.secondary_text ? (
                      <Text style={styles.predSub} numberOfLines={1}>
                        {pItem.secondary_text}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
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
      </View>
    </GestureHandlerRootView>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  mapContent: { flex: 1, position: 'relative' },
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
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    zIndex: 11,
  },
  permissionBannerTxt: { ...type.body, color: colors.textPrimary },
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
  permissionBtnTxt: { ...type.button, color: colors.textInverse },
  permissionBtnGhostTxt: { ...type.button, color: colors.textPrimary },
  errOverlay: {
    ...type.caption,
    position: 'absolute',
    left: 16,
    right: 16,
    textAlign: 'center',
    color: colors.error,
    backgroundColor: colors.errorMutedBg,
    padding: 8,
    borderRadius: 8,
    zIndex: 11,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    zIndex: 7,
  },
  emptyCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
    zIndex: 9,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  searchBarWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 5,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // 自分で打つ検索文字。入れ物は height 48 固定なので 17 でも収まる
  searchInput: { flex: 1, ...type.row, color: colors.textPrimary, paddingVertical: 0 },
  resultBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // 左は今どこを見ているかの表示、右は押せる出口。同じ太さで並べると出口が埋もれる
  resultBarTxt: { ...type.caption, flex: 1, color: colors.textPrimary },
  resultBarClose: { ...type.button, color: colors.pillText },
  predList: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    zIndex: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  predRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  predTextCol: { flex: 1 },
  predMain: { ...type.row, color: colors.textPrimary },
  predSub: { ...type.caption, color: colors.textSecondary, marginTop: 1 },
  emptyTitle: { ...type.row, fontWeight: '700' as const, color: colors.textPrimary },
  emptyHint: { ...type.caption, color: colors.textSecondary },
  emptyActionBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.tintStrong,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  emptyActionTxt: { ...type.button, color: colors.pillText },
})

export default function NearbyPageScreen() {
  return (
    <ScreenErrorBoundary label="map">
      <NearbyPage />
    </ScreenErrorBoundary>
  )
}
