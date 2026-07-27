import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
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
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { WANSPOT_GOOGLE_MAP_STYLE } from '@/constants/google-map-style'
import { isGoogleMapsConfigured } from '@/lib/google-maps-config'
import { inferSpotGenre } from '@/lib/nearby/map-filter'
import { MAP_GENRE_COLOR } from '@/lib/nearby/constants'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'

const FALLBACK_REGION: Region = {
  latitude: 35.6812,
  longitude: 139.7671,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
}

function regionForLocation(lat: number, lng: number): Region {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  }
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

/**
 * ノーマルピン（ティアドロップ型）。選択中はブランド色＋拡大し、ポップのマウントアニメを付ける。
 * 非選択ピンは tracksViewChanges を切って静止画として描画する（パフォーマンス優先）。
 */
function NormalMapPin({ genreColor, selected }: { genreColor: string; selected: boolean }) {
  const scale = useRef(new Animated.Value(selected ? 0.6 : 1)).current

  useEffect(() => {
    if (!selected) return
    scale.setValue(0.6)
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start()
  }, [selected, scale])

  const size = selected ? 40 : 26
  return (
    <Animated.View
      style={[
        styles.pinWrap,
        { width: size + 8, height: size + 8 },
        selected && { transform: [{ scale }] },
      ]}
    >
      <Ionicons
        name="location-sharp"
        size={size}
        color={selected ? colors.brandDark : genreColor}
        style={styles.pinIcon}
      />
    </Animated.View>
  )
}

export function NearbyMapView({
  markers,
  selectedSpot,
  userLocation,
  onSelectSpot,
  onClearSelection,
  topInset,
  bottomInset = 0,
}: {
  markers: SheetSpot[]
  selectedSpot: SheetSpot | null
  userLocation: { lat: number; lng: number } | null
  onSelectSpot: (spot: SheetSpot) => void
  onClearSelection: () => void
  topInset: number
  /** 下部カルーセルの高さぶん。現在地ボタンの位置に使う */
  bottomInset?: number
}) {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false)

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

  // カルーセルのスワイプ／ピンタップに追従して、選択スポットへ滑らかに寄せる
  useEffect(() => {
    if (!selectedSpot) return
    mapRef.current?.animateToRegion(
      {
        latitude: selectedSpot.lat,
        longitude: selectedSpot.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      350
    )
  }, [selectedSpot?.key, selectedSpot?.lat, selectedSpot?.lng])

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

  const recenterBottom = Math.max(TAB_BAR_HEIGHT + insets.bottom + 16, bottomInset + 16)

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

  return (
    <View style={styles.wrap}>
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
        onPress={() => onClearSelection()}
      >
        {markers.map((spot) => {
          const selected = selectedSpot?.key === spot.key
          const genreColor = MAP_GENRE_COLOR[inferSpotGenre(spot)]
          return (
            <Marker
              key={`${spot.key}-${selected ? 's' : ''}`}
              coordinate={{ latitude: spot.lat, longitude: spot.lng }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={(e) => {
                e.stopPropagation()
                handleMarkerPress(spot)
              }}
              zIndex={selected ? 10 : 1}
              // 選択中だけ描画追跡を有効にしてポップアニメを見せる。非選択は静止画でパフォーマンス優先
              tracksViewChanges={Platform.OS === 'android' || selected}
            >
              <NormalMapPin genreColor={genreColor} selected={selected} />
            </Marker>
          )
        })}
      </ClusteredMapView>

      {mapLoadTimedOut && !mapReady ? (
        <View style={[styles.mapHint, { top: topInset + 56 }]} pointerEvents="none">
          <Text style={styles.mapHintTxt}>
            地図タイルを読み込めません。Maps SDK for iOS の有効化・APIキー制限（bundleId: app.wanspot.native）・ネイティブ再ビルド（pod install 後）をご確認ください。
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.recenterBtn, { bottom: recenterBottom }]}
        onPress={handleRecenter}
        disabled={!userLocation}
        accessibilityRole="button"
        accessibilityLabel="現在地に戻る"
      >
        <Ionicons name="navigate" size={22} color={userLocation ? colors.textPrimary : '#aaa'} />
      </TouchableOpacity>
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
  pinWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinIcon: {
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
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
