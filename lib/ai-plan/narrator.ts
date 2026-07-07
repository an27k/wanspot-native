import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NARRATION_PHASE_ORDER,
  resolveNarrationText,
  type NarrationPhaseId,
} from '@/lib/ai-plan/narration'

const PHASE_FLOOR_MS: Record<NarrationPhaseId, number> = {
  context: 2500,
  env: 2500,
  candidates: 3000,
  building: 3500,
  finalizing: 2500,
}
const COMPRESSED_FLOOR_MS = 1200
export const STALL_TIMEOUT_MS = 60_000

export type LocalContextData = {
  municipality: string
  hours: number
  travel_mode: string
  mood: string
}

export function useGenerationNarrator(opts: {
  dogName: string
  localContext: LocalContextData | null
  onStall: () => void
  onDone: () => void
}) {
  const { dogName, localContext, onStall, onDone } = opts
  const onStallRef = useRef(onStall)
  const onDoneRef = useRef(onDone)
  onStallRef.current = onStall
  onDoneRef.current = onDone

  const [currentStep, setCurrentStep] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [done, setDone] = useState(false)
  const [completedPhaseIds, setCompletedPhaseIds] = useState<NarrationPhaseId[]>([])

  const phaseDataRef = useRef<Partial<Record<NarrationPhaseId, Record<string, unknown>>>>({})
  const planReceivedRef = useRef(false)
  const lastEventAtRef = useRef(Date.now())
  const phaseStartedAtRef = useRef(Date.now())
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepRef = useRef(0)

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }, [])

  const resetStallTimer = useCallback(() => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
    lastEventAtRef.current = Date.now()
    stallTimerRef.current = setTimeout(() => {
      if (!planReceivedRef.current) {
        onStallRef.current()
      }
    }, STALL_TIMEOUT_MS)
  }, [])

  const textForStep = useCallback(
    (step: number): string => {
      const phase = NARRATION_PHASE_ORDER[step]
      if (!phase) return ''
      if (phase === 'context' && localContext) {
        return resolveNarrationText('context', localContext as unknown as Record<string, unknown>, dogName)
      }
      const data = phaseDataRef.current[phase]
      return resolveNarrationText(phase, data, dogName)
    },
    [dogName, localContext]
  )

  const scheduleAdvance = useCallback(() => {
    clearAdvanceTimer()
    const step = stepRef.current
    if (step >= NARRATION_PHASE_ORDER.length) {
      setDone(true)
      onDoneRef.current()
      return
    }
    const phase = NARRATION_PHASE_ORDER[step]!
    const floor = planReceivedRef.current ? COMPRESSED_FLOOR_MS : PHASE_FLOOR_MS[phase]
    const elapsed = Date.now() - phaseStartedAtRef.current
    const wait = Math.max(0, floor - elapsed)
    advanceTimerRef.current = setTimeout(() => {
      const finished = NARRATION_PHASE_ORDER[step]!
      setCompletedPhaseIds((prev) => (prev.includes(finished) ? prev : [...prev, finished]))
      const next = step + 1
      stepRef.current = next
      setCurrentStep(next)
      if (next >= NARRATION_PHASE_ORDER.length) {
        setDone(true)
        onDoneRef.current()
        return
      }
      phaseStartedAtRef.current = Date.now()
      setCurrentText(textForStep(next))
      scheduleAdvance()
    }, wait)
  }, [clearAdvanceTimer, textForStep])

  const reset = useCallback(() => {
    clearAdvanceTimer()
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
    phaseDataRef.current = {}
    planReceivedRef.current = false
    stepRef.current = 0
    phaseStartedAtRef.current = Date.now()
    setCurrentStep(0)
    setDone(false)
    setCompletedPhaseIds([])
    if (localContext) {
      setCurrentText(resolveNarrationText('context', localContext as unknown as Record<string, unknown>, dogName))
    } else {
      setCurrentText('')
    }
    resetStallTimer()
    scheduleAdvance()
  }, [clearAdvanceTimer, dogName, localContext, resetStallTimer, scheduleAdvance])

  useEffect(() => {
    reset()
    return () => {
      clearAdvanceTimer()
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
    }
  }, [reset, clearAdvanceTimer])

  const feedPhase = useCallback(
    (phase: string, data?: Record<string, unknown>) => {
      resetStallTimer()
      const id = phase as NarrationPhaseId
      if (NARRATION_PHASE_ORDER.includes(id)) {
        phaseDataRef.current[id] = { ...phaseDataRef.current[id], ...data }
        if (stepRef.current === NARRATION_PHASE_ORDER.indexOf(id)) {
          setCurrentText(textForStep(stepRef.current))
        }
      }
    },
    [resetStallTimer, textForStep]
  )

  const feedCandidates = useCallback(
    (count: number) => {
      resetStallTimer()
      phaseDataRef.current.candidates = { count }
      if (stepRef.current === NARRATION_PHASE_ORDER.indexOf('candidates')) {
        setCurrentText(textForStep(stepRef.current))
      }
    },
    [resetStallTimer, textForStep]
  )

  const notifyPlanReceived = useCallback(() => {
    planReceivedRef.current = true
    resetStallTimer()
  }, [resetStallTimer])

  return {
    currentStep,
    currentText,
    done,
    completedPhaseIds,
    feedPhase,
    feedCandidates,
    notifyPlanReceived,
    reset,
  }
}
