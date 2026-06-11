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
import { colors } from '@/constants/colors'
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
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { WANSPOT_GOOGLE_MAP_STYLE } from '@/constants/google-map-style'
import { isGoogleMapsConfigured } from '@/lib/google-maps-config'
import { inferSpotGenre } from '@/lib/nearby/map-filter'
import type { MapGenreKey } from '@/lib/nearby/constants'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import { NearbySheetSpotCard } from '@/components/nearby/NearbySheetSpotCard'
import { PhotoMapPin } from '@/components/map/PhotoMapPin'

const FALLBACK_REGION: Region = {
  latitude: 35.6812,
  longitude: 139.7671,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
}

const POPUP_W = 290
const VEIL_H = Math.round(Dimensions.get('window').height * 0.5)

function SheetVeil({ animatedIndex }: { animatedIndex: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [-1, 0, 1, 2], [0, 0, 1, 0], Extrapolation.CLAMP),
  }))
  return (
    <Animated.View style={[styles.veil, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="sheetVeil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.textPrimary} stopOpacity={0} />
            <Stop offset="0.45" stopColor="#3a3936" stopOpacity={0.1} />
            <Stop offset="0.78" stopColor={colors.paper} stopOpacity={0.55} />
            <Stop offset="1" stopColor={colors.paper} stopOpacity={0.92} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sheetVeil)" />
      </Svg>
    </Animated.View>
  )
}

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

/** 数字バッジ：透過を強め、数字だけ読めればよい */
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
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.72} />
            <Stop offset="48%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="68%" stopColor="#FFFFFF" stopOpacity={0.32} />
            <Stop offset="84%" stopColor="#FFF5E8" stopOpacity={0.14} />
            <Stop offset="96%" stopColor="#FFE0B8" stopOpacity={0.05} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={size / 2 + feather - 1} fill={`url(#${badgeGradId})`} />
      </Svg>
      <Text style={styles.clusterTxt}>{count}</Text>
    </View>
  )
}

function ClusterBlob({ count, gradId }: { count: number; gradId: string }) {
  const glow = Math.round(54 + Math.min(count, 40) * 1.6)
  const badge = count >= 100 ? 36 : count >= 10 ? 32 : 28
  return (
    <View style={{ width: glow, height: glow, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={glow} height={glow} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF9E2C" stopOpacity={0.28} />
            <Stop offset="40%" stopColor="#FFC06A" stopOpacity={0.14} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${gradId})`} />
      </Svg>
      <ClusterBadge count={count} size={badge} gradId={gradId} />
    </View>
  )
}

export function NearbyMapView({
  markers,
  likedPlaceIds,
  visitedPlaceIds,
  selectedSpot,
  userLocation,
  onSelectSpot,
  onClearSelection,
  onOpenDetail,
  sheetOpen,
  showRecenter,
  sheetAnimatedIndex,
  bottomInset,
  topInset,
  pinGenre,
}: {
  markers: SheetSpot[]
  likedPlaceIds: Set<string>
  visitedPlaceIds: Set<string>
  selectedSpot: SheetSpot | null
  userLocation: { lat: number; lng: number } | null
  onSelectSpot: (spot: SheetSpot) => void
  onClearSelection: () => void
  onOpenDetail: (spot: SheetSpot) => void
  sheetOpen: boolean
  showRecenter: boolean
  sheetAnimatedIndex: SharedValue<number>
  bottomInset: number
  topInset: number
  /** ジャンル絞り込み中はピン色を選択ジャンルに統一 */
  pinGenre?: MapGenreKey
}) {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false)
  const [layout, setLayout] = useState({ width: 0, height: 0 })
  const [pinPoint, setPinPoint] = useState<{ x: number; y: number } | null>(null)

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
    opacity: interpolate(sheetAnimatedIndex.value, [-1, 0, 0.75, 1, 2], [1, 1, 0, 0, 0], Extrapolation.CLAMP),
  }))

  const showPinPopup = !!selectedSpot && !sheetOpen
  const recenterBottom = TAB_BAR_HEIGHT + insets.bottom + 16

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
        clusterColor={colors.primary}
        clusterTextColor={colors.textPrimary}
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
          const visited = visitedPlaceIds.has(spot.placeId)
          const spotPinGenre = pinGenre ?? inferSpotGenre(spot)
          return (
            <Marker
              key={`${spot.key}-${liked ? 'l' : ''}-${visited ? 'v' : ''}`}
              coordinate={{ latitude: spot.lat, longitude: spot.lng }}
              onPress={(e) => {
                e.stopPropagation()
                handleMarkerPress(spot)
              }}
              tracksViewChanges={Platform.OS === 'android'}
            >
              <PhotoMapPin spot={spot} genre={spotPinGenre} liked={liked} visited={visited} />
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
          pointerEvents={sheetOpen ? 'none' : 'auto'}
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

      {showRecenter ? (
        <TouchableOpacity
          style={[styles.recenterBtn, { bottom: recenterBottom }]}
          onPress={handleRecenter}
          disabled={!userLocation}
          accessibilityRole="button"
          accessibilityLabel="現在地に戻る"
        >
          <Ionicons name="navigate" size={22} color={userLocation ? colors.textPrimary : '#aaa'} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  clusterTxt: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.brandDark,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
    zIndex: 8,
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
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  configTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  configHint: { fontSize: 12, color: '#888', lineHeight: 18 },
  mapHint: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 6,
  },
  mapHintTxt: { fontSize: 11, color: '#888', lineHeight: 16, textAlign: 'center' },
})
