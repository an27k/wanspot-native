export type OpenStatus = 'open' | 'closed' | 'unknown'

const JA_WEEKDAYS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'] as const

function todayJaWeekday(now: Date): string {
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const short = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'short' }).format(now)
  const dayIdx = map[short] ?? now.getDay()
  return JA_WEEKDAYS[dayIdx]
}

function minutesInTokyo(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

function parseClockToken(raw: string): number | null {
  const t = raw.trim()
  const jp = t.match(/^(\d{1,2})時(?:(\d{1,2})分)?/)
  if (jp) {
    const h = Number(jp[1])
    const m = jp[2] != null ? Number(jp[2]) : 0
    if (h >= 0 && h <= 24 && m >= 0 && m < 60) return h * 60 + m
    return null
  }
  const western = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (western) {
    let h = Number(western[1])
    const m = Number(western[2])
    const meridiem = western[3]?.toUpperCase()
    if (meridiem === 'PM' && h < 12) h += 12
    if (meridiem === 'AM' && h === 12) h = 0
    if (h >= 0 && h <= 24 && m >= 0 && m < 60) return h * 60 + m
  }
  return null
}

function parseHoursLine(line: string): OpenStatus {
  const body = line.replace(/^[^:]+:\s*/, '').trim()
  if (!body) return 'unknown'
  if (/定休|休業|休み|closed/i.test(body)) return 'closed'
  if (/24\s*時間|24時間|終日/i.test(body)) return 'open'

  const chunks = body.split(/[–—\-~～]/).map((s) => s.trim()).filter(Boolean)
  if (chunks.length < 2) return 'unknown'

  const openMin = parseClockToken(chunks[0])
  const closeMin = parseClockToken(chunks[chunks.length - 1])
  if (openMin == null || closeMin == null) return 'unknown'

  const nowMin = minutesInTokyo(new Date())
  if (closeMin <= openMin) {
    return nowMin >= openMin || nowMin < closeMin ? 'open' : 'closed'
  }
  return nowMin >= openMin && nowMin < closeMin ? 'open' : 'closed'
}

/** Google Places の weekday_text または open_now から営業状態を推定 */
export function getSpotOpenStatus(
  weekdayText: string[] | null | undefined,
  openNow?: boolean | null
): OpenStatus {
  if (typeof openNow === 'boolean') return openNow ? 'open' : 'closed'
  if (!weekdayText?.length) return 'unknown'

  const today = todayJaWeekday(new Date())
  const todayLine = weekdayText.find((line) => line.trim().startsWith(today))
  if (!todayLine) return 'unknown'
  return parseHoursLine(todayLine)
}

/** 料金ラベル先頭の重複 ¥ を除去 */
export function stripLeadingYen(label: string | null | undefined): string | null {
  if (!label) return null
  const trimmed = label.trim().replace(/^¥+\s*/, '').trim()
  return trimmed.length > 0 ? trimmed : null
}

const PRICE_BANDS: Record<number, string> = {
  0: '無料',
  1: '1000~2000',
  2: '2000~5000',
  3: '5000~10000',
  4: '10000~',
}

/** 料金を数字レンジ表示に整形（例: 2000~3000） */
export function formatPriceDisplay(
  priceLabel: string | null | undefined,
  priceLevel: number | null | undefined
): string | null {
  if (priceLabel) {
    const t = priceLabel.trim()
    if (t === '無料') return '無料'
    if (!/^¥+$/.test(t)) {
      const cleaned = stripLeadingYen(t)?.replace(/,/g, '') ?? ''
      if (/\d/.test(cleaned)) {
        return cleaned.replace(/[–—\-~～]+/g, '~').replace(/\s+/g, '')
      }
    }
  }
  if (priceLevel != null && Number.isFinite(priceLevel)) {
    return PRICE_BANDS[Math.round(priceLevel)] ?? null
  }
  return null
}


/**
 * 「本日の営業時間」を1行で返す。
 *
 * これまで営業時間は「住所・営業時間・料金」の折りたたみの内側にあり、上部に
 * 出ていたのは英語1語の Open / Close だけだった。日曜の夕方に動物病院を探して
 * いる人が最初に知りたいのは「いま開いているか」ではなく「何時まで開いているか」
 * なので、時刻ごと外に出す。
 */
export function todayHoursSummary(
  weekdayText: string[] | null | undefined,
  openNow?: boolean | null
): { label: string; tone: OpenStatus } | null {
  if (!weekdayText?.length) {
    if (typeof openNow === 'boolean') {
      return { label: openNow ? '営業中' : '営業時間外', tone: openNow ? 'open' : 'closed' }
    }
    return null
  }

  const today = todayJaWeekday(new Date())
  const todayLine = weekdayText.find((line) => line.trim().startsWith(today))
  if (!todayLine) return null

  const body = todayLine.replace(/^[^:]+:\s*/, '').trim()
  if (!body) return null

  const status = getSpotOpenStatus(weekdayText, openNow)
  if (/定休|休業|休み|closed/i.test(body)) return { label: '本日は休み', tone: 'closed' }

  const remain = minutesUntilClose(body)
  if (status === 'open' && remain != null && remain <= 120) {
    // 残りが短いときだけ添える。常に出すと「あと8時間」のような無意味な情報になる
    const h = Math.floor(remain / 60)
    const m = remain % 60
    const left = h > 0 ? `あと${h}時間${m > 0 ? `${m}分` : ''}` : `あと${m}分`
    return { label: `本日 ${body}（${left}）`, tone: 'open' }
  }
  return { label: `本日 ${body}`, tone: status }
}

/** 閉店までの残り分。判定できないときは null */
function minutesUntilClose(body: string): number | null {
  if (/24\s*時間|24時間|終日/i.test(body)) return null
  const chunks = body.split(/[–—\-~～]/).map((x) => x.trim()).filter(Boolean)
  if (chunks.length < 2) return null
  const closeMin = parseClockToken(chunks[chunks.length - 1])
  if (closeMin == null) return null
  const nowMin = minutesInTokyo(new Date())
  const diff = closeMin - nowMin
  return diff > 0 ? diff : null
}
