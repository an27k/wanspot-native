import { StyleSheet, Text, View } from 'react-native'
import type { AiPlanLeg, AiPlanTravelMode } from '@/components/ai-plan/types'

function fmtMinutes(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60))
  return `${m}分`
}

function fmtDistance(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return ''
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`
  return `${Math.round(m)}m`
}

export function AiPlanLegDisplay({
  leg,
  mode,
}: {
  leg: AiPlanLeg | null
  mode: AiPlanTravelMode
}) {
  const modeLabel = mode === 'driving' ? '車' : '徒歩'
  if (!leg) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.txtMuted}>移動ルートを確認中...</Text>
      </View>
    )
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.txt}>{modeLabel}で約{fmtMinutes(leg.duration_seconds)}</Text>
      <Text style={styles.txtMuted}>（約{fmtDistance(leg.distance_meters)}）</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginBottom: 6,
    alignItems: 'center',
    gap: 2,
  },
  txt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  txtMuted: { fontSize: 11, fontWeight: '700', color: '#888' },
})
