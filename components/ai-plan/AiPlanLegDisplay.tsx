import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'
import { formatDistance } from '@/lib/ai-plan/formatters'
import type { AiPlanLeg, AiPlanTravelMode } from '@/components/ai-plan/types'

export function AiPlanLegDisplay({
  leg,
  mode,
}: {
  leg: AiPlanLeg | null
  mode: AiPlanTravelMode
}) {
  const walking = mode !== 'driving'
  const travelLabel = walking ? '徒歩' : '車で'

  if (!leg) {
    return (
      <View style={styles.row}>
        <View style={styles.leftRail}>
          <View style={styles.vline} />
        </View>
        <View style={styles.badgeRow}>
          <Text style={styles.muted}>移動ルートを確認中...</Text>
        </View>
      </View>
    )
  }

  const durationMin = Math.max(1, Math.ceil(leg.duration_seconds / 60))
  const dist = formatDistance(leg.distance_meters)

  return (
    <View style={styles.row}>
      <View style={styles.leftRail}>
        <View style={styles.vline} />
      </View>
      <View style={styles.badgeRow}>
        <View style={styles.pill}>
          <Ionicons name={walking ? 'walk' : 'car'} size={12} color={TOKENS.text.primary} />
          <Text style={styles.pillMain}>
            {travelLabel}
            {durationMin}分
          </Text>
          <Text style={styles.pillSub}> · {dist}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: -2,
  },
  leftRail: {
    position: 'relative',
    flexShrink: 0,
    width: 32,
    alignItems: 'center',
  },
  vline: {
    position: 'absolute',
    left: 15,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: TOKENS.border.default,
  },
  badgeRow: {
    flex: 1,
    alignSelf: 'flex-start',
    paddingBottom: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: TOKENS.brand.yellowLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  pillMain: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.text.primary,
  },
  pillSub: {
    fontSize: 12,
    color: TOKENS.text.tertiary,
  },
  muted: {
    fontSize: 12,
    color: TOKENS.text.tertiary,
    fontWeight: '600',
  },
})
