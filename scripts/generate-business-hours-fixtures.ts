import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  formatPriceDisplay,
  getSpotOpenStatus,
  openStateFromPeriods,
  stripLeadingYen,
  todayHoursSummary,
  todayRangeFromPeriods,
  type OpeningPeriod,
} from '../lib/business-hours'

type Nullable<T> = T | null

const atFixedNow = <T>(iso: string, operation: () => T): T => {
  const RealDate = globalThis.Date
  const timestamp = new RealDate(iso).getTime()
  const FixedDate = class extends RealDate {
    constructor() {
      super(timestamp)
    }

    static override now(): number {
      return timestamp
    }
  }

  globalThis.Date = FixedDate as DateConstructor
  try {
    return operation()
  } finally {
    globalThis.Date = RealDate
  }
}

const openStateInputs: {
  id: string
  periods: OpeningPeriod[] | null
  now: string
}[] = [
  {
    id: 'missing-periods',
    periods: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'single-open-only-is-24-hours',
    periods: [{ open: { day: 2, time: '0000' } }],
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'single-empty-period-is-also-24-hours',
    periods: [{}],
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'same-day-open',
    periods: [{ open: { day: 2, time: '0900' }, close: { day: 2, time: '1700' } }],
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'closing-boundary-is-closed',
    periods: [{ open: { day: 2, time: '0900' }, close: { day: 2, time: '1700' } }],
    now: '2026-08-18T17:00:00+09:00',
  },
  {
    id: 'before-opening-is-closed',
    periods: [{ open: { day: 2, time: '0900' }, close: { day: 2, time: '1700' } }],
    now: '2026-08-18T08:59:00+09:00',
  },
  {
    id: 'overnight-before-midnight',
    periods: [{ open: { day: 2, time: '2200' }, close: { day: 3, time: '0200' } }],
    now: '2026-08-18T23:30:00+09:00',
  },
  {
    id: 'overnight-after-midnight',
    periods: [{ open: { day: 2, time: '2200' }, close: { day: 3, time: '0200' } }],
    now: '2026-08-19T01:00:00+09:00',
  },
  {
    id: 'week-wrap-saturday-to-sunday',
    periods: [{ open: { day: 6, time: '2200' }, close: { day: 0, time: '0200' } }],
    now: '2026-08-23T01:00:00+09:00',
  },
  {
    id: 'multiple-periods-second-match',
    periods: [
      { open: { day: 2, time: '0900' }, close: { day: 2, time: '1200' } },
      { open: { day: 2, time: '1300' }, close: { day: 2, time: '1800' } },
    ],
    now: '2026-08-18T14:00:00+09:00',
  },
  {
    id: 'invalid-clock-is-skipped',
    periods: [{ open: { day: 2, time: '2500' }, close: { day: 2, time: '1700' } }],
    now: '2026-08-18T10:00:00+09:00',
  },
]

const rangeInputs: {
  id: string
  periods: OpeningPeriod[] | null
  now: string
}[] = [
  {
    id: 'missing-periods',
    periods: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'single-open-only-is-24-hours',
    periods: [{ open: { day: 2, time: '0000' } }],
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'multiple-ranges',
    periods: [
      { open: { day: 2, time: '0900' }, close: { day: 2, time: '1200' } },
      { open: { day: 2, time: '1300' }, close: { day: 2, time: '1730' } },
    ],
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'overnight-is-listed-on-opening-day',
    periods: [{ open: { day: 2, time: '2200' }, close: { day: 3, time: '0200' } }],
    now: '2026-08-18T23:00:00+09:00',
  },
  {
    id: 'overnight-is-not-listed-on-closing-day',
    periods: [{ open: { day: 2, time: '2200' }, close: { day: 3, time: '0200' } }],
    now: '2026-08-19T01:00:00+09:00',
  },
  {
    id: 'invalid-range-is-omitted',
    periods: [
      { open: { day: 2, time: '0900' }, close: { day: 2, time: '9960' } },
      { open: { day: 2, time: '1300' }, close: { day: 2, time: '1700' } },
    ],
    now: '2026-08-18T10:00:00+09:00',
  },
]

