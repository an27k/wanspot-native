import curated from './curated-external-events.json'

export type ExternalEventFallbackRow = {
  id?: string
  title: string
  description: string | null
  event_at: string | null
  location_name: string | null
  area: string | null
  url: string | null
  source: string | null
  links?: { label: string; url: string }[] | null
}

/** API 失敗時も同じキュレート（実イベント）を表示 */
export const EXTERNAL_EVENTS_EMPTY_FALLBACK: ExternalEventFallbackRow[] =
  curated as ExternalEventFallbackRow[]
