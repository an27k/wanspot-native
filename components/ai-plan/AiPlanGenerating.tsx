import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { LoadingDogSvg } from '@/components/common/LoadingDog'
import {
  AI_PLAN_PHASES,
  AiPlanProgressSteps,
  type AiPlanProgressPhaseId,
} from '@/components/ai-plan/AiPlanProgressSteps'
import { TOKENS } from '@/constants/color-tokens'
import { formatAiPlanDogDisplayName } from '@/lib/ai-plan/formatters'

const MIN_MS_BEFORE_RESULT = AI_PLAN_PHASES.slice(0, -1).reduce((s, p) => s + p.duration, 0)

export function AiPlanGenerating({
  dogName,
  apiPlanReady,
  onReadyForResult,
}: {
  dogName: string
  apiPlanReady: boolean
  onReadyForResult: () => void
}) {
  const spin = useRef(new Animated.Value(0)).current
  const startTimeRef = useRef(Date.now())
  const onResultRef = useRef(onReadyForResult)
  onResultRef.current = onReadyForResult

  const [currentPhaseId, setCurrentPhaseId] = useState<AiPlanProgressPhaseId>('search')
  const [completedPhaseIds, setCompletedPhaseIds] = useState<AiPlanProgressPhaseId[]>([])

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [spin])

  // 擬似進行（API の phase イベントは使わない）
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let cumulative = 0
    for (const phase of AI_PLAN_PHASES) {
      const tStart = setTimeout(() => {
        setCurrentPhaseId(phase.id)
      }, cumulative)
      timers.push(tStart)
      cumulative += phase.duration

      if (phase.id !== 'finish') {
        const tDone = setTimeout(() => {
          setCompletedPhaseIds((prev) => (prev.includes(phase.id) ? prev : [...prev, phase.id]))
        }, cumulative)
        timers.push(tDone)
      }
    }
    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [])

  // API 完了後: 最低 11 秒経過してから結果へ
  useEffect(() => {
    if (!apiPlanReady) return
    const elapsed = Date.now() - startTimeRef.current
    const remainingWait = Math.max(0, MIN_MS_BEFORE_RESULT - elapsed)
    const t = setTimeout(() => {
      setCompletedPhaseIds((prev) => (prev.includes('finish') ? prev : [...prev, 'finish']))
      onResultRef.current()
    }, remainingWait)
    return () => clearTimeout(t)
  }, [apiPlanReady])

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const displayName = formatAiPlanDogDisplayName(dogName)

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.ringOuter} />
        <Animated.View style={[styles.ringInner, { transform: [{ rotate }] }]} />
        <View style={styles.dogMark}>
          <LoadingDogSvg />
        </View>
      </View>

      <Text style={styles.title}>{displayName}のプランを作成中</Text>
      <Text style={styles.sub}>だいたい15秒で完成します</Text>

      <AiPlanProgressSteps
        currentPhaseId={currentPhaseId}
        completedPhaseIds={completedPhaseIds}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: TOKENS.surface.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  hero: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: TOKENS.brand.yellow,
    borderRightColor: 'transparent',
    borderRadius: 60,
    opacity: 0.3,
  },
  ringInner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 3,
    borderColor: TOKENS.brand.yellow,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRadius: 50,
  },
  dogMark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: TOKENS.text.tertiary,
    marginBottom: 24,
    textAlign: 'center',
  },
})
