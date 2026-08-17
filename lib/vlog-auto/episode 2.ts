/**
 * エピソード分割 — VisitPlate の並びを「1本のVLOGになりうる時間のまとまり」に切る。
 * SetLog の「1日分が自動で1本になる」を犬の生活リズムに翻訳した単位:
 * daily（きょう）/ weekly（今週=Dailyの特別版）/ monthly / anniversary / event。
 *
 * 設計原則: Weekly は独立したダイジェストではなく **Daily の延長線上の特別版**。
 * その週の日次エピソード群を素材に、週間統計（記録日数・おでかけ・ベスト★）を
 * まとった「今週のスペシャル」として組み立てる（みてねの「1秒動画」に相当する定期報酬）。
 * 純関数のみ。DB・UI・通知には依存しない。
 */
import type { DailyLogContext } from '@/lib/daily-log'
import type { VisitPlate } from '@/lib/visits-memories'
import { ANNIVERSARY_MONTHS } from '@/lib/vlog-auto/constants'

export type VlogEpisodeKind = 'daily' | 'weekly' | 'monthly' | 'anniversary' | 'event'

/** イベント擬似スポットの解決子。P7 の「イベント=特別な演出が付くスポット」最小構成。
 *  スキーマ確定前のため注入式にし、未提供時は event エピソードを生成しない。 */
export type EventSpotInfo = {
  eventId: string
  eventName: string
  /** 共有ハッシュタグ（# なし。例: "wanspotマルシェ2026"） */
  hashtag: string | null
}
export type EventSpotResolver = (spotId: string) => EventSpotInfo | null

/** weekly スペシャル版の週間統計（イントロ/アウトロ演出と提案文言の素材） */
export type WeeklyStats = {
  /** 記録があった日数（/7） */
  recordedDayCount: number
  /** シーンタグ別の記録数 */
  contextCounts: Partial<Record<DailyLogContext, number>>
  /** 訪れたスポット数（おでかけレビュー） */
  spotCount: number
  /** 週内ベスト★のスポット（レビューの★がVLOG演出に昇華する接点） */
  topRatedSpot: { name: string; rating: number } | null
}

export type VlogEpisode = {
  kind: VlogEpisodeKind
  /** 冪等キー。提案履歴の重複排除に使う（例: daily:2026-07-08 / event:evt123:2026-07-08） */
  key: string
  /** VLOGイントロ・提案カードの見出し（例: きょうのモカ / 6月のおでかけ） */
  title: string
  /** エピソード範囲（ローカル日付キー、両端含む） */
  fromDateKey: string
  toDateKey: string
  plates: VisitPlate[]
  /** anniversary のみ: 経過月数 */
  monthsAgo: number | null
  /** event のみ */
  event: EventSpotInfo | null
  /** weekly のみ: 特別版の週間統計。素材元の daily キーも保持 */
  weeklyStats: WeeklyStats | null
  sourceDailyKeys: string[] | null
}

/** ローカルタイムの日付キー（YYYY-MM-DD）。visited_at / created_at のどちらのISOでも受ける */
export function localDateKey(iso: string, _now?: Date): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateKeyOf(d: Date): string {
  return localDateKey(d.toISOString().slice(0, 10) + 'T12:00:00' /* TZずれ回避に正午 */)
}

