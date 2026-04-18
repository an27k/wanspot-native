import Constants from 'expo-constants'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'
import type { AiPlanStop } from '@/components/ai-plan/types'

function getGoogleMapsKey(): string {
  const extra = Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  return (extra?.googleMapsApiKey || fromEnv || '').trim()
}

/** 座標が揃ったストップのみで静的マップ URL を生成 */
export function buildStaticMapUrl(stops: AiPlanStop[]): string {
  const apiKey = getGoogleMapsKey()
  if (!apiKey) return ''

  const withCoords = stops.filter(
    (s) => typeof s.lat === 'number' && typeof s.lng === 'number' && Number.isFinite(s.lat) && Number.isFinite(s.lng)
  ) as (AiPlanStop & { lat: number; lng: number })[]
  if (withCoords.length === 0) return ''

  const markerParts = withCoords.map((s, i) => {
    const m = `color:0xFFD84D|label:${i + 1}|${s.lat},${s.lng}`
    return `markers=${encodeURIComponent(m)}`
  })
  const pathBody = `color:0x2b2a28ff|weight:3|geodesic:true|${withCoords.map((s) => `${s.lat},${s.lng}`).join('|')}`
  const pathParam = `path=${encodeURIComponent(pathBody)}`
  const base = `https://maps.googleapis.com/maps/api/staticmap?size=640x360&scale=2&maptype=roadmap`
  return `${base}&${markerParts.join('&')}&${pathParam}&key=${encodeURIComponent(apiKey)}`
}

export function AiPlanRouteMap({
  stops,
  onExpandMap,
}: {
  stops: AiPlanStop[]
  onExpandMap?: () => void
}) {
  const mapUrl = buildStaticMapUrl(stops)

  return (
    <View style={styles.wrap}>
      {mapUrl ? (
        <Image source={{ uri: mapUrl }} style={styles.img} resizeMode="cover" />
      ) : (
        <View style={styles.ph} />
      )}
      <TouchableOpacity
        onPress={() => {
          if (onExpandMap) onExpandMap()
          // eslint-disable-next-line no-console -- プレースホルダ（後続でインタラクティブマップへ）
          console.log('[AiPlanRouteMap] expand map (placeholder)')
        }}
        style={styles.expandBtn}
        accessibilityRole="button"
        accessibilityLabel="マップを拡大"
      >
        <Text style={styles.expandIcon}>⛶</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    height: 180,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: TOKENS.surface.mapMuted,
  },
  img: { width: '100%', height: 180 },
  ph: { width: '100%', height: 180, backgroundColor: TOKENS.surface.mapMuted },
  expandBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: TOKENS.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TOKENS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  expandIcon: { fontSize: 14, color: TOKENS.text.primary },
})
