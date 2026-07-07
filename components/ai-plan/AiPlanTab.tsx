import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { AiPlanHistory } from '@/components/ai-plan/AiPlanHistory'
import { AiPlanInputForm, type DogSize, type DurationHoursPick } from '@/components/ai-plan/AiPlanInputForm'
import { AiPlanGenerating } from '@/components/ai-plan/AiPlanGenerating'
import { AiPlanError, type SuggestedArea } from '@/components/ai-plan/AiPlanError'
import { AiPlanResult } from '@/components/ai-plan/AiPlanResult'
import type {
  AiPlanCore,
  AiPlanHistoryRow,
  AiPlanLeg,
  AiPlanMood,
  AiPlanSseEvent,
  AiPlanTravelMode,
} from '@/components/ai-plan/types'
import { streamAiPlan } from '@/components/ai-plan/stream-ai-plan'
import { TOKENS } from '@/constants/color-tokens'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import { useGenerationNarrator, type LocalContextData } from '@/lib/ai-plan/narrator'
import { logUserEvent } from '@/lib/user-events'

type UiState = 'history' | 'form' | 'generating' | 'result' | 'error'

function normalizeLeg(raw: unknown): AiPlanLeg | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const idx = typeof o.index === 'number' ? o.index : Number.NaN
  const dur = typeof o.duration_seconds === 'number' ? o.duration_seconds : Number.NaN
  const dist = typeof o.distance_meters === 'number' ? o.distance_meters : Number.NaN
  const origin = typeof o.origin_spot_id === 'string' ? o.origin_spot_id : ''
  const dest = typeof o.destination_spot_id === 'string' ? o.destination_spot_id : ''
  if (!Number.isFinite(idx) || !Number.isFinite(dur) || !Number.isFinite(dist) || !origin || !dest) return null
  return { index: idx, duration_seconds: dur, distance_meters: dist, origin_spot_id: origin, destination_spot_id: dest }
}

function normalizeErrorCode(code: string | undefined): string {
  if (!code) return 'internal_error'
  if (code === 'llm_invalid_response') return 'llm_failed'
  return code
}

type GeneratingRequest = {
  prefecture: string
  municipality: string
  durationHours: DurationHoursPick
  departureTime: string
  travel_mode: AiPlanTravelMode
  mood: AiPlanMood
  dogSize: DogSize
}

function AiPlanGeneratingSession({
  dogName,
  request,
  localContext,
  onError,
  onComplete,
  onSaved,
  onPlan,
  onLeg,
}: {
  dogName: string
  request: GeneratingRequest
  localContext: LocalContextData
  onError: (code: string, detail: string | null) => void
  onComplete: () => void
  onSaved: (id: string) => void
  onPlan: (plan: AiPlanCore) => void
  onLeg: (leg: AiPlanLeg) => void
}) {
  const abortRef = useRef<AbortController | null>(null)
  const stalledRef = useRef(false)

  const narrator = useGenerationNarrator({
    dogName,
    localContext,
    onStall: () => {
      stalledRef.current = true
      abortRef.current?.abort()
      onError('generation_timeout', null)
    },
    onDone: onComplete,
  })

  const feedPhaseRef = useRef(narrator.feedPhase)
  const feedCandidatesRef = useRef(narrator.feedCandidates)
  const notifyPlanReceivedRef = useRef(narrator.notifyPlanReceived)
  feedPhaseRef.current = narrator.feedPhase
  feedCandidatesRef.current = narrator.feedCandidates
  notifyPlanReceivedRef.current = narrator.notifyPlanReceived

  useEffect(() => {
    stalledRef.current = false
    const ac = new AbortController()
    abortRef.current = ac

    void (async () => {
      try {
        await streamAiPlan(
          {
            mood: request.mood,
            prefecture: request.prefecture,
            municipality: request.municipality,
            travel_mode: request.travel_mode,
            duration_hours: request.durationHours,
            departure_time: request.departureTime,
            dog_size: request.dogSize,
          },
          {
            signal: ac.signal,
            onPhase: (phase, data) => {
              feedPhaseRef.current(phase, data)
            },
            onEvent: (ev: AiPlanSseEvent) => {
              if (ev.type === 'candidates') {
                feedCandidatesRef.current(ev.count)
                return
              }
              if (ev.type === 'plan') {
                onPlan(ev.plan)
                notifyPlanReceivedRef.current()
                return
              }
              if (ev.type === 'leg') {
                const leg = normalizeLeg((ev as { leg?: unknown }).leg)
                if (leg) onLeg(leg)
                return
              }
              if (ev.type === 'saved') {
                if (typeof ev.id === 'string' && ev.id) onSaved(ev.id)
                return
              }
              if (ev.type === 'error') {
                const raw = typeof ev.code === 'string' ? ev.code : ''
                let code = normalizeErrorCode(ev.code)
                let detail: string | null = typeof ev.message === 'string' ? ev.message : null
                if (raw === 'walking_not_feasible') {
                  code = 'unsupported_area'
                  detail = detail ?? 'feasibility_walking'
                } else if (raw === 'driving_not_feasible') {
                  code = 'unsupported_area'
                  detail = detail ?? 'feasibility_driving'
                }
                onError(code, detail)
                return
              }
            },
          }
        )
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') {
          if (stalledRef.current) return
          return
        }
        onError('internal_error', null)
      }
    })()

    return () => {
      abortRef.current?.abort()
    }
  }, [request, onComplete, onError, onLeg, onPlan, onSaved])

  return (
    <AiPlanGenerating
      dogName={dogName}
      currentStep={narrator.currentStep}
      currentText={narrator.currentText}
      completedPhaseIds={narrator.completedPhaseIds}
    />
  )
}