/** 月曜始まりの週開始日 */
function weekStart(d: Date): Date {
  const r = new Date(d)
  const dow = (r.getDay() + 6) % 7 // Mon=0
  r.setDate(r.getDate() - dow)
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function platesWithMedia(plates: VisitPlate[]): VisitPlate[] {
  return plates.filter((p) => !p.soft_deleted && p.memories.length > 0)
}

function platesInRange(plates: VisitPlate[], fromKey: string, toKey: string): VisitPlate[] {
  return plates.filter((p) => {
    const k = localDateKey(p.visited_at)
    return k >= fromKey && k <= toKey
  })
}

/** きょうのダイジェスト（E2: 記録した日は必ず完成品が待っている）。
 *  plates は時系列順 — Daily は「1日の物語」なので撮影順を保つ */
export function buildDailyEpisode(plates: VisitPlate[], now: Date, dogName: string | null): VlogEpisode | null {
  const todayKey = dateKeyOf(now)
  const todays = platesInRange(platesWithMedia(plates), todayKey, todayKey).sort(
    (a, b) => a.visited_at.localeCompare(b.visited_at)
  )
  if (todays.length === 0) return null
  return {
    kind: 'daily',
    key: `daily:${todayKey}`,
    title: dogName ? `きょうの${dogName}` : 'きょうのダイジェスト',
    fromDateKey: todayKey,
    toDateKey: todayKey,
    plates: todays,
    monthsAgo: null,
    event: null,
    weeklyStats: null,
    sourceDailyKeys: null,
  }
}

function contextOfPlate(plate: VisitPlate): DailyLogContext | null {
  if (plate.context) return plate.context
  if (plate.spot_id) return 'outing' // スポット訪問レビューは「おでかけ」
  return null
}

/**
 * 今週のスペシャル（Daily の延長線上の特別版）。
 * 週内の日次エピソード群を素材に、週間統計をまとった1本にする。
 * 日曜夕方に Daily の代わりに昇格して届く（scheduler 側の優先度で実現）。
 */
export function buildWeeklySpecialEpisode(
  plates: VisitPlate[],
  now: Date,
  dogName: string | null
): VlogEpisode | null {
  const start = weekStart(now)
  const fromKey = dateKeyOf(start)
  const toKey = dateKeyOf(addDays(start, 6))
  const weekPlates = platesInRange(platesWithMedia(plates), fromKey, toKey).sort(
    (a, b) => a.visited_at.localeCompare(b.visited_at)
  )
  if (weekPlates.length === 0) return null

  const recordedDays = new Set<string>()
  const contextCounts: Partial<Record<DailyLogContext, number>> = {}
  const spotIds = new Set<string>()
  let topRatedSpot: { name: string; rating: number } | null = null

  for (const plate of weekPlates) {
    recordedDays.add(localDateKey(plate.visited_at))
    const ctx = contextOfPlate(plate)
    if (ctx) contextCounts[ctx] = (contextCounts[ctx] ?? 0) + 1
    if (plate.spot_id) {
      spotIds.add(plate.spot_id)
      if (plate.rating != null && (topRatedSpot == null || plate.rating > topRatedSpot.rating)) {
        topRatedSpot = { name: plate.spot.name, rating: plate.rating }
      }
    }
  }

  return {
    kind: 'weekly',
    key: `weekly:${fromKey}`,
    title: dogName ? `今週の${dogName}` : '今週のスペシャル',
    fromDateKey: fromKey,
    toDateKey: toKey,
    plates: weekPlates,
    monthsAgo: null,
    event: null,
    weeklyStats: {
      recordedDayCount: recordedDays.size,
      contextCounts,
      spotCount: spotIds.size,
      topRatedSpot,
    },
    sourceDailyKeys: [...recordedDays].sort().map((k) => `daily:${k}`),
  }
}

/** 先月 or 今月のまとめ（P6: 月末の「今月のVlogができます」用） */
export function buildMonthlyEpisode(plates: VisitPlate[], now: Date): VlogEpisode | null {
  const y = now.getFullYear()
  const m = now.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const fromKey = dateKeyOf(first)
  const toKey = dateKeyOf(last)
  const monthPlates = platesInRange(platesWithMedia(plates), fromKey, toKey)
  if (monthPlates.length === 0) return null
  return {
    kind: 'monthly',
    key: `monthly:${y}-${`${m + 1}`.padStart(2, '0')}`,
    title: `${m + 1}月のおでかけ`,
    fromDateKey: fromKey,
    toDateKey: toKey,
    plates: monthPlates,
    monthsAgo: null,
    event: null,
    weeklyStats: null,
    sourceDailyKeys: null,
  }
}

/** ◯ヶ月前の今日（P4a: 見返しトリガー。既存 memory-anniversary 通知と同じ発想の生成版） */
export function buildAnniversaryEpisodes(plates: VisitPlate[], now: Date): VlogEpisode[] {
  const withMedia = platesWithMedia(plates)
  const episodes: VlogEpisode[] = []
  for (const monthsAgo of ANNIVERSARY_MONTHS) {
    const target = new Date(now)
    target.setMonth(target.getMonth() - monthsAgo)
    const targetKey = dateKeyOf(target)
    const hits = platesInRange(withMedia, targetKey, targetKey)
    if (hits.length === 0) continue
    const label = monthsAgo === 12 ? '1年前' : `${monthsAgo}ヶ月前`
    episodes.push({
      kind: 'anniversary',
      key: `anniversary:${targetKey}`,
      title: `${label}の今日`,
      fromDateKey: targetKey,
      toDateKey: targetKey,
      plates: hits,
      monthsAgo,
      event: null,
      weeklyStats: null,
      sourceDailyKeys: null,
    })
  }
  return episodes
}

/** イベントVlog（P7）: イベント擬似スポットへの当日訪問をイベント単位にまとめる */
export function buildEventEpisodes(
  plates: VisitPlate[],
  now: Date,
  resolveEventSpot: EventSpotResolver | null
): VlogEpisode[] {
  if (!resolveEventSpot) return []
  const todayKey = dateKeyOf(now)
  const byEvent = new Map<string, { info: EventSpotInfo; plates: VisitPlate[] }>()
  for (const plate of platesWithMedia(plates)) {
    if (!plate.spot_id) continue
    if (localDateKey(plate.visited_at) !== todayKey) continue
    const info = resolveEventSpot(plate.spot_id)
    if (!info) continue
    const entry = byEvent.get(info.eventId) ?? { info, plates: [] }
    entry.plates.push(plate)
    byEvent.set(info.eventId, entry)
  }
  return [...byEvent.values()].map(({ info, plates: eventPlates }) => ({
    kind: 'event' as const,
    key: `event:${info.eventId}:${todayKey}`,
    title: info.eventName,
    fromDateKey: todayKey,
    toDateKey: todayKey,
    plates: eventPlates,
    monthsAgo: null,
    event: info,
    weeklyStats: null,
    sourceDailyKeys: null,
  }))
}

/** 全種別のエピソードを列挙（提案可否・優先度の判断は scheduler が行う） */
export function buildEpisodes(input: {
  plates: VisitPlate[]
  now: Date
  dogName: string | null
  resolveEventSpot?: EventSpotResolver | null
}): VlogEpisode[] {
  const { plates, now, dogName } = input
  const episodes: VlogEpisode[] = []
  const daily = buildDailyEpisode(plates, now, dogName)
  if (daily) episodes.push(daily)
  const weekly = buildWeeklySpecialEpisode(plates, now, dogName)
  if (weekly) episodes.push(weekly)
  const monthly = buildMonthlyEpisode(plates, now)
  if (monthly) episodes.push(monthly)
  episodes.push(...buildAnniversaryEpisodes(plates, now))
  episodes.push(...buildEventEpisodes(plates, now, input.resolveEventSpot ?? null))
  return episodes
}
