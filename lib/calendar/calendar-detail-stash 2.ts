import type { CalendarEventWithRelations } from '@/lib/calendar/types'

/**
 * カレンダー詳細画面へのイベント受け渡し（メモリ上のスタッシュ）。
 * expo-router のパラメータはシリアライズ制約があるため、選択イベントを slug キーで一時保管する。
 * lib/spot-detail-stash.ts と同じ流儀。
 */
let stash: CalendarEventWithRelations | null = null

export function stashCalendarEvent(event: CalendarEventWithRelations): void {
  stash = event
}

export function takeCalendarEvent(slug: string): CalendarEventWithRelations | null {
  if (stash && stash.slug === slug) return stash
  return null
}
