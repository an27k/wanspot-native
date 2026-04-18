import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'

const STEPS = [
  { phase: 'fetching_candidates', label: 'スポット候補を検索' },
  { phase: 'llm', label: 'ルートを組み立て中' },
  { phase: 'routes_resolving', label: '移動時間を計算中' },
  { phase: 'saving', label: '仕上げ中' },
] as const

const ORDER = STEPS.map((s) => s.phase)

function stepIndexForPhase(phase: string | null): number {
  if (!phase) return 0
  const i = ORDER.indexOf(phase as (typeof ORDER)[number])
  if (i >= 0) return i
  return 0
}

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

export function AiPlanProgressSteps({ phase }: { phase: string | null }) {
  const current = stepIndexForPhase(phase)

  return (
    <View style={styles.wrap}>
      {STEPS.map((s, index) => {
        const done = index < current
        const active = index === current

        return (
          <View key={s.phase} style={styles.stepRow}>
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
    gap: 10,
    marginBottom: 10,
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
    fontSize: 12,
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
