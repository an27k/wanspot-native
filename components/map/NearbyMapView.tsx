import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dimensions,
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import ClusteredMapView from 'react-native-map-clustering'
import { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { WANSPOT_GOOGLE_MAP_STYLE } from '@/constants/google-map-style'
import { isGoogleMapsConfigured } from '@/lib/google-maps-config'
import { GenreIcon } from '@/components/nearby/GenreIcon'
import { NearbyGenrePicker } from '@/components/nearby/NearbyGenrePicker'
import { IconAiBadge } from '@/components/common/IconAiBadge'
import { NearbySortPicker } from '@/components/nearby/NearbySortPicker'
import { MAP_GENRE_COLOR, MAP_LIKE_COLOR, MAP_VISITED_CHECK_COLOR, type MapGenreKey } from '@/lib/nearby/constants'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import { NearbySheetSpotCard } from '@/components/nearby/NearbySheetSpotCard'
import { WalkAlertFab } from '@/components/map/MapAppMenu'

const FALLBACK_REGION: Region = {
  latitude: 35.6812,
  longitude: 139.7671,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
}

const POPUP_W = 290
const VEIL_H = Math.round(Dimensions.get('window').height * 0.5)

/** 収納時に下を霞ませる影＋透過グラデーション（SVG・追加依存なし） */
function SheetVeil({ animatedIndex }: { animatedIndex: SharedValue<number> }) {
  // index 0(収納)で最も濃く、上げる(>=1)につれて晴れる
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }))
  return (
    <Animated.View style={[styles.veil, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="sheetVeil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2b2a28" stopOpacity={0} />
            <Stop offset="0.45" stopColor="#3a3936" stopOpacity={0.1} />
            <Stop offset="0.78" stopColor="#f7f6f3" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#f7f6f3" stopOpacity={0.92} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sheetVeil)" />
      </Svg>
    </Animated.View>
  )
}

export type MapPinMode = 'score' | 'like' | 'visited'

function regionForLocation(lat: number, lng: number): Region {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const HeartShape = ({ size = 12, color = MAP_LIKE_COLOR }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

const CheckShape = ({ size = 12, color = MAP_VISITED_CHECK_COLOR }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12.5l4 4 10-10.5"
      stroke={color}
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

/** 現在の並び替えを表すアイコン（ソートボタン表示用） */
function SortGlyph({ mode }: { mode: MapPinMode }) {
  if (mode === 'like') return <HeartShape size={20} />
  if (mode === 'visited') return <CheckShape size={20} color={MAP_VISITED_CHECK_COLOR} />
  return <IconAiBadge size={24} />
}

/** 折りたたんだ地図アイコン（リスト閲覧時に「地図を見る」ボタンで使用） */
const MapFoldIcon = ({ size = 22, color = '#2b2a28' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Path d="M9 4v14" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    <Path d="M15 6v14" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
)

/** 数字バッジ：中心は白、外周はグラデで輪郭をぼかす */
function ClusterBadge({ count, size, gradId }: { count: number; size: number; gradId: string }) {
  const feather = 12
  const total = size + feather * 2
  const cx = total / 2
  const badgeGradId = `${gradId}-badge`
  return (
    <View style={{ width: total, height: total, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={total} height={total} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={badgeGradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="48%" stopColor="#FFFFFF" stopOpacity={0.96} />
            <Stop offset="68%" stopColor="#FFFFFF" stopOpacity={0.72} />
            <Stop offset="84%" stopColor="#FFF5E8" stopOpacity={0.32} />
            <Stop offset="96%" stopColor="#FFE0B8" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#FF8A1F" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={size / 2 + feather - 1} fill={`url(#${badgeGradId})`} />
      </Svg>
      <Text style={styles.clusterTxt}>{count}</Text>
    </View>
  )
}

/** Snapchat ヒートマップ風クラスター：ぼかしたグロー＋ソフトな白丸数字バッジ */
function ClusterBlob({ count, gradId }: { count: number; gradId: string }) {
  const glow = Math.round(54 + Math.min(count, 40) * 1.6)
  const badge = count >= 100 ? 36 : count >= 10 ? 32 : 28
  return (
    <View style={{ width: glow, height: glow, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={glow} height={glow} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF9E2C" stopOpacity={0.55} />
            <Stop offset="40%" stopColor="#FFC06A" stopOpacity={0.3} />
            <Stop offset="100%" stopColor="#FF8A1F" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${gradId})`} />
      </Svg>
      <ClusterBadge count={count} size={badge} gradId={gradId} />
    </View>
  )
}

/** ピン右上のいいね／訪問バッジ */
function PinBadge({ kind }: { kind: 'heart' | 'check' }) {
  return (
    <View style={styles.pinBadge}>
      {kind === 'heart' ? <HeartShape size={11} /> : <CheckShape size={11} />}
    </View>
  )
}

/** Snapchat 風ピン：ジャンル色の塗り丸＋白アイコン＋白い細リング（黒枠なし） */
function PinGlyph({
  mode,
  genre,
  liked,
}: {
  mode: MapPinMode
  genre: MapGenreKey
  liked: boolean
}) {
  const color = MAP_GENRE_COLOR[genre]
  const badge: 'heart' | 'check' | null =
    mode === 'visited' ? 'check' : mode === 'like' || liked ? 'heart' : null
  return (
    <View style={styles.pinOuter}>
      <View style={[styles.pinWrap, { backgroundColor: color }]}>
        <GenreIcon genre={genre} size={17} color="#fff" />
      </View>
      {badge ? <PinBadge kind={badge} /> : null}
    </View>
  )
}

export function NearbyMapView({
  pinMode,
  genre,
  markers,
  likedPlaceIds,
  selectedSpot,
  userLocation,
  onSelectSpot,
  onClearSelection,
  onOpenDetail,
  onSortChange,
  onGenreChange,
  listMode,
  showWalkAlert,
  walkTempC,
  walkWeatherLoading,
  walkNeedsLocation,
  onWalkRequestLocation,
  onShowMap,
  sheetAnimatedIndex,
  bottomInset,
  topInset,
}: {
  pinMode: MapPinMode
  genre: MapGenreKey
  markers: SheetSpot[]
  likedPlaceIds: Set<string>
  selectedSpot: SheetSpot | null
  userLocation: { lat: number; lng: number } | null
  onSelectSpot: (spot: SheetSpot) => void
  onClearSelection: () => void
  onOpenDetail: (spot: SheetSpot) => void
  onSortChange: (mode: MapPinMode) => void
  onGenreChange: (g: MapGenreKey) => void
  listMode: boolean
  /** リスト全開（92%）のときは非表示 */
  showWalkAlert: boolean
  walkTempC: number | null
  walkWeatherLoading?: boolean
  walkNeedsLocation?: boolean
  onWalkRequestLocation?: () => void
  onShowMap: () => void
  sheetAnimatedIndex: SharedValue<number>
  bottomInset: number
  topInset: number
}) {
  const mapRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false)
  const [layout, setLayout] = useState({ width: 0, height: 0 })
  const [pinPoint, setPinPoint] = useState<{ x: number; y: number } | null>(null)
  const [sortPickerOpen, setSortPickerOpen] = useState(false)
  const [genrePickerOpen, setGenrePickerOpen] = useState(false)

  const genreColor = MAP_GENRE_COLOR[genre]

  const initialRegion = useMemo(
    () => (userLocation ? regionForLocation(userLocation.lat, userLocation.lng) : FALLBACK_REGION),
    [userLocation]
  )

  const [region, setRegion] = useState<Region>(initialRegion)

  useEffect(() => {
    setRegion(initialRegion)
  }, [initialRegion.latitude, initialRegion.longitude])

  const mapStyle = useMemo(() => [...WANSPOT_GOOGLE_MAP_STYLE] as any, [])

  useEffect(() => {
    if (mapReady) {
      setMapLoadTimedOut(false)
      return
    }
    const t = setTimeout(() => setMapLoadTimedOut(true), 6000)
    return () => clearTimeout(t)
  }, [mapReady])

  useEffect(() => {
    if (!userLocation) return
    const next = regionForLocation(userLocation.lat, userLocation.lng)
    setRegion(next)
    mapRef.current?.animateToRegion(next, 400)
  }, [userLocation?.lat, userLocation?.lng])

  // 選択ピンの画面座標を求めてポップアップをピン真上に表示する
  const recomputePinPoint = useCallback(async () => {
    if (!selectedSpot || !mapRef.current?.pointForCoordinate) {
      setPinPoint(null)
      return
    }
    try {
      const p = await mapRef.current.pointForCoordinate({
        latitude: selectedSpot.lat,
        longitude: selectedSpot.lng,
      })
      if (p && typeof p.x === 'number' && typeof p.y === 'number') setPinPoint(p)
    } catch {
      setPinPoint(null)
    }
  }, [selectedSpot?.key, selectedSpot?.lat, selectedSpot?.lng])

  useEffect(() => {
    if (!selectedSpot) {
      setPinPoint(null)
      return
    }
    mapRef.current?.animateToRegion(
      {
        latitude: selectedSpot.lat,
        longitude: selectedSpot.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      350
    )
    const t = setTimeout(() => void recomputePinPoint(), 380)
    return () => clearTimeout(t)
  }, [selectedSpot?.key, selectedSpot?.lat, selectedSpot?.lng, recomputePinPoint])

  const handleRecenter = useCallback(() => {
    if (!userLocation) return
    mapRef.current?.animateToRegion(regionForLocation(userLocation.lat, userLocation.lng), 450)
  }, [userLocation])

  const handleMarkerPress = useCallback(
    (spot: SheetSpot) => {
      onSelectSpot(spot)
    },
    [onSelectSpot]
  )

  const onWrapLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setLayout({ width, height })
  }, [])

  const popupAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetAnimatedIndex.value, [0, 0.75, 1], [1, 0, 0], Extrapolation.CLAMP),
  }))

  const showPinPopup = !!selectedSpot && !listMode

  if (!isGoogleMapsConfigured()) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.configBanner, { top: topInset + 8 }]}>
          <Text style={styles.configTitle}>Google Maps API キーが未設定です</Text>
          <Text style={styles.configHint}>
            .env の EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を設定し、Maps SDK for iOS / Android を有効化したうえでネイティブ再ビルドしてください。
          </Text>
        </View>
      </View>
    )
  }

  const popupStyle =
    pinPoint && layout.height > 0
      ? {
          left: clamp(pinPoint.x - POPUP_W / 2, 8, Math.max(8, layout.width - POPUP_W - 8)),
          bottom: clamp(layout.height - pinPoint.y + 14, bottomInset + 8, layout.height - topInset - 80),
          width: POPUP_W,
        }
      : { left: 16, right: 16, bottom: bottomInset + 72 }

  return (
    <View style={styles.wrap} onLayout={onWrapLayout}>
      <ClusteredMapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        initialRegion={initialRegion}
        region={region}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        rotateEnabled={false}
        pitchEnabled={false}
        loadingEnabled
        clusterColor="#FF8A1F"
        clusterTextColor="#2b2a28"
        radius={48}
        maxZoom={18}
        minZoom={1}
        spiralEnabled
        renderCluster={(cluster: any) => {
          const { id, geometry, onPress, properties } = cluster
          const [lng, lat] = geometry.coordinates
          return (
            <Marker
              key={`cluster-${id}`}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={onPress}
              tracksViewChanges={Platform.OS === 'android'}
            >
              <ClusterBlob count={properties.point_count} gradId={`cg-${id}`} />
            </Marker>
          )
        }}
        animationEnabled={Platform.OS === 'ios'}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={() => void recomputePinPoint()}
        onPress={() => onClearSelection()}
      >
        {markers.map((spot) => {
          const liked = likedPlaceIds.has(spot.placeId)
          return (
            <Marker
              // liked / mode をキーに含めてバッジ変化時に iOS でも再描画させる
              key={`${spot.key}-${pinMode}-${liked ? 'l' : ''}`}
              coordinate={{ latitude: spot.lat, longitude: spot.lng }}
              onPress={(e) => {
                e.stopPropagation()
                handleMarkerPress(spot)
              }}
              tracksViewChanges={Platform.OS === 'android'}
            >
              <PinGlyph mode={pinMode} genre={genre} liked={liked} />
            </Marker>
          )
        })}
      </ClusteredMapView>

      <SheetVeil animatedIndex={sheetAnimatedIndex} />

      {mapLoadTimedOut && !mapReady ? (
        <View style={[styles.mapHint, { top: topInset + 56 }]} pointerEvents="none">
          <Text style={styles.mapHintTxt}>
            地図タイルを読み込めません。Maps SDK for iOS の有効化・APIキー制限（bundleId: app.wanspot.native）・ネイティブ再ビルド（pod install 後）をご確認ください。
          </Text>
        </View>
      ) : null}

      {showPinPopup ? (
        <Animated.View
          style={[styles.pinCard, popupStyle, popupAnimStyle]}
          pointerEvents={listMode ? 'none' : 'auto'}
        >
          <NearbySheetSpotCard
            spot={selectedSpot!}
            userLocation={userLocation}
            variant="popup"
            onPress={() => onOpenDetail(selectedSpot!)}
            onClose={onClearSelection}
          />
        </Animated.View>
      ) : null}

      {/* 固定浮遊コントロール（上から：お散歩予報 / ソート / ジャンル / 現在地）。シート上端を追従。 */}
      <View style={[styles.controlStack, { bottom: bottomInset + 16 }]} pointerEvents="box-none">
        {showWalkAlert ? (
          <WalkAlertFab
            tempC={walkTempC}
            loading={walkWeatherLoading}
            needsLocation={walkNeedsLocation}
            onRequestLocation={onWalkRequestLocation}
          />
        ) : null}

        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => setSortPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="並び替え"
        >
          <SortGlyph mode={pinMode} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, { backgroundColor: genreColor, borderColor: genreColor }]}
          onPress={() => setGenrePickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="ジャンルを変更"
        >
          <GenreIcon genre={genre} size={20} color="#fff" />
        </TouchableOpacity>

        {listMode ? (
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={onShowMap}
            accessibilityRole="button"
            accessibilityLabel="地図を見る"
          >
            <MapFoldIcon size={22} color="#2b2a28" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={handleRecenter}
            disabled={!userLocation}
            accessibilityRole="button"
            accessibilityLabel="現在地に戻る"
          >
            <Ionicons name="locate" size={22} color={userLocation ? '#2b2a28' : '#aaa'} />
          </TouchableOpacity>
        )}
      </View>

      <NearbySortPicker
        visible={sortPickerOpen}
        value={pinMode}
        onSelect={(k) => onSortChange(k)}
        onClose={() => setSortPickerOpen(false)}
      />
      <NearbyGenrePicker
        visible={genrePickerOpen}
        genre={genre}
        onSelect={onGenreChange}
        onClose={() => setGenrePickerOpen(false)}
        topOffset={topInset + 60}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  pinOuter: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pinWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  clusterTxt: {
    fontSize: 14,
    fontWeight: '900',
    color: '#E5740A',
  },
  controlStack: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 8,
  },
  ctrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebebeb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  veil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: VEIL_H,
    zIndex: 5,
  },
  pinCard: {
    position: 'absolute',
    zIndex: 8,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  configBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 16,
    gap: 8,
  },
  configTitle: { fontSize: 14, fontWeight: '700', color: '#2b2a28' },
  configHint: { fontSize: 12, color: '#888', lineHeight: 18 },
  mapHint: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ebebeb',
    zIndex: 6,
  },
  mapHintTxt: { fontSize: 11, color: '#888', lineHeight: 16, textAlign: 'center' },
})
