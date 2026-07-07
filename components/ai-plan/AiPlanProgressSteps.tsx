import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { NARRATION_PHASE_ORDER, type NarrationPhaseId } from '@/lib/ai-plan/narration'
import { TOKENS } from '@/constants/color-tokens'

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
  return <Animated.View style={[styles.innerDot, { opacity: op }]} />
}

export function AiPlanProgressSteps({
  currentStep,
  currentText,
  completedPhaseIds,
}: {
  currentStep: number
  currentText: string
  completedPhaseIds: readonly NarrationPhaseId[]
}) {
  return (
    <View style={styles.wrap}>
      {NARRATION_PHASE_ORDER.map((phaseId, index) => {
        const done = completedPhaseIds.includes(phaseId)
        const active = index === currentStep

        return (
          <View key={phaseId} style={styles.stepRow}>
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
            <Text style={[styles.label, done || active ? styles.labelOn : styles.labelOff]}>
              {active ? currentText : done ? '完了' : '…'}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '90%',
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
    lineHeight: 18,
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
