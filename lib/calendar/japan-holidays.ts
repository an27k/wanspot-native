import holidayJp from '@holiday-jp/holiday_jp'

type HolidayEntry = { name: string }

function holidaysTable(): Record<string, HolidayEntry> {
  return holidayJp.holidays as unknown as Record<string, HolidayEntry>
}

/** `YYYY-MM-DD` → 祝日名（なければ null） */
export function japanHolidayName(dateKey: string): string | null {
  return holidaysTable()[dateKey]?.name ?? null
}

/** 指定月の祝日マップ（キーは YYYY-MM-DD） */
export function japanHolidaysInMonth(year: number, month: number): Record<string, string> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const out: Record<string, string> = {}
  for (const [key, h] of Object.entries(holidaysTable())) {
    if (key.startsWith(prefix)) out[key] = h.name
  }
  return out
}

/**
 * カレンダー日付の文字色トーン。
 * 過去日はグレー。それ以外は土曜=青、日曜・祝日=赤。
 */
export function calendarDateTone(
  dateKey: string,
  opts: { todayKey: string; holidayName?: string | null }
): 'past' | 'saturday' | 'sunday_or_holiday' | 'weekday' {
  if (dateKey < opts.todayKey) return 'past'
  const [y, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0=日 … 6=土
  if (dow === 0 || opts.holidayName) return 'sunday_or_holiday'
  if (dow === 6) return 'saturday'
  return 'weekday'
}

export const CALENDAR_DATE_COLORS = {
  past: '#B0A9A2',
  saturday: '#3B82F6',
  sunday_or_holiday: '#E11D48',
  weekday: '#6B6560',
} as const
