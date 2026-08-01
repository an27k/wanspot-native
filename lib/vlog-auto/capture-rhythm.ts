/**
 * 撮影リズム — DAUエンジンの心臓。SetLog の「1時間に1回、2秒だけ」を犬の1日に翻訳する。
 * 1時間1スロットが開き、日常シーンをタグ（DailyLogContext）で分類して最短2秒の動画を残す。
 * 「おでかけ」タグのときだけスポット選択＋レビュー（★・メモ）が接続され、
 * ★とメモが既存EDLの尺配分・字幕にそのまま反映される（visits.rating / comment 経由）。
 * 撮れなかったスロットはただ空くだけで、締切もペナルティもない（E1/E3: 強制しない）。
 * 純関数のみ。カメラUI・通知発火・永続化は呼び出し側の責務。
 */
import type { DailyLogContext } from '@/lib/daily-log'
import type { VisitPlate } from '@/lib/visits-memories'
import {
  CAPTURE_ACTIVE_HOUR_END,
  CAPTURE_ACTIVE_HOUR_START,
  CAPTURE_NUDGE_COOLDOWN_HOURS,
  CAPTURE_NUDGE_MAX_PER_DAY,
} from '@/lib/vlog-auto/constants'
import { localDateKey } from '@/lib/vlog-auto/episode'

export type CaptureSlotStatus =
  /** このスロット内に記録あり */
  | 'captured'
  /** いま開いているスロット（現在時刻が属する時間） */
  | 'open'
  /** 過ぎたが記録なし（責めない。UIでは薄く表示する程度） */
  | 'passed'
  /** まだ来ていない */
  | 'upcoming'

export type CaptureSlot = {
  /** スロット開始時（0-23） */
  hour: number
  status: CaptureSlotStatus
  /** スロット内の記録に付いたタグ（複数記録可） */
  contexts: DailyLogContext[]
  memoryCount: number
}

export type CaptureDay = {
  dateKey: string
  slots: CaptureSlot[]
  capturedSlotCount: number
  /** きょう1件でも記録があるか（ストリーク判定単位） */
  hasAnyCapture: boolean
  /** 連続記録日数（きょう含む。きょう未記録なら昨日まで） */
  streakDays: number
}

/** 時間帯 → 提案するシーンタグ（犬の生活リズム。UIのデフォルト選択と文言に使う） */
export function suggestContextForHour(hour: number): DailyLogContext {
  if (hour < 9) return 'walk' // 朝さんぽ
  if (hour < 11) return 'meal' // 朝ごはん・おやつ
  if (hour < 15) return 'nap' // おひるね
  if (hour < 18) return 'outing' // 午後のおでかけ・公園
  return 'walk' // 夕さんぽ
}

function contextsOfPlate(plate: VisitPlate): DailyLogContext[] {
  if (plate.context) return [plate.context]
  // スポット訪問（レビュー）は「おでかけ」扱い
  if (plate.spot_id) return ['outing']
  return []
}

/** 記録日（1件以上メディアがある日）のキー集合 */
function capturedDateKeys(plates: VisitPlate[]): Set<string> {
  const keys = new Set<string>()
  for (const p of plates) {
    if (p.soft_deleted || p.memories.length === 0) continue
    keys.add(localDateKey(p.visited_at))
  }
  return keys
}

