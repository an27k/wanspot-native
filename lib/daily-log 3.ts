import type { SpotMini } from '@/lib/visits-memories'

/**
 * きょうのログ (P3) — スポット訪問に依存しない日次記録のコンテキスト定義。
 * DBの visits.context / visits.mood と1:1対応（docs/daily-log-design.md §2）。
 * 'event' は P7（イベントVlog）の拡張ポイントとして型・ラベルにのみ予約し、UIには出さない。
 */
export type DailyLogContext = 'walk' | 'meal' | 'nap' | 'home' | 'outing' | 'event'

export type DailyLogMood = 'happy' | 'excited' | 'relaxed' | 'sleepy' | 'yummy'

export type DailyLogContextDef = {
  id: DailyLogContext
  label: string
  /** Ionicons name */
  icon: string
}

/** UI（コンテキストチップ）に表示する5種。'event' は含めない */
export const DAILY_LOG_CONTEXTS: DailyLogContextDef[] = [
  { id: 'walk', label: 'おさんぽ', icon: 'paw' },
  { id: 'meal', label: 'ごはん', icon: 'restaurant' },
  { id: 'nap', label: 'おひるね', icon: 'moon' },
  { id: 'home', label: 'おうち', icon: 'home' },
  { id: 'outing', label: 'おでかけ', icon: 'sunny' },
]

const CONTEXT_LABELS: Record<DailyLogContext, string> = {
  walk: 'おさんぽ',
  meal: 'ごはん',
  nap: 'おひるね',
  home: 'おうち',
  outing: 'おでかけ',
  event: 'イベント',
}

/** 'event' 含む全コンテキストのラベル解決（P7拡張ポイント） */
export function contextLabel(context: DailyLogContext | string | null | undefined): string {
  if (!context) return 'きょうのログ'
  return CONTEXT_LABELS[context as DailyLogContext] ?? 'きょうのログ'
}

export type DailyLogMoodDef = {
  id: DailyLogMood
  label: string
  emoji: string
}

export const DAILY_LOG_MOODS: DailyLogMoodDef[] = [
  { id: 'happy', label: 'ごきげん', emoji: '😄' },
  { id: 'excited', label: 'はしゃぎ', emoji: '🎾' },
  { id: 'relaxed', label: 'まったり', emoji: '☁️' },
  { id: 'sleepy', label: 'おねむ', emoji: '😴' },
  { id: 'yummy', label: 'おいしい', emoji: '😋' },
]

export function moodEmoji(mood: DailyLogMood | string | null | undefined): string | null {
  if (!mood) return null
  return DAILY_LOG_MOODS.find((m) => m.id === mood)?.emoji ?? null
}

/** アルバム上で spot カテゴリの代わりに表示するラベル */
export const DAILY_LOG_CATEGORY = 'きょうのログ'

/** 日次ログ判定 — spot_id が null の visit/plate */
export function isDailyLogVisit(row: { spot_id: string | null }): boolean {
  return row.spot_id == null
}

/**
 * 日次ログ visit 用の合成 SpotMini。
 * アルバム/Vlog UI はスポット名の位置にコンテキストラベルを表示する。
 * id は spots テーブルの実在行と衝突しない合成キー（照会には使わない）。
 */
export function dailyLogSpotMini(context: DailyLogContext | string | null): SpotMini {
  return {
    id: `daily-log:${context ?? 'home'}`,
    name: contextLabel(context),
    category: DAILY_LOG_CATEGORY,
  }
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

/** 当日の日次ログ plate だけを抽出（エントリカードの「記録済み」表示用） */
export function todaysDailyLogPlates<T extends { spot_id: string | null; visited_at: string }>(
  plates: T[],
  now = new Date()
): T[] {
  return plates.filter((p) => isDailyLogVisit(p) && isSameLocalDay(new Date(p.visited_at), now))
}