const weekdayInputs: {
  id: string
  weekdayText: string[] | null
  openNow: boolean | null
  now: string
}[] = [
  {
    id: 'open-now-true-wins',
    weekdayText: ['火曜日: 定休日'],
    openNow: true,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'open-now-false-wins',
    weekdayText: ['火曜日: 24時間営業'],
    openNow: false,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'missing-weekday-text',
    weekdayText: null,
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'same-day-open',
    weekdayText: ['火曜日: 9:00-17:00'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'closing-boundary-is-closed',
    weekdayText: ['火曜日: 9:00-17:00'],
    openNow: null,
    now: '2026-08-18T17:00:00+09:00',
  },
  {
    id: 'closed-japanese',
    weekdayText: ['火曜日: 定休日'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'closed-english',
    weekdayText: ['火曜日: Closed'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'all-day',
    weekdayText: ['火曜日: 24 時間営業'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'am-pm-clock',
    weekdayText: ['火曜日: 9:00 AM – 5:00 PM'],
    openNow: null,
    now: '2026-08-18T16:00:00+09:00',
  },
  {
    id: 'japanese-clock',
    weekdayText: ['火曜日: 9時30分～18時'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'overnight-open',
    weekdayText: ['水曜日: 22:00-02:00'],
    openNow: null,
    now: '2026-08-19T23:00:00+09:00',
  },
  {
    id: 'missing-today',
    weekdayText: ['月曜日: 9:00-17:00'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'malformed-clock',
    weekdayText: ['火曜日: 朝から夕方'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'midnight-to-24-clock',
    weekdayText: ['火曜日: 0:00-24:00'],
    openNow: null,
    now: '2026-08-18T23:59:00+09:00',
  },
]

const summaryInputs: {
  id: string
  weekdayText: string[] | null
  openNow: boolean | null
  now: string
}[] = [
  {
    id: 'fallback-open',
    weekdayText: null,
    openNow: true,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'fallback-closed',
    weekdayText: null,
    openNow: false,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'missing-everything',
    weekdayText: null,
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'closing-within-two-hours',
    weekdayText: ['火曜日: 9:00-17:00'],
    openNow: null,
    now: '2026-08-18T15:30:00+09:00',
  },
  {
    id: 'open-with-more-than-two-hours',
    weekdayText: ['火曜日: 9:00-17:00'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'closed-day',
    weekdayText: ['火曜日: 休業'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'after-hours',
    weekdayText: ['火曜日: 9:00-17:00'],
    openNow: null,
    now: '2026-08-18T18:00:00+09:00',
  },
  {
    id: 'overnight-does-not-show-remaining-time',
    weekdayText: ['火曜日: 22:00-02:00'],
    openNow: null,
    now: '2026-08-18T23:00:00+09:00',
  },
  {
    id: 'missing-today-ignores-open-now',
    weekdayText: ['月曜日: 9:00-17:00'],
    openNow: true,
    now: '2026-08-18T10:00:00+09:00',
  },
  {
    id: 'all-day-summary',
    weekdayText: ['火曜日: 24時間営業'],
    openNow: null,
    now: '2026-08-18T10:00:00+09:00',
  },
]

const stripYenInputs: { id: string; label: string | null }[] = [
  { id: 'null', label: null },
  { id: 'empty', label: '' },
  { id: 'whitespace', label: '   ' },
  { id: 'multiple-leading-yen', label: ' ¥¥ 2,000 ' },
  { id: 'non-leading-yen', label: '料金 ¥2,000' },
]

const priceInputs: {
  id: string
  priceLabel: string | null
  priceLevel: number | null
}[] = [
  { id: 'free-label', priceLabel: '無料', priceLevel: 4 },
  { id: 'numeric-label', priceLabel: '¥2,000 – ¥3,000', priceLevel: 1 },
  { id: 'yen-symbols-fall-back', priceLabel: '¥¥', priceLevel: 2 },
  { id: 'non-numeric-label-falls-back', priceLabel: '応相談', priceLevel: 3 },
  { id: 'normalizes-spaces-and-wave-dash', priceLabel: ' 1,000 ～ 2,000 ', priceLevel: null },
  { id: 'rounds-half-up', priceLabel: null, priceLevel: 1.5 },
  { id: 'negative-half-rounds-to-zero', priceLabel: null, priceLevel: -0.5 },
  { id: 'out-of-band', priceLabel: null, priceLevel: 4.6 },
  { id: 'missing-price', priceLabel: null, priceLevel: null },
]

const fixture = {
  schemaVersion: 1,
  source: 'lib/business-hours.ts',
  timeZone: 'Asia/Tokyo',
  openStateFromPeriods: openStateInputs.map((input) => ({
    ...input,
    expected: openStateFromPeriods(input.periods, new Date(input.now)),
  })),
  todayRangeFromPeriods: rangeInputs.map((input) => ({
    ...input,
    expected: todayRangeFromPeriods(input.periods, new Date(input.now)) as Nullable<string>,
  })),
  getSpotOpenStatus: weekdayInputs.map((input) => ({
    ...input,
    expected: atFixedNow(input.now, () =>
      getSpotOpenStatus(input.weekdayText, input.openNow)
    ),
  })),
  todayHoursSummary: summaryInputs.map((input) => ({
    ...input,
    expected: atFixedNow(input.now, () =>
      todayHoursSummary(input.weekdayText, input.openNow)
    ) as Nullable<{ label: string; tone: string }>,
  })),
  stripLeadingYen: stripYenInputs.map((input) => ({
    ...input,
    expected: stripLeadingYen(input.label) as Nullable<string>,
  })),
  formatPriceDisplay: priceInputs.map((input) => ({
    ...input,
    expected: formatPriceDisplay(input.priceLabel, input.priceLevel) as Nullable<string>,
  })),
}

const currentFile = fileURLToPath(import.meta.url)
const output = resolve(
  dirname(currentFile),
  '../swift/WanspotKit/Tests/WanspotKitTests/Fixtures/business-hours.json'
)

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`Wrote ${output}`)
