import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'

/** 擬似進行用。合計 15 秒（最終「仕上げ中」は API 完了まで） */
export const AI_PLAN_PHASES = [
  { id: 'search' as const, label: 'スポット候補を検索', duration: 3000 },
  { id: 'route' as const, label: 'ルートを組み立て中', duration: 4000 },
  { id: 'time' as const, label: '移動時間を計算中', duration: 4000 },
  { id: 'finish' as const, label: '仕上げ中', duration: 4000 },
] as const

export type AiPlanProgressPhase = (typeof AI_PLAN_PHASES)[number]
export type AiPlanProgressPhaseId = AiPlanProgressPhase['id']

function DotPulse() {
  const op = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.35, duration: 450, useNativeDriver: true }),
      ])
    )
    a.start()
    return () => a.stop()
  }, [op])
  return (
    <Animated.View style={[styles.innerDot, { opacity: op }]} />
  )
}

export function AiPlanProgressSteps({
  currentPhaseId,
  completedPhaseIds,
}: {
  currentPhaseId: AiPlanProgressPhaseId
  completedPhaseIds: readonly AiPlanProgressPhaseId[]
}) {
  return (
    <View style={styles.wrap}>
      {AI_PLAN_PHASES.map((s) => {
        const done = completedPhaseIds.includes(s.id)
        const active = s.id === currentPhaseId

        return (
          <View key={s.id} style={styles.stepRow}>
            <View style={styles.circleWrap}>
              {done ? (
                <View style={styles.circleDone}>
                  <Text style={styles.check}>✓</Text>
                </View>
              ) : active ? (
                <View style={styles.circleActive}>
                  <DotPulse />
                </View>
              ) : (
                <View style={styles.circlePending} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                done || active ? styles.labelOn : styles.labelOff,
              ]}
            >
              {s.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '80%',
    alignSelf: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  circleWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TOKENS.brand.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    fontSize: 11,
    fontWeight: '800',
    color: TOKENS.text.primary,
  },
  circleActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: TOKENS.brand.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surface.primary,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TOKENS.brand.yellow,
  },
  circlePending: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: TOKENS.border.default,
    backgroundColor: TOKENS.surface.primary,
  },
  label: {
    flex: 1,
    fontSize: 13,
  },
  labelOn: {
    fontWeight: '600',
    color: TOKENS.text.primary,
  },
  labelOff: {
    fontWeight: '400',
    opacity: 0.5,
    color: TOKENS.text.tertiary,
  },
})
