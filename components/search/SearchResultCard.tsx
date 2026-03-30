import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Polygon } from 'react-native-svg'
import { colors } from '@/constants/colors'
import type { PlaceResult } from '@/types/places'

const IconStarSm = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="#FFD84D" stroke="#FFD84D" strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

type Props = {
  spot: PlaceResult
  photoUri: string | null
  onPress: () => void
}

export function SearchResultCard({ spot, photoUri, onPress }: Props) {
  const showRating = spot.rating != null && spot.rating > 0
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.ph]} />
      )}
      <View style={styles.body}>
        <Text style={styles.name}>{spot.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaCat}>{spot.category}</Text>
          {showRating ? (
            <View style={styles.rateWrap}>
              <IconStarSm />
              <Text style={styles.metaRate}>{spot.rating!.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.addr} numberOfLines={2}>
          {spot.address}
        </Text>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  metaCat: { fontSize: 12, color: colors.textLight },
  rateWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaRate: { fontSize: 12, color: colors.textMuted },
  addr: { fontSize: 12, color: colors.textLight, marginTop: 6 },
})
