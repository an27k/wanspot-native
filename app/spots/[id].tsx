import { useEffect, useMemo } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import SpotDetailScreen from '@/components/spot-detail/SpotDetailScreen'
import { colors } from '@/constants/colors'
import { track } from '@/lib/analytics'
import { isPendingPlaceRouteId, pendingPlaceFromParams } from '@/lib/spot-detail-pending'

export default function SpotDetailRoute() {
  const params = useLocalSearchParams()
  const rawId = params.id
  const spotId = Array.isArray(rawId) ? rawId[0] : rawId
  const pendingPlace = useMemo(
    () => pendingPlaceFromParams(params as Record<string, string | string[] | undefined>),
    [params.id, params.place_id, params.name, params.lat, params.lng]
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

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cardBg },
  err: { color: colors.textMuted },
})
