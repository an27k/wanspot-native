import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'
import type { PlaceResult } from '@/types/places'

type Props = {
  spot: PlaceResult
  photoUri: string | null
  onPress: () => void
}

export function SearchResultCard({ spot, photoUri, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.ph]} />
      )}
      <View style={styles.body}>
        <Text style={styles.name}>{spot.name}</Text>
        <Text style={styles.meta}>
          {spot.category}
          {spot.rating != null && spot.rating > 0 ? ` · ★${spot.rating.toFixed(1)}` : ''}
        </Text>
        <Text style={styles.addr} numberOfLines={2}>{spot.address}</Text>
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
  thumb: { width: 96, minHeight: 96 },
  ph: { backgroundColor: colors.cardBg },
  body: { flex: 1, padding: 12 },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  addr: { fontSize: 12, color: colors.textLight, marginTop: 6 },
})
