import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { AiPlanHistory } from '@/components/ai-plan/AiPlanHistory'
import { AiPlanInputForm, type DogSize } from '@/components/ai-plan/AiPlanInputForm'
import { AiPlanGenerating } from '@/components/ai-plan/AiPlanGenerating'
import { AiPlanError } from '@/components/ai-plan/AiPlanError'
import { AiPlanResult } from '@/components/ai-plan/AiPlanResult'
import type { AiPlanCore, AiPlanHistoryRow, AiPlanLeg, AiPlanSseEvent, AiPlanTravelMode } from '@/components/ai-plan/types'
import { streamAiPlan } from '@/components/ai-plan/stream-ai-plan'

type UiState = 'history' | 'form' | 'generating' | 'result' | 'error'

function normalizeLeg(raw: any): AiPlanLeg | null {
  if (!raw || typeof raw !== 'object') return null
  const idx = typeof raw.index === 'number' ? raw.index : Number.NaN
  const dur = typeof raw.duration_seconds === 'number' ? raw.duration_seconds : Number.NaN
  const dist = typeof raw.distance_meters === 'number' ? raw.distance_meters : Number.NaN
  const o = typeof raw.origin_spot_id === 'string' ? raw.origin_spot_id : ''
  const d = typeof raw.destination_spot_id === 'string' ? raw.destination_spot_id : ''
  if (!Number.isFinite(idx) || !Number.isFinite(dur) || !Number.isFinite(dist) || !o || !d) return null
  return { index: idx, duration_seconds: dur, distance_meters: dist, origin_spot_id: o, destination_spot_id: d }
}

