import type * as Notifications from 'expo-notifications'
import { REVIEW_ALBUM_TAB_ENABLED, VLOG_ENABLED } from '@/lib/feature-flags'
import { loadNotificationsModule } from '@/lib/notifications/notifications-module'
import type { VisitPlate } from '@/lib/visits-memories'

export const MEMORY_ANNIVERSARY_TYPE = 'memory_anniversary'

/** 通知を予約する先読み日数（アルバムを開くたびに再同期される） */
const LOOKAHEAD_DAYS = 7
/** 通知の配信時刻（朝の散歩前） */
const NOTIFY_HOUR = 9

type AnniversaryRule = { label: string; subtractMonths?: number; subtractYears?: number }

const RULES: AnniversaryRule[] = [
  { label: '1ヶ月前', subtractMonths: 1 },
  { label: '半年前', subtractMonths: 6 },
  { label: '1年前', subtractYears: 1 },
]

export type MemoryAnniversary = {
  plate: VisitPlate
  label: string
  /** 通知を出す日 */
  notifyDate: Date
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

/** 「dateのnヶ月/n年前」— 月末ずれ（例: 3/31の1ヶ月前）はカレンダー上存在しないためマッチさせない */
function shiftBack(date: Date, rule: AnniversaryRule): Date | null {
  const target = new Date(date)
  if (rule.subtractYears) target.setFullYear(target.getFullYear() - rule.subtractYears)
  if (rule.subtractMonths) {
    const wantDay = target.getDate()
    target.setMonth(target.getMonth() - rule.subtractMonths)
    if (target.getDate() !== wantDay) return null
  }
  return target
}

/** 今日からLOOKAHEAD_DAYS日以内に「◯ヶ月前/◯年前の今日」を迎える思い出を検出する */
export function findUpcomingAnniversaries(plates: VisitPlate[], now = new Date()): MemoryAnniversary[] {
  const found: MemoryAnniversary[] = []
  const seenDays = new Set<string>()

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    const dayKey = day.toDateString()
    if (seenDays.has(dayKey)) continue

    for (const rule of RULES) {
      const past = shiftBack(day, rule)
      if (!past) continue
      // 思い出（写真・動画つきレビュー）があるvisitを優先
      const candidates = plates
        .filter((p) => sameCalendarDay(new Date(p.visited_at), past))
        .sort((a, b) => b.memories.length - a.memories.length)
      const plate = candidates[0]
      if (!plate) continue

      const notifyDate = new Date(day)
      notifyDate.setHours(NOTIFY_HOUR, 0, 0, 0)
      if (notifyDate.getTime() <= now.getTime()) continue

      found.push({ plate, label: rule.label, notifyDate })
      seenDays.add(dayKey)
      break
    }
  }

  return found
}

function buildContent(item: MemoryAnniversary, dogName: string): Notifications.NotificationContentInput {
  const vlogSuffix = VLOG_ENABLED ? 'アルバムで見返して、Vlogにしてみませんか？' : '思い出を見返してみませんか？'
  // 日次ログ（きょうのログ）は「行った」ではなく日常の記録として案内する
  const body =
    item.plate.spot_id == null
      ? `${dogName}の「${item.plate.spot.name}」を記録した日です。${vlogSuffix}`
      : `${dogName}と「${item.plate.spot.name}」に行った日です。${vlogSuffix}`
  return {
    title: `${item.label}の今日の思い出 🐾`,
    body,
    sound: false,
    data: {
      type: MEMORY_ANNIVERSARY_TYPE,
      url: REVIEW_ALBUM_TAB_ENABLED ? '/(tabs)/camera' : '/(tabs)',
      visitId: item.plate.id,
    },
  }
}

/**
 * 「◯ヶ月前の今日」ローカル通知の同期。
 * アルバム読み込みのたびに呼び、既存予約を貼り直す（冪等）。
 * サーバープッシュ基盤は使わず、クライアントのスケジューリングのみで成立する最小構成。
 */
export async function syncMemoryAnniversaryNotifications(
  plates: VisitPlate[],
  dogName?: string | null
): Promise<void> {
  if (!REVIEW_ALBUM_TAB_ENABLED) return

  try {
    // ネイティブモジュール未搭載のバイナリでは何もしない（起動クラッシュ防止）
    const notifications = loadNotificationsModule()
    if (!notifications) return

    const upcoming = findUpcomingAnniversaries(plates)

    // 候補が1件もなければ権限は要求せず、過去の予約だけ掃除する
    let permission = await notifications.getPermissionsAsync()
    if (upcoming.length > 0 && !permission.granted && permission.canAskAgain) {
      permission = await notifications.requestPermissionsAsync()
    }
    if (!permission.granted) return

    const scheduled = await notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.type === MEMORY_ANNIVERSARY_TYPE)
        .map((n) => notifications.cancelScheduledNotificationAsync(n.identifier))
    )

    const displayName = dogName?.trim() || '愛犬'
    for (const item of upcoming) {
      await notifications.scheduleNotificationAsync({
        content: buildContent(item, displayName),
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.DATE,
          date: item.notifyDate,
        },
      })
    }
  } catch (e) {
    // 通知はベストエフォート。失敗してもアルバム体験を壊さない
    console.warn('[memory-anniversary]', e instanceof Error ? e.message : String(e))
  }
}
