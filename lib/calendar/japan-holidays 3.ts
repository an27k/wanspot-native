import holidayJp from '@holiday-jp/holiday_jp'

type HolidayEntry = { name: string; name_en?: string }

function holidaysTable(): Record<string, HolidayEntry> {
  return holidayJp.holidays as unknown as Record<string, HolidayEntry>
}

/**
 * holiday_jp の表記を法令上の通称に揃える。
 * 例: 「休日」(Citizen's Holiday) → 「国民の休日」
 */
export function formatJapanHolidayName(entry: HolidayEntry): string {
  const name = entry.name.trim()
  const nameEn = entry.name_en?.trim() ?? ''

  // 祝日に挟まれた「国民の休日」（holiday_jp では単に「休日」）
  if (name === '休日' || nameEn === "Citizen's Holiday") {
    return '国民の休日'
  }
  // 単独の「振替休日」のみ（「こどもの日 振替休日」などは元の表記を維持）
  if (name === '振替休日') {
    return '振替休日'
  }
  return name
}

/** `YYYY-MM-DD` → 祝日名（なければ null） */
export function japanHolidayName(dateKey: string): string | null {
  const entry = holidaysTable()[dateKey]
  return entry ? formatJapanHolidayName(entry) : null
}

/** 指定月の祝日マップ（キーは YYYY-MM-DD） */
export function japanHolidaysInMonth(year: number, month: number): Record<string, string> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const out: Record<string, string> = {}
  for (const [key, h] of Object.entries(holidaysTable())) {
    if (key.startsWith(prefix)) out[key] = formatJapanHolidayName(h)
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

export const CALENDAR_DATE_COLORS_DARK = {
  past: '#766F68',
  saturday: '#78A9FF',
  sunday_or_holiday: '#FF7894',
  weekday: '#BDB5AC',
} as const
