import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'
import { getCategoryBgColor, getCategoryLabel } from '@/lib/ai-plan/category-labels'
import type { AiPlanStop } from '@/components/ai-plan/types'

export function AiPlanSpotCard({
  stop,
  onPress,
}: {
  stop: AiPlanStop
  onPress: () => void
}) {
  const categoryLabel = getCategoryLabel(stop)
  const categoryBgColor = getCategoryBgColor(stop)
  const dwellMinutes = stop.dwell_minutes ?? 0
  const note = stop.note?.trim() ?? ''

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.imgArea, { backgroundColor: categoryBgColor }]}>
        {stop.photo_url ? (
          <Image source={{ uri: stop.photo_url }} style={styles.img} resizeMode="cover" />
        ) : null}
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeTxt}>{categoryLabel}</Text>
        </View>
        <View style={styles.dwellBadge}>
          <Text style={styles.dwellBadgeTxt}>{dwellMinutes}分滞在</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {stop.name ?? 'スポット'}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={4}>
            {note}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imgArea: {
    height: 80,
    position: 'relative',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  catBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  catBadgeTxt: {
    fontSize: 9,
    fontWeight: '700',
    color: TOKENS.text.primary,
  },
  dwellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: TOKENS.brand.yellow,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dwellBadgeTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: TOKENS.text.primary,
  },
  body: {
    padding: 10,
    paddingHorizontal: 11,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 3,
  },
  note: {
    fontSize: 9,
    color: TOKENS.text.secondary,
    lineHeight: 13,
  },
})