export function AiPlanTab() {
  const [ui, setUi] = useState<UiState>('history')
  const [history, setHistory] = useState<AiPlanHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [dogName, setDogName] = useState('ワンちゃん')
  const [dbDogSize, setDbDogSize] = useState<DogSize | null>(null)

  const [phase, setPhase] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState<AiPlanCore | null>(null)
  const [travelMode, setTravelMode] = useState<AiPlanTravelMode>('walking')
  const [legsByIndex, setLegsByIndex] = useState<Record<number, AiPlanLeg>>({})
  const [generatingAreaLabel, setGeneratingAreaLabel] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const abortRef = useRef<AbortController | null>(null)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setHistory([])
        setUi('form')
        return
      }
      const { data } = await supabase
        .from('ai_plans')
        .select('id, created_at, input_params, generated_plan')
        .order('created_at', { ascending: false })
        .limit(5)
      const rows = (data ?? []) as any[]
      const normalized: AiPlanHistoryRow[] = rows
        .filter((r) => r && typeof r.id === 'string')
        .map((r) => ({
          id: r.id,
          created_at: typeof r.created_at === 'string' ? r.created_at : '',
          input_params: r.input_params,
          generated_plan: r.generated_plan,
        }))
      setHistory(normalized)
      setUi(normalized.length > 0 ? 'history' : 'form')
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  const loadDog = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: dog } = await supabase.from('dogs').select('name, size').eq('user_id', user.id).maybeSingle()
    const name = typeof (dog as any)?.name === 'string' && (dog as any).name.trim() ? (dog as any).name.trim() : 'ワンちゃん'
    setDogName(name)
    const s = (dog as any)?.size
    const size = s === 'XS' || s === 'S' || s === 'M' || s === 'L' || s === 'XL' ? (s as DogSize) : null
    setDbDogSize(size)
  }, [])

  useEffect(() => {
    void (async () => {
      await Promise.all([loadHistory(), loadDog()])
    })()
  }, [loadDog, loadHistory])

  const startNew = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase(null)
    setCurrentPlan(null)
    setLegsByIndex({})
    setUi('form')
  }

  const onSelectHistory = (row: AiPlanHistoryRow) => {
    const plan = row.generated_plan as any
    if (!plan || typeof plan !== 'object' || !Array.isArray(plan.stops)) {
      Alert.alert('エラー', '保存されたプランの形式が不正です')
      return
    }
    setTravelMode((plan.travel_mode === 'driving' ? 'driving' : 'walking') as AiPlanTravelMode)
    setCurrentPlan({ title: String(plan.title ?? ''), summary: String(plan.summary ?? ''), stops: plan.stops })
    const legsArr = Array.isArray(plan.legs) ? plan.legs : []
    const map: Record<number, AiPlanLeg> = {}
    for (const raw of legsArr) {
      const leg = normalizeLeg(raw)
      if (leg) map[leg.index] = leg
    }
    setLegsByIndex(map)
    setUi('result')
  }

  const areaLabel = useMemo(() => generatingAreaLabel, [generatingAreaLabel])

  const submit = async (v: {
    prefecture: string
    municipality: string
    duration: 'half_day' | 'full_day'
    travel_mode: AiPlanTravelMode
    mood: 'active' | 'relaxed'
    dogSize: DogSize
  }) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setUi('generating')
    setPhase('loading_profile')
    setTravelMode(v.travel_mode)
    setCurrentPlan(null)
    setLegsByIndex({})
    setGeneratingAreaLabel(`${v.prefecture} ${v.municipality}`)

    try {
      await streamAiPlan(
        {
          mood: v.mood,
          prefecture: v.prefecture,
          municipality: v.municipality,
          travel_mode: v.travel_mode,
          duration: v.duration,
          dog_size: v.dogSize,
        },
        {
          signal: ac.signal,
          onEvent: (ev: AiPlanSseEvent) => {
            if (ev.type === 'phase') {
              setPhase(ev.phase)
              return
            }
            if (ev.type === 'plan') {
              setCurrentPlan(ev.plan)
              setUi('result')
              return
            }
            if (ev.type === 'leg') {
              const leg = normalizeLeg((ev as any).leg)
              if (!leg) return
              setLegsByIndex((prev) => ({ ...prev, [leg.index]: leg }))
              return
            }
            if (ev.type === 'saved') {
              void loadHistory()
              return
            }
            if (ev.type === 'error') {
              const code = ev.code
              const msg =
                code === 'no_candidates'
                  ? 'このエリアにはまだ候補が少ないようです。別のエリアを試してみてください。'
                  : code === 'unsupported_area'
                    ? 'このエリアはまだ対応していません。'
                    : code === 'llm_failed' || code === 'llm_invalid_response'
                      ? 'プランの生成に失敗しました。もう一度お試しください。'
                      : 'エラーが発生しました。時間を置いて再度お試しください。'
              setErrorMessage(msg)
              setUi('error')
              return
            }
            if (ev.type === 'done') {
              abortRef.current = null
            }
          },
        }
      )
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        setUi('form')
        return
      }
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMessage(msg)
      setUi('error')
    } finally {
      // keep history refresh as-is
    }
  }

  if (loadingHistory && ui === 'history') {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingTxt}>読み込み中...</Text>
      </View>
    )
  }

  if (ui === 'history') {
    return <AiPlanHistory rows={history} onSelect={onSelectHistory} onCreate={() => setUi('form')} />
  }

  if (ui === 'form') {
    return (
      <AiPlanInputForm
        initialDogName={dogName}
        dbDogSize={dbDogSize}
        onCancel={() => setUi(history.length > 0 ? 'history' : 'form')}
        onSubmit={submit}
      />
    )
  }

  if (ui === 'generating') {
    return <AiPlanGenerating phase={phase} areaLabel={areaLabel} dogName={dogName} />
  }

  if (ui === 'result' && currentPlan) {
    return <AiPlanResult plan={currentPlan} legs={legsByIndex} travelMode={travelMode} onPressNew={startNew} />
  }

  if (ui === 'error') {
    return <AiPlanError message={errorMessage || 'エラーが発生しました。'} onBack={() => setUi('form')} />
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
  loading: { flex: 1, backgroundColor: '#f7f6f3', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { fontSize: 12, color: '#888' },
  btn: { borderRadius: 16, backgroundColor: '#FFD84D', paddingVertical: 14, paddingHorizontal: 16 },
  btnTxt: { fontSize: 14, fontWeight: '900', color: '#2b2a28' },
})
