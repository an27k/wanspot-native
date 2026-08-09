import { useEffect, useMemo } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import SpotDetailScreen from '@/components/spot-detail/SpotDetailScreen'
import type { AppColors } from '@/constants/colors'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { track } from '@/lib/analytics'
import { isPendingPlaceRouteId, pendingPlaceFromParams } from '@/lib/spot-detail-pending'

export default function SpotDetailRoute() {
  const styles = useThemedStyles(createStyles)
  const params = useLocalSearchParams()
  const rawId = params.id
  const spotIdRaw = Array.isArray(rawId) ? rawId[0] : rawId
  const spotId = spotIdRaw
    ? (() => {
        try {
          return decodeURIComponent(spotIdRaw)
        } catch {
          return spotIdRaw
        }
      })()
    : undefined
  const pendingPlace = useMemo(
    () => pendingPlaceFromParams(params as Record<string, string | string[] | undefined>),
    [
      params.place_id,
      params.name,
      params.category,
      params.address,
      params.lat,
      params.lng,
      params.photo_ref,
      params.rating,
      params.price_level,
      params.price_label,
      params.user_ratings_total,
    ]
  )

  useEffect(() => {
    if (spotId && !isPendingPlaceRouteId(spotId)) track('spot_viewed', { spot_id: spotId })
  }, [spotId])

  if (!spotId) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.err}>無効なスポットです</Text>
      </View>
    )
  }
  return <SpotDetailScreen spotId={spotId} pendingPlace={pendingPlace} />
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cardBg },
  err: { color: colors.textMuted },
})