/** 連続記録日数。きょう未記録の場合は昨日から遡る（きょうの分はまだ取り返せる） */
export function calcStreakDays(plates: VisitPlate[], now: Date): number {
  const keys = capturedDateKeys(plates)
  const cursor = new Date(now)
  if (!keys.has(localDateKey(cursor.toISOString()))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (keys.has(localDateKey(cursor.toISOString()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** きょうのスロット表を組み立てる（アルバム先頭の常設UI・カメラ導線の状態源） */
export function buildCaptureDay(plates: VisitPlate[], now: Date): CaptureDay {
  const todayKey = localDateKey(now.toISOString())
  const nowHour = now.getHours()

  const byHour = new Map<number, { contexts: DailyLogContext[]; memoryCount: number }>()
  for (const plate of plates) {
    if (plate.soft_deleted || plate.memories.length === 0) continue
    if (localDateKey(plate.visited_at) !== todayKey) continue
    const hour = new Date(plate.visited_at).getHours()
    const entry = byHour.get(hour) ?? { contexts: [], memoryCount: 0 }
    entry.contexts.push(...contextsOfPlate(plate))
    entry.memoryCount += plate.memories.length
    byHour.set(hour, entry)
  }

  const slots: CaptureSlot[] = []
  for (let hour = CAPTURE_ACTIVE_HOUR_START; hour <= CAPTURE_ACTIVE_HOUR_END; hour++) {
    const entry = byHour.get(hour)
    const status: CaptureSlotStatus = entry
      ? 'captured'
      : hour === nowHour
        ? 'open'
        : hour < nowHour
          ? 'passed'
          : 'upcoming'
    slots.push({
      hour,
      status,
      contexts: entry?.contexts ?? [],
      memoryCount: entry?.memoryCount ?? 0,
    })
  }

  const capturedSlotCount = slots.filter((s) => s.status === 'captured').length
  return {
    dateKey: todayKey,
    slots,
    capturedSlotCount,
    hasAnyCapture: capturedSlotCount > 0,
    streakDays: calcStreakDays(plates, now),
  }
}

/** 呼び出し側が永続化するナッジ履歴（JSONシリアライズ可能） */
export type CaptureNudgeState = {
  /** 最終ナッジ時刻(ISO) */
  lastNudgeAt: string | null
  /** その日のナッジ回数（dateKey が変わったらリセットして使う） */
  nudgeCountDateKey: string | null
  nudgeCount: number
}

export const EMPTY_CAPTURE_NUDGE_STATE: CaptureNudgeState = {
  lastNudgeAt: null,
  nudgeCountDateKey: null,
  nudgeCount: 0,
}

export type CaptureNudge = {
  /** 提案するシーンタグ（カメラを開いたときのデフォルト選択） */
  suggestedContext: DailyLogContext
  headline: string
  body: string
}

const NUDGE_COPY: Record<DailyLogContext, { headline: string; body: (dog: string) => string }> = {
  walk: { headline: 'おさんぽの2秒、残しませんか 🐾', body: (d) => `いまの${d}を2秒だけ。きょうのVlogのワンカットになります` },
  meal: { headline: 'ごはんタイムをワンカット 🍚', body: (d) => `${d}のもぐもぐを2秒だけ。あとで見返すと効きます` },
  nap: { headline: 'おひるね中…？ 😴', body: (d) => `寝顔は最高の素材です。そっと2秒だけ` },
  home: { headline: 'おうち時間をワンカット 🏠', body: (d) => `なんでもない${d}の今が、きょうのVlogになります` },
  outing: { headline: 'おでかけ中の2秒を 🎬', body: (d) => `スポットを選んで★を付けると、Vlogに評価とメモが載ります` },
  event: { headline: 'イベントの瞬間を 🎪', body: () => `会場の2秒がイベントVlogのワンカットになります` },
}

/**
 * 撮影ナッジを出すべきか判定する。スロットは毎時開くが、プッシュは
 * クールダウン＋1日上限で間引く（リズムは作る・強制はしない）。
 */
export function planCaptureNudge(
  day: CaptureDay,
  state: CaptureNudgeState,
  now: Date,
  dogName: string | null
): CaptureNudge | null {
  const hour = now.getHours()
  if (hour < CAPTURE_ACTIVE_HOUR_START || hour > CAPTURE_ACTIVE_HOUR_END) return null

  // いまのスロットが埋まっていれば出さない
  const current = day.slots.find((s) => s.hour === hour)
  if (!current || current.status === 'captured') return null

  // 1日上限
  const todayKey = day.dateKey
  const countToday = state.nudgeCountDateKey === todayKey ? state.nudgeCount : 0
  if (countToday >= CAPTURE_NUDGE_MAX_PER_DAY) return null

  // クールダウン
  if (state.lastNudgeAt) {
    const hoursSince = (now.getTime() - new Date(state.lastNudgeAt).getTime()) / 3_600_000
    if (hoursSince < CAPTURE_NUDGE_COOLDOWN_HOURS) return null
  }

  const suggestedContext = suggestContextForHour(hour)
  const copy = NUDGE_COPY[suggestedContext]
  return {
    suggestedContext,
    headline: copy.headline,
    body: copy.body(dogName ?? 'うちの子'),
  }
}

/** ナッジ発火を状態に反映する reducer（呼び出し側で永続化） */
export function applyCaptureNudge(state: CaptureNudgeState, dateKey: string, now: Date): CaptureNudgeState {
  const countToday = state.nudgeCountDateKey === dateKey ? state.nudgeCount : 0
  return {
    lastNudgeAt: now.toISOString(),
    nudgeCountDateKey: dateKey,
    nudgeCount: countToday + 1,
  }
}
