/**
 * ワンスポカレンダーの型（アプリ側で使う最小限のみ）。
 * 出典: wanspot(Web) src/lib/calendar/types.ts — サーバー側が正。変更時はここも追随する。
 */

export type CalendarTag = {
  id: string
  name: string
  slug: string
  color: string
  sort_order: number
}

export type CalendarEventOccurrence = {
  id: string
  event_id: string
  starts_at: string
  ends_at: string | null
  is_all_day: boolean
}

export type CalendarEvent = {
  id: string
  title: string
  slug: string
  description: string | null
  venue_name: string | null
  address: string | null
  lat: number | null
  lng: number | null
  place_id?: string | null
  price_text: string | null
  /** 0=無料, 1〜4=¥〜¥¥¥¥（スポットと同系） */
  price_level?: number | null
  ticket_url: string | null
  official_url?: string | null
  /** 関連サイトURL（①②③…。①は official_url と同値を先頭に持つ） */
  related_urls?: string[] | null
  /** 最終入場時刻（例 16:30） */
  last_entry_text?: string | null
  ai_summary?: string | null
  hours_text: string | null
  thumbnail_url: string | null
  region_name: string | null
  station_name: string | null
  /** 都道府県マスタ。住所が無いイベントでもここは埋まっていることが多い */
  prefecture?: { id: string; name: string; slug: string; sort_order: number } | null
}

export type CalendarEventWithRelations = CalendarEvent & {
  occurrences: CalendarEventOccurrence[]
  tags: CalendarTag[]
}

/** 月別APIの応答 */
export type CalendarMonthResponse = {
  events?: CalendarEventWithRelations[]
  meta?: {
    holidays?: Record<string, string>
    inHorizon?: boolean
  }
  error?: string
}

const JST_FMT_DATE = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
})
const JST_FMT_TIME = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const JST_FMT_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** ISO文字列 → JSTの日付キー（YYYY-MM-DD）。端末タイムゾーンに依存しない */
export function jstDateKey(iso: string): string {
  return JST_FMT_YMD.format(new Date(iso))
}

/** 例: 7/27(日) */
export function jstDateLabel(iso: string): string {
  return JST_FMT_DATE.format(new Date(iso))
}

/** 例: 10:00 */
export function jstTimeLabel(iso: string): string {
  return JST_FMT_TIME.format(new Date(iso))
}

/** 開催回の表示行（JST固定）。終日は時刻を出さない */
export function occurrenceLabel(o: CalendarEventOccurrence): string {
  const date = jstDateLabel(o.starts_at)
  if (o.is_all_day) return `${date} 終日`
  const start = jstTimeLabel(o.starts_at)
  const end = o.ends_at ? `〜${jstTimeLabel(o.ends_at)}` : ''
  return `${date} ${start}${end}`
}
