import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'

export type WanspotEventRow = {
  id: string
  title: string
  description: string | null
  event_at: string | null
  location_name: string | null
  area: string | null
  price: number | null
  capacity: number | null
  current_count: number | null
  thumbnail_url: string | null
}

type Props = {
  event: WanspotEventRow
  onPress: () => void
}

export function EventCard({ event, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {event.thumbnail_url ? (
        <Image source={{ uri: event.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.ph]} />
      )}
      <View style={styles.body}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.when}>
          {event.event_at ? new Date(event.event_at).toLocaleString('ja-JP') : '日時未定'}
        </Text>
        <Text style={styles.loc} numberOfLines={1}>
          {[event.area, event.location_name].filter(Boolean).join(' · ')}
        </Text>
        {event.price != null && event.price > 0 ? (
          <Text style={styles.price}>¥{event.price.toLocaleString('ja-JP')}</Text>
        ) : (
          <Text style={styles.free}>無料</Text>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 100, minHeight: 100 },
  ph: { backgroundColor: colors.cardBg },
  body: { flex: 1, padding: 12 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  when: { fontSize: 12, color: colors.textLight, marginTop: 6 },
  loc: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  price: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 8 },
  free: { fontSize: 13, fontWeight: '700', color: colors.textLight, marginTop: 8 },
})
