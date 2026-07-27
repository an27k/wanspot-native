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
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { WANSPOT_GOOGLE_MAP_STYLE } from '@/constants/google-map-style'
import { isGoogleMapsConfigured } from '@/lib/google-maps-config'
import { inferSpotGenre } from '@/lib/nearby/map-filter'
import { MAP_GENRE_COLOR } from '@/lib/nearby/constants'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import { spreadOverlappingSpots, type SpreadSpot } from '@/lib/nearby/spread-overlapping'

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

/**
 * スポットマーカー。key を安定させたまま選択状態の見た目を切り替えるため、
 * selected の変化直後だけ tracksViewChanges を有効化して再描画し、すぐ静止画に戻す。
 * （key に選択状態を含める方式は再マウント＝重なったピンのチカつきの原因になる）
 */
function SpotMarker({
  spot,
  selected,
  genreColor,
  stackIndex,
  onPress,
}: {
  spot: SpreadSpot
  selected: boolean
  genreColor: string
  /** 描画順を固定するための安定インデックス（重なり時の z-order 入れ替わり防止） */
  stackIndex: number
  onPress: (spot: SheetSpot) => void
}) {
  const [track, setTrack] = useState(Platform.OS === 'android')

  useEffect(() => {
    if (Platform.OS === 'android') return // Android は常時追跡でも安定している既存挙動を維持
    setTrack(true)
    const t = setTimeout(() => setTrack(false), selected ? 700 : 350) // 選択時はポップアニメ完了まで
    return () => clearTimeout(t)
  }, [selected])

  return (
    <Marker
      // 同一座標のピンは表示用に微小オフセットした座標を使う（重なりによる明滅を防ぐ）
      coordinate={{ latitude: spot.displayLat, longitude: spot.displayLng }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={(e) => {
        e.stopPropagation()
        onPress(spot)
      }}
      // 非選択ピンにも一意で不変の zIndex を与え、描画順の入れ替わりを止める
      zIndex={selected ? 10_000 : stackIndex}
      tracksViewChanges={track}
    >
      <NormalMapPin genreColor={genreColor} selected={selected} />
    </Marker>
  )
}

export function NearbyMapView({
  markers,
  selectedSpot,
  focusCenter = null,
  userLocation,
  onSelectSpot,
  onClearSelection,
  topInset,
  bottomInset = 0,
}: {
  markers: SheetSpot[]
  selectedSpot: SheetSpot | null
  /** 検索で確定した地点。設定されたらそこへ移動し、解除されたら現在地へ戻る */
  focusCenter?: { lat: number; lng: number } | null
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

  // 検索地点の確定/解除に追従（確定→その地点へ・解除→現在地へ）
  const focusInitRef = useRef(false)
  useEffect(() => {
    if (!focusInitRef.current) {
      // 初回マウント時は initialRegion に任せる（null での不要な現在地アニメを避ける）
      focusInitRef.current = true
      if (!focusCenter) return
    }
    if (focusCenter) {
      mapRef.current?.animateToRegion(
        { latitude: focusCenter.lat, longitude: focusCenter.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        450
      )
    } else if (userLocation) {
      mapRef.current?.animateToRegion(regionForLocation(userLocation.lat, userLocation.lng), 450)
    }
  }, [focusCenter?.lat, focusCenter?.lng])

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

  // 同一建物に複数スポットがあるケース（動物病院＋併設ペットホテル等）で座標が完全一致し、
  // マーカーの描画順が入れ替わってチカつくため、表示用座標を微小にずらして重なりを解く
  const displayMarkers = useMemo(() => spreadOverlappingSpots(markers), [markers])

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
      {/* クラスタリング（スポット集約）は廃止 — 全ピンを常に個別表示する */}
      <MapView
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
        onMapReady={() => setMapReady(true)}
        onPress={() => onClearSelection()}
      >
        {displayMarkers.map((spot, index) => (
          <SpotMarker
            key={spot.key}
            spot={spot}
            selected={selectedSpot?.key === spot.key}
            genreColor={MAP_GENRE_COLOR[inferSpotGenre(spot)]}
            stackIndex={index + 1}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

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
