import { loadNotificationsModule } from '@/lib/notifications/notifications-module'
import { walkAlertFromTemp } from '@/lib/weather/walk-alert'
import {
  fetchWalkHourlySlotsForDate,
  type WalkHourlySlot,
} from '@/lib/weather/walk-environment'

export const WALK_ADVICE_MORNING_TYPE = 'walk_advice_morning'

/** 散歩時間 未設定時のデフォルト通知時刻（朝5:00・JST） */
export const WALK_ADVICE_DEFAULT_NOTIFY_HOUR = 5
/** カスタム散歩時間がある場合、その何時間前に通知するか */
export const WALK_ADVICE_NOTIFY_LEAD_HOURS = 2

/** 同一条件での重複予約を避ける（犬名・散歩時間・日付が変わったら貼り直す） */
let syncedKey: string | null = null

/** JST の今の {dateKey, hour} */
function nowJst(): { dateKey: string; hour: number; epochMs: number } {
  const now = new Date()
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(now)
  )
  return { dateKey, hour, epochMs: now.getTime() }
}

/** JST日付キー + 時 → 絶対時刻（Date）。JST = UTC+9 固定 */
function jstDate(dateKey: string, hour: number): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour - 9, 0, 0))
}

function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days, 3)) // 正午前の安全時刻
  return dt.toISOString().slice(0, 10)
}

/** 歩きやすいスロットか（お散歩アラートと同じ安全側基準: 25℃以下・降水50%未満・雨系でない） */
function isWalkableSlot(s: WalkHourlySlot): boolean {
  return s.tempC <= 25 && s.precipProb < 50 && s.condition !== 'rain' && s.condition !== 'thunder' && s.condition !== 'snow'
}

/** 快適域(12〜24℃)からの距離 */
function comfortDistance(tempC: number): number {
  if (tempC < 12) return 12 - tempC
  if (tempC > 24) return tempC - 24
  return 0
}

function pickBestSlot(slots: WalkHourlySlot[]): WalkHourlySlot | null {
  let best: WalkHourlySlot | null = null
  for (const s of slots) {
    if (!isWalkableSlot(s)) continue
    if (
      !best ||
      comfortDistance(s.tempC) < comfortDistance(best.tempC) ||
      (comfortDistance(s.tempC) === comfortDistance(best.tempC) && s.precipProb < best.precipProb)
    ) {
      best = s
    }
  }
  return best
}

/** デフォルト（散歩時間 未設定）: きょうのおすすめ時間の提言 */
function buildDefaultBody(slots: WalkHourlySlot[], name: string): string {
  const best = pickBestSlot(slots)
  if (best) {
    return `きょうは${best.hour}時ごろ（${best.tempC}℃・降水${best.precipProb}%）が歩きやすそうです。${name}とのお散歩の目安にどうぞ。`
  }
  return `きょうは暑さや天気が厳しめの予報です。いちばん涼しい時間に短めのお散歩が安心です。`
}

/** カスタム散歩時間あり: 予定時刻の環境予測 + より良い時間があれば変更の助言 */
function buildCustomBody(slots: WalkHourlySlot[], walkHour: number, name: string): string {
  const planned = slots.find((s) => s.hour === walkHour) ?? null
  const best = pickBestSlot(slots)

  if (planned && isWalkableSlot(planned)) {
    const level = walkAlertFromTemp(planned.tempC)
    // 予定時刻が歩きやすく、明確により良い時間もなければそのまま背中を押す
    if (!best || best.hour === planned.hour || comfortDistance(best.tempC) >= comfortDistance(planned.tempC)) {
      return `${walkHour}時の予定時間は${planned.tempC}℃・降水${planned.precipProb}%（${level.label}）。予定どおりで良さそうです。`
    }
    return `${walkHour}時は${planned.tempC}℃・降水${planned.precipProb}%の見込み。${best.hour}時ごろ（${best.tempC}℃）のほうがさらに歩きやすそうです。`
  }

  if (planned && best) {
    return `${walkHour}時は${planned.tempC}℃・降水${planned.precipProb}%と少し条件が厳しめ。きょうは${best.hour}時ごろ（${best.tempC}℃・降水${best.precipProb}%）が歩きやすそうです。`
  }
  if (planned) {
    return `${walkHour}時は${planned.tempC}℃・降水${planned.precipProb}%の見込みです。${name}の様子を見ながら、短めの調整が安心です。`
  }
  return buildDefaultBody(slots, name)
}

/**
 * 朝のお散歩予報通知を予約する（冪等・ベストエフォート）。
 * アプリ起動を「更新タイミング」として、予報から本文を計算した通知を直近2日ぶんワンショット予約する。
 * - 散歩時間 未設定: 朝5:00に「きょうのおすすめ時間」
 * - カスタム散歩時間: その2時間前に「予定時刻の環境予測＋より良い時間の助言」
 * 位置情報が無い場合は本文を汎用文言にして同時刻に予約する。
 */
export async function syncWalkAdviceMorningNotification(
  dogName?: string | null,
  opts?: { location?: { lat: number; lng: number } | null; walkHour?: number | null }
): Promise<void> {
  const nameKey = dogName?.trim() || null
  const walkHour = opts?.walkHour ?? null
  const now = nowJst()
  const dedupe = `${nameKey}:${walkHour}:${now.dateKey}:${opts?.location ? 'loc' : 'noloc'}`
  if (syncedKey === dedupe) return
  syncedKey = dedupe

  try {
    // ネイティブモジュール未搭載のバイナリでは何もしない（起動クラッシュ防止）
    const notifications = loadNotificationsModule()
    if (!notifications) return

    let permission = await notifications.getPermissionsAsync()
    if (!permission.granted && permission.canAskAgain) {
      permission = await notifications.requestPermissionsAsync()
    }
    if (!permission.granted) return

    // 既存の予約を貼り直す（予報・設定変更が反映されるように）
    const scheduled = await notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.type === WALK_ADVICE_MORNING_TYPE)
        .map((n) => notifications.cancelScheduledNotificationAsync(n.identifier))
    )

    const name = nameKey ?? 'うちの子'
    const notifyHour =
      walkHour != null
        ? Math.max(walkHour - WALK_ADVICE_NOTIFY_LEAD_HOURS, 0)
        : WALK_ADVICE_DEFAULT_NOTIFY_HOUR
    const title = `☀️ きょうの${name}のお散歩予報`

    // 直近2日ぶん（Open-Meteo の forecast_days=2 の範囲内）
    for (const dayOffset of [0, 1]) {
      const dateKey = addDaysToKey(now.dateKey, dayOffset)
      const fireAt = jstDate(dateKey, notifyHour)
      if (fireAt.getTime() <= now.epochMs + 5 * 60_000) continue // 過ぎた回・直近すぎる回はスキップ

      let body = '歩きやすい時間の目安ができています。おでかけ前にチェックしてあげてください。'
      if (opts?.location) {
        const slots = await fetchWalkHourlySlotsForDate(opts.location.lat, opts.location.lng, dateKey)
        if (slots.length > 0) {
          body = walkHour != null ? buildCustomBody(slots, walkHour, name) : buildDefaultBody(slots, name)
        }
      }

      await notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: WALK_ADVICE_MORNING_TYPE, url: '/(tabs)/mypage' },
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      })
    }
  } catch (e) {
    // 通知はベストエフォート。失敗しても体験を壊さない
    console.warn('[walk-advice-morning]', e instanceof Error ? e.message : String(e))
  }
}
