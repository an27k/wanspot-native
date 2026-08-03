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
  /** 収集元。まとめサイトのことが多く、読者には見せない */
  source_url?: string | null
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

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).host.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * 読者に見せるリンクだけを残す。
 *
 * イベントは犬向けのまとめサイトから集めており、official_url と related_urls に
 * 収集元のURLが混ざる。押すとまとめ記事に飛ばされ、読者はそこから改めて
 * 公式を探すことになる。どのサイトがまとめサイトかを一覧で持つと
 * 収集元を足すたびに更新が要るので、そのイベント自身の source_url と比べる。
 */
export function directLinksOnly(
  urls: (string | null | undefined)[],
  listingUrl: string | null | undefined
): string[] {
  const listingHost = hostOf(listingUrl)
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    const trimmed = url?.trim()
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) continue
    if (listingHost && hostOf(trimmed) === listingHost) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/** 例: 10:00 */
export function jstTimeLabel(iso: string): string {
  return JST_FMT_TIME.format(new Date(iso))
}

/**
 * 開催回の表示行（JST固定）。
 *
 * is_all_day は「本当に終日」ではなく「掲載元に時刻が書かれていなかった」を意味する。
 * 収集元のまとめサイトは日付しか書かないことが多く、実際サーバ側では
 * 193件のうち65件が時刻不明のまま残っている。「終日」と出すと
 * 朝から晩までやっているように読めてしまうので、そうは書かない。
 */
export function occurrenceLabel(o: CalendarEventOccurrence): string {
  const date = jstDateLabel(o.starts_at)
  if (o.is_all_day) return `${date}（時刻の記載なし）`
  const start = jstTimeLabel(o.starts_at)
  const end = o.ends_at ? `〜${jstTimeLabel(o.ends_at)}` : ''
  return `${date} ${start}${end}`
}
