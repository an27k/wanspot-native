/**
 * 生成演出の文言。
 *
 * 【最重要ルール】
 * - withData テンプレートは、対応データが payload に存在する場合のみ使用する。
 * - 1 つでも欠けていたら fallback を使う。デフォルト値・推測値・ダミー数値で埋めない。
 */

export type NarrationContextData = {
  dogName?: string
  municipality?: string
  stationName?: string
  hours?: number
  travelLabel?: string
  moodLabel?: string
}

function contextAreaLabel(d: NarrationContextData): string | undefined {
  if (d.stationName) return `${d.stationName}周辺`
  return d.municipality
}

export type NarrationEnvData = {
  month?: number
  daypartLabel?: string
}

export type NarrationCandidatesData = {
  count?: number
}

export type NarrationBuildingData = {
  name1?: string
  dwell1?: number
  name2?: string
  dwell2?: number
  stopCount?: number
}

export function travelLabel(mode?: string): string | undefined {
  if (mode === 'walking') return '徒歩'
  if (mode === 'driving') return '車'
  return undefined
}

export function moodLabel(mood?: string): string | undefined {
  if (mood === 'active') return 'アクティブ'
  if (mood === 'relaxed') return 'のんびり'
  return undefined
}

export function daypartLabel(daypart?: string): string | undefined {
  if (daypart === 'morning') return '朝'
  if (daypart === 'afternoon') return '午後'
  if (daypart === 'evening') return '夕方'
  return undefined
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export const NARRATION = {
  context: {
    withData: [
      (d: NarrationContextData) => {
        const area = contextAreaLabel(d)
        return `${d.dogName ? `${d.dogName}と` : ''}${area}を${d.hours}時間・${d.travelLabel}でめぐるプランを組み立てます`
      },
      (d: NarrationContextData) => {
        const area = contextAreaLabel(d)
        return `条件を読み込みました — ${area}、${d.hours}時間、${d.moodLabel}`
      },
    ],
    fallback: '条件を読み込んでいます',
  },
  env: {
    withData: [
      (d: NarrationEnvData) => `${d.month}月の${d.daypartLabel}スタートに合わせて調整中`,
      (d: NarrationEnvData) => `${d.daypartLabel}の時間帯に合う過ごし方を選んでいます`,
    ],
    fallback: '時間帯に合わせて調整中',
  },
  candidates: {
    withData: [
      (d: NarrationCandidatesData) => `エリア内のワンちゃんOKスポット${d.count}件を評価中`,
      (d: NarrationCandidatesData) => `${d.count}件の候補から相性のいい組み合わせを検討中`,
    ],
    fallback: '候補スポットを評価中',
  },
  building: {
    withData: [
      (d: NarrationBuildingData) =>
        `${d.name1}に${d.dwell1}分、${d.name2 ? `${d.name2}に${d.dwell2}分、` : ''}実際の過ごしやすさで配分中`,
      (d: NarrationBuildingData) => `${d.stopCount}か所構成で、滞在時間を組んでいます`,
    ],
    fallback: 'コースを組み立てています',
  },
  finalizing: {
    withData: [
      () => 'ルートの所要時間を実測して、仕上げにタイトルを書いています',
      () => '移動時間を確認して、最後の仕上げ中',
    ],
    fallback: '仕上げています',
  },
  GENERIC: '作成中…',
} as const

export type NarrationPhaseId = 'context' | 'env' | 'candidates' | 'building' | 'finalizing'

export const NARRATION_PHASE_ORDER: NarrationPhaseId[] = [
  'context',
  'env',
  'candidates',
  'building',
  'finalizing',
]

export function resolveNarrationText(
  phase: NarrationPhaseId | string,
  data: Record<string, unknown> | undefined,
  dogName?: string
): string {
  const key = phase as NarrationPhaseId

  if (key === 'context') {
    const d: NarrationContextData = {
      dogName: dogName?.trim() || undefined,
      municipality: typeof data?.municipality === 'string' ? data.municipality : undefined,
      stationName: typeof data?.stationName === 'string' ? data.stationName : undefined,
      hours: typeof data?.hours === 'number' ? data.hours : undefined,
      travelLabel: travelLabel(typeof data?.travel_mode === 'string' ? data.travel_mode : undefined),
      moodLabel: moodLabel(typeof data?.mood === 'string' ? data.mood : undefined),
    }
    if (contextAreaLabel(d) && d.hours != null && d.travelLabel && d.moodLabel) {
      return pickRandom(NARRATION.context.withData)(d)
    }
    return NARRATION.context.fallback
  }

  if (key === 'env') {
    const d: NarrationEnvData = {
      month: typeof data?.month === 'number' ? data.month : undefined,
      daypartLabel: daypartLabel(typeof data?.daypart === 'string' ? data.daypart : undefined),
    }
    if (d.month != null && d.daypartLabel) return pickRandom(NARRATION.env.withData)(d)
    return NARRATION.env.fallback
  }

  if (key === 'candidates') {
    const d: NarrationCandidatesData = {
      count: typeof data?.count === 'number' ? data.count : undefined,
    }
    if (d.count != null) return pickRandom(NARRATION.candidates.withData)(d)
    return NARRATION.candidates.fallback
  }

  if (key === 'building') {
    const allocs = Array.isArray(data?.allocations) ? data.allocations : []
    const a0 = allocs[0] as { name?: string; dwellMinutes?: number } | undefined
    const a1 = allocs[1] as { name?: string; dwellMinutes?: number } | undefined
    const d: NarrationBuildingData = {
      name1: typeof a0?.name === 'string' ? a0.name : undefined,
      dwell1: typeof a0?.dwellMinutes === 'number' ? a0.dwellMinutes : undefined,
      name2: typeof a1?.name === 'string' ? a1.name : undefined,
      dwell2: typeof a1?.dwellMinutes === 'number' ? a1.dwellMinutes : undefined,
      stopCount: typeof data?.stopCount === 'number' ? data.stopCount : undefined,
    }
    if (d.name1 != null && d.dwell1 != null) return pickRandom(NARRATION.building.withData)(d)
    if (d.stopCount != null) return pickRandom(NARRATION.building.withData)(d)
    return NARRATION.building.fallback
  }

  if (key === 'finalizing') {
    const fn = pickRandom(NARRATION.finalizing.withData)
    return fn()
  }

  return NARRATION.GENERIC
}
