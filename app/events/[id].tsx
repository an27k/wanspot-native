import { useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import EventDetailScreen from '@/components/events/EventDetailScreen'
import { colors } from '@/constants/colors'
import { track } from '@/lib/analytics'
import { featureFlags } from '@/lib/feature-flags'

export default function EventDetailRoute() {
  const router = useRouter()
  useEffect(() => {
    if (!featureFlags.events) {
      router.replace('/(tabs)/')
    }
  }, [router])

  if (!featureFlags.events) return null

  const { id } = useLocalSearchParams<{ id: string }>()
  const eventId = Array.isArray(id) ? id[0] : id
  if (!eventId) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.err}>無効なイベントです</Text>
      </View>
    )
  }
  return (
    <EventDetailScreen
      eventId={eventId}
      onJoinedFree={() => track('event_joined', { event_id: eventId })}
    />
  )
}

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cardBg },
  err: { color: colors.textMuted },
})
