import { StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'
import type { AiPlanCore, AiPlanLeg, AiPlanMood, AiPlanTravelMode } from '@/components/ai-plan/types'

function MoodBadge({ mood }: { mood: AiPlanMood | undefined }) {
  const active = mood === 'active'
  return (
    <View
      style={[
        styles.badge,
        active ? { backgroundColor: TOKENS.brand.yellow } : { backgroundColor: TOKENS.surface.alt },
      ]}
    >
      <Text
        style={[
          styles.badgeTxt,
          active ? { color: TOKENS.text.primary, fontWeight: '800' } : { color: TOKENS.text.secondary, fontWeight: '700' },
        ]}
      >
        {active ? 'アクティブ' : 'のんびり'}
      </Text>
    </View>
  )
}

function TravelModeBadge({ mode }: { mode: AiPlanTravelMode | undefined }) {
  const walking = mode !== 'driving'
  return (
    <View style={[styles.badge, { backgroundColor: TOKENS.surface.alt }]}>
      <Text style={[styles.badgeTxt, { color: TOKENS.text.secondary, fontWeight: '700' }]}>
        {walking ? '徒歩' : '車'}
      </Text>
    </View>
  )
}

function totalPlanHours(plan: AiPlanCore, legs: Record<number, AiPlanLeg>): number {
  let sec = 0
  for (const s of plan.stops) {
    sec += (s.dwell_minutes ?? 0) * 60
  }
  const n = plan.stops.length
  for (let i = 0; i < n - 1; i++) {
    const leg = legs[i]
    if (leg) sec += leg.duration_seconds
  }
  return Math.round(sec / 3600)
}

export function AiPlanSummaryCard({
  plan,
  legs,
  mood,
  travelMode,
}: {
  plan: AiPlanCore
  legs: Record<number, AiPlanLeg>
  mood: AiPlanMood | undefined
  travelMode: AiPlanTravelMode | undefined
}) {
  const totalHours = totalPlanHours(plan, legs)

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.badgeLeft}>
          <MoodBadge mood={mood} />
          <TravelModeBadge mode={travelMode} />
        </View>
        <Text style={styles.hours}>
          約{totalHours}時間
        </Text>
      </View>
      <Text style={styles.title}>{plan.title}</Text>
      <Text style={styles.summary}>{plan.summary}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TOKENS.surface.primary,
    marginTop: -16,
    marginHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    padding: 13,
    paddingHorizontal: 15,
    zIndex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  badgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  badgeTxt: {
    fontSize: 9,
  },
  hours: {
    fontSize: 10,
    color: TOKENS.text.meta,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: TOKENS.text.primary,
    marginBottom: 6,
    lineHeight: 20,
  },
  summary: {
    fontSize: 10,
    color: TOKENS.text.secondary,
    lineHeight: 16,
  },
})
