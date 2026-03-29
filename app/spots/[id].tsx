import { useEffect } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import SpotDetailScreen from '@/components/spot-detail/SpotDetailScreen'
import { colors } from '@/constants/colors'
import { track } from '@/lib/analytics'

export default function SpotDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const spotId = Array.isArray(id) ? id[0] : id

  useEffect(() => {
    if (spotId) track('spot_viewed', { spot_id: spotId })
  }, [spotId])

  if (!spotId) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.err}>無効なスポットです</Text>
      </View>
    )
  }
  return <SpotDetailScreen spotId={spotId} />
}

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cardBg },
  err: { color: colors.textMuted },
})
