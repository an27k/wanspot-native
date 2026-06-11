import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TOKENS } from '@/constants/color-tokens'
import type { AiPlanCore, AiPlanLeg, AiPlanMood, AiPlanTravelMode } from '@/components/ai-plan/types'

function MoodBadge({ mood }: { mood: AiPlanMood | undefined }) {
  const active = mood === 'active'
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeTxt}>{active ? 'アクティブ' : 'のんびり'}</Text>
    </View>
  )
}

function TravelModeBadge({ mode }: { mode: AiPlanTravelMode | undefined }) {
  const walking = mode !== 'driving'
  return (
    <View style={styles.badge}>
      <Ionicons name={walking ? 'walk' : 'car'} size={11} color={TOKENS.brand.pillText} />
      <Text style={styles.badgeTxt}>{walking ? '徒歩' : '車'}</Text>
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
        <View style={styles.hoursPill}>
          <Ionicons name="time-outline" size={12} color={TOKENS.text.secondary} />
          <Text style={styles.hours}>約{totalHours}時間</Text>
        </View>
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
    borderRadius: 18,
    padding: 16,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  badgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
    backgroundColor: TOKENS.brand.tintWeak,
  },
  badgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.brand.pillText,
  },
  hoursPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hours: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.text.secondary,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.text.primary,
    marginBottom: 6,
    lineHeight: 25,
  },
  summary: {
    fontSize: 13,
    color: TOKENS.text.secondary,
    lineHeight: 19,
  },
})
