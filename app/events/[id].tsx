import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import EventDetailScreen from '@/components/events/EventDetailScreen'
import { colors } from '@/constants/colors'
import { track } from '@/lib/analytics'

export default function EventDetailRoute() {
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