export function AiPlanTab({
  onEmbeddedChromeVisibility,
}: {
  onEmbeddedChromeVisibility?: (visible: boolean) => void
} = {}) {
  const requireAuth = useRequireAuth()
  const [ui, setUi] = useState<UiState>('history')
  const [history, setHistory] = useState<AiPlanHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [dogName, setDogName] = useState('ワンちゃん')
  const [dbDogSize, setDbDogSize] = useState<DogSize | null>(null)

  const [streamPlanReady, setStreamPlanReady] = useState(false)
  const [generatingRequest, setGeneratingRequest] = useState<GeneratingRequest | null>(null)
  const [generatingContext, setGeneratingContext] = useState<LocalContextData | null>(null)
  const [resultPlanId, setResultPlanId] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState<AiPlanCore | null>(null)
  const [travelMode, setTravelMode] = useState<AiPlanTravelMode>('walking')
  const [resultMood, setResultMood] = useState<AiPlanMood>('active')
  const [legsByIndex, setLegsByIndex] = useState<Record<number, AiPlanLeg>>({})
  const [errorCode, setErrorCode] = useState<string>('internal_error')
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [areaPreset, setAreaPreset] = useState<{ prefecture: string; municipality: string } | null>(null)
  const [lastPlanAttemptArea, setLastPlanAttemptArea] = useState<{
    prefecture: string
    municipality: string
  } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const planReceivedRef = useRef(false)
  const currentPlanRef = useRef<AiPlanCore | null>(null)
  const generatingRequestRef = useRef<GeneratingRequest | null>(null)
  const generationAbortedByTimeoutRef = useRef(false)
  const narratorDoneRef = useRef(false)

  /** 個別プラン表示時も検索ヘッダー分の余白を残し、下に白い戻るバーを置く */
  useEffect(() => {
    onEmbeddedChromeVisibility?.(true)
  }, [onEmbeddedChromeVisibility])

  useEffect(() => {
    return () => {
      onEmbeddedChromeVisibility?.(true)
    }
  }, [onEmbeddedChromeVisibility])

  const loadHistory = useCallback(async (opts?: { onlyRefresh?: boolean }) => {
    const onlyRefresh = !!opts?.onlyRefresh
    if (!onlyRefresh) setLoadingHistory(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setHistory([])
        if (!onlyRefresh) setUi('form')
        return
      }
      const { data } = await supabase
        .from('ai_plans')
        .select('id, created_at, input_params, generated_plan')
        .order('created_at', { ascending: false })
        .limit(5)
      const rows = (data ?? []) as unknown[]
      const normalized: AiPlanHistoryRow[] = rows
        .filter((r) => r && typeof r === 'object' && typeof (r as { id?: string }).id === 'string')
        .map((r) => {
          const row = r as { id: string; created_at: unknown; input_params: unknown; generated_plan: unknown }
          return {
            id: row.id,
            created_at: typeof row.created_at === 'string' ? row.created_at : '',
            input_params: row.input_params,
            generated_plan: row.generated_plan as AiPlanHistoryRow['generated_plan'],
          }
        })
      setHistory(normalized)
      if (!onlyRefresh) {
        setUi(normalized.length > 0 ? 'history' : 'form')
      }
    } finally {
      if (!onlyRefresh) setLoadingHistory(false)
    }
  }, [])

  const loadDog = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: dog } = await supabase.from('dogs').select('name, size').eq('user_id', user.id).maybeSingle()
    const name = typeof (dog as { name?: string } | null)?.name === 'string' && (dog as { name: string }).name.trim()
      ? (dog as { name: string }).name.trim()
      : 'ワンちゃん'
    setDogName(name)
    const s = (dog as { size?: string } | null)?.size
    const size = s === 'XS' || s === 'S' || s === 'M' || s === 'L' || s === 'XL' ? (s as DogSize) : null
    setDbDogSize(size)
  }, [])

  useEffect(() => {
    void (async () => {
      await Promise.all([loadHistory(), loadDog()])
    })()
  }, [loadDog, loadHistory])

  const startNew = useCallback(() => {
    generationAbortedByTimeoutRef.current = false
    narratorDoneRef.current = false
    abortRef.current?.abort()
    abortRef.current = null
    setStreamPlanReady(false)
    setGeneratingRequest(null)
    setGeneratingContext(null)
    setResultPlanId(null)
    planReceivedRef.current = false
    setCurrentPlan(null)
    setLegsByIndex({})
    setAreaPreset(null)
    setErrorDetail(null)
    setUi('form')
  }, [])

  const onReadyForResult = useCallback(() => {
    if (planReceivedRef.current && narratorDoneRef.current) {
      setUi('result')
    }
  }, [])

  const tryShowResult = useCallback(() => {
    narratorDoneRef.current = true
    if (planReceivedRef.current) {
      setUi('result')
    }
  }, [])

  const onSelectHistory = (row: AiPlanHistoryRow) => {
    const plan = row.generated_plan as {
      title?: unknown
      summary?: unknown
      stops?: unknown
      mood?: string
      travel_mode?: string
      legs?: unknown
    } | null
    if (!plan || typeof plan !== 'object' || !Array.isArray(plan.stops)) {
      Alert.alert('エラー', '保存されたプランの形式が不正です')
      return
    }
    const tm = plan.travel_mode === 'driving' ? 'driving' : 'walking'
    setTravelMode(tm as AiPlanTravelMode)
    setResultMood(plan.mood === 'relaxed' ? 'relaxed' : 'active')
    setCurrentPlan({
      title: String(plan.title ?? ''),
      summary: String(plan.summary ?? ''),
      stops: plan.stops as AiPlanCore['stops'],
    })
    const legsArr = Array.isArray(plan.legs) ? plan.legs : []
    const map: Record<number, AiPlanLeg> = {}
    for (const raw of legsArr) {
      const leg = normalizeLeg(raw)
      if (leg) map[leg.index] = leg
    }
    setLegsByIndex(map)
    setResultPlanId(row.id)
    setUi('result')
  }

  const submit = (v: {
    prefecture: string
    municipality: string
    durationHours: DurationHoursPick
    departureTime: string
    travel_mode: AiPlanTravelMode
    mood: 'active' | 'relaxed'
    dogSize: DogSize
  }) => {
    if (!requireAuth('AIプランを保存するにはログインしてください。')) return
    generationAbortedByTimeoutRef.current = false
    narratorDoneRef.current = false
    abortRef.current?.abort()
    abortRef.current = null

    setUi('generating')
    setStreamPlanReady(false)
    setResultPlanId(null)
    planReceivedRef.current = false
    setErrorDetail(null)
    setLastPlanAttemptArea({ prefecture: v.prefecture, municipality: v.municipality })
    setTravelMode(v.travel_mode)
    setResultMood(v.mood)
    setCurrentPlan(null)
    currentPlanRef.current = null
    setLegsByIndex({})
    setGeneratingRequest({
      prefecture: v.prefecture,
      municipality: v.municipality,
      durationHours: v.durationHours,
      departureTime: v.departureTime,
      travel_mode: v.travel_mode,
      mood: v.mood,
      dogSize: v.dogSize,
    })
    generatingRequestRef.current = {
      prefecture: v.prefecture,
      municipality: v.municipality,
      durationHours: v.durationHours,
      departureTime: v.departureTime,
      travel_mode: v.travel_mode,
      mood: v.mood,
      dogSize: v.dogSize,
    }
    setGeneratingContext({
      municipality: v.municipality,
      hours: v.durationHours,
      travel_mode: v.travel_mode,
      mood: v.mood,
    })
  }

  const handleGeneratingError = useCallback((code: string, detail: string | null) => {
    setErrorCode(code)
    setErrorDetail(detail)
    setGeneratingRequest(null)
    generatingRequestRef.current = null
    currentPlanRef.current = null
    setGeneratingContext(null)
    setUi('error')
  }, [])

  const handleGeneratingPlan = useCallback((plan: AiPlanCore) => {
    currentPlanRef.current = plan
    setCurrentPlan(plan)
    planReceivedRef.current = true
    setStreamPlanReady(true)
    if (narratorDoneRef.current) {
      setUi('result')
    }
  }, [])

  const handleGeneratingLeg = useCallback((leg: AiPlanLeg) => {
    setLegsByIndex((prev) => ({ ...prev, [leg.index]: leg }))
  }, [])

  const handleGeneratingSaved = useCallback(
    (id: string) => {
      setResultPlanId(id)
      void loadHistory({ onlyRefresh: true })
      const req = generatingRequestRef.current
      const plan = currentPlanRef.current
      if (req) {
        logUserEvent({
          eventType: 'ai_plan_adopted',
          props: {
            plan_id: id,
            prefecture: req.prefecture,
            municipality: req.municipality,
            duration_hours: req.durationHours,
            travel_mode: req.travel_mode,
            mood: req.mood,
            stop_count: plan?.stops?.length ?? null,
          },
        })
      }
    },
    [loadHistory]
  )

  const goForm = useCallback(() => {
    setAreaPreset(null)
    setErrorDetail(null)
    setUi('form')
  }, [])

  const onErrorSelectArea = useCallback((area: SuggestedArea) => {
    setAreaPreset({ prefecture: area.prefecture, municipality: area.municipality })
    setUi('form')
  }, [])

  if (loadingHistory && ui === 'history') {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingTxt}>読み込み中...</Text>
      </View>
    )
  }

  if (ui === 'history') {
    return <AiPlanHistory rows={history} onSelect={onSelectHistory} onCreate={goForm} />
  }

  if (ui === 'form') {
    return (
      <AiPlanInputForm
        initialDogName={dogName}
        dbDogSize={dbDogSize}
        areaPreset={areaPreset}
        onCancel={() => setUi(history.length > 0 ? 'history' : 'form')}
        onSubmit={submit}
      />
    )
  }

  if (ui === 'generating' && generatingRequest && generatingContext) {
    return (
      <AiPlanGeneratingSession
        dogName={dogName}
        request={generatingRequest}
        localContext={generatingContext}
        onError={handleGeneratingError}
        onComplete={tryShowResult}
        onSaved={handleGeneratingSaved}
        onPlan={handleGeneratingPlan}
        onLeg={handleGeneratingLeg}
      />
    )
  }

  if (ui === 'result' && currentPlan) {
    return (
      <AiPlanResult
        plan={currentPlan}
        planId={resultPlanId}
        legs={legsByIndex}
        travelMode={travelMode}
        mood={resultMood}
        onBack={() => setUi(history.length > 0 ? 'history' : 'form')}
        onPressNew={startNew}
      />
    )
  }

  if (ui === 'error') {
    return (
      <AiPlanError
        code={errorCode}
        errorDetail={errorDetail}
        onBack={goForm}
        onSelectArea={onErrorSelectArea}
        requestArea={lastPlanAttemptArea}
      />
    )
  }

  return (
    <View style={styles.loading}>
      <Pressable style={styles.btn} onPress={startNew}>
        <Text style={styles.btnTxt}>新しいプランを作る</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: TOKENS.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingTxt: { fontSize: 12, color: TOKENS.text.tertiary },
  btn: { borderRadius: 14, backgroundColor: TOKENS.brand.yellow, paddingVertical: 14, paddingHorizontal: 16 },
  btnTxt: { fontSize: 14, fontWeight: '700', color: TOKENS.text.primary },
})
