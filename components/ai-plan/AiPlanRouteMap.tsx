import Constants from 'expo-constants'
import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'
import { remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
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

export function AiPlanRouteMap({ stops }: { stops: AiPlanStop[] }) {
  const mapUrl = buildStaticMapUrl(stops)

  return (
    <View style={styles.wrap}>
      {mapUrl ? (
        <Image source={{ uri: mapUrl }} style={styles.img} contentFit="cover" {...remoteImageExpoProps} />
      ) : (
        <View style={styles.ph} />
      )}
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
})
