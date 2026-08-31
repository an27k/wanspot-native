import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import holidayJp from '@holiday-jp/holiday_jp'

import {
  ARTICLE_GENRE_CHIPS,
  eventRoundupMonthKey,
  parseArticleTheme,
} from '../lib/articles/article-theme'
import {
  calendarDateTone,
  formatJapanHolidayName,
  japanHolidayName,
} from '../lib/calendar/japan-holidays'
import { prefectureFromAddress, resolveEventPrefecture } from '../lib/calendar/resolve-prefecture'
import {
  jstDateKey,
  jstTimeLabel,
  occurrenceLabel,
  type CalendarEventOccurrence,
} from '../lib/calendar/types'

const themeInputs: { id: string; theme: string | null }[] = [
  { id: 'missing', theme: null },
  { id: 'trimmed-area-cafe', theme: '  【東京都】カフェおすすめ  ' },
  { id: 'event-job-theme-without-brackets', theme: '2026-08 関東 イベント' },
  { id: 'dog-run-spelling-variation', theme: '【横浜】ドックラン特集' },
  { id: 'hotel-wins-before-onsen', theme: '【箱根】温泉宿まとめ' },
  { id: 'area-with-unknown-genre', theme: '【湘南】愛犬との休日' },
  { id: 'no-area-indoor', theme: '雨の日に行ける屋内施設' },
]

const monthInputs = [
  {
    id: 'slug-wins',
    title: '【2025年1月】古い表示',
    slug: 'events-2026-08-kanto',
    theme: '2026-09 関東 イベント',
  },
  {
    id: 'theme-fallback',
    title: 'イベントまとめ',
    slug: 'other',
    theme: '2026-09 関西 イベント',
  },
  {
    id: 'title-fallback-pads-month',
    title: '【2027年2月】イベントまとめ',
    slug: 'other',
    theme: 'イベント',
  },
  {
    id: 'leading-space-slug-does-not-match',
    title: '【2027年3月】イベントまとめ',
    slug: ' events-2026-01-kanto',
    theme: '2026-10 関東 イベント',
  },
  {
    id: 'missing-month',
    title: 'イベントまとめ',
    slug: 'other',
    theme: 'イベント',
  },
]

const eventOrderInputs = [
  { id: 'unknown', title: '未定イベント', slug: 'other', theme: 'イベント' },
  { id: 'sep-b', title: 'びわ湖イベント', slug: 'events-2026-09-kansai', theme: null },
  { id: 'aug', title: '東京イベント', slug: 'events-2026-08-kanto', theme: null },
  { id: 'sep-a', title: '愛犬イベント', slug: 'events-2026-09-kanto', theme: null },
]

const dateInputs = [
  { id: 'utc-crosses-into-next-jst-day', iso: '2026-08-18T15:30:00Z' },
  { id: 'offset-crosses-back-to-jst-day', iso: '2026-08-19T01:15:00-07:00' },
  { id: 'fractional-seconds', iso: '2026-12-31T23:59:59.123+09:00' },
]

const occurrenceInputs: { id: string; occurrence: CalendarEventOccurrence }[] = [
  {
    id: 'all-day-means-time-unlisted',
    occurrence: {
      id: 'o1',
      event_id: 'e1',
      starts_at: '2026-08-23T00:00:00+09:00',
      ends_at: null,
      is_all_day: true,
    },
  },
  {
    id: 'timed-with-end',
    occurrence: {
      id: 'o2',
      event_id: 'e1',
      starts_at: '2026-08-23T10:00:00+09:00',
      ends_at: '2026-08-23T16:30:00+09:00',
      is_all_day: false,
    },
  },
  {
    id: 'timed-without-end',
    occurrence: {
      id: 'o3',
      event_id: 'e1',
      starts_at: '2026-08-24T09:05:00+09:00',
      ends_at: null,
      is_all_day: false,
    },
  },
]

const toneInputs = [
  { id: 'past-overrides-sunday', dateKey: '2026-08-16', todayKey: '2026-08-19', holidayName: null },
  { id: 'future-saturday', dateKey: '2026-08-22', todayKey: '2026-08-19', holidayName: null },
  { id: 'future-sunday', dateKey: '2026-08-23', todayKey: '2026-08-19', holidayName: null },
  { id: 'weekday-holiday', dateKey: '2026-09-21', todayKey: '2026-08-19', holidayName: '敬老の日' },
  { id: 'plain-weekday', dateKey: '2026-08-20', todayKey: '2026-08-19', holidayName: null },
]

const holidayFormatInputs = [
  { id: 'citizens-holiday-ja', entry: { name: '休日', name_en: '' } },
  { id: 'citizens-holiday-en', entry: { name: 'Holiday', name_en: "Citizen's Holiday" } },
  { id: 'substitute', entry: { name: '振替休日', name_en: 'Substitute Holiday' } },
  { id: 'named-substitute-stays-verbatim', entry: { name: 'こどもの日 振替休日', name_en: '' } },
]

const prefectureInputs = [
  { id: 'postal-prefix', address: '日本、〒238-0316 神奈川県横須賀市長井２丁目１４−１' },
  { id: 'venue-fallback', address: null, venueName: '大阪府営 深北緑地' },
  { id: 'address-wins-over-venue', address: '東京都渋谷区', venueName: '京都府アンテナショップ' },
  { id: 'unknown-is-null', address: '海外会場', venueName: 'オンライン' },
]

function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  return weeks
}

const orderedEvents = [...eventOrderInputs].sort((a, b) => {
  const am = eventRoundupMonthKey(a) ?? '9999-99'
  const bm = eventRoundupMonthKey(b) ?? '9999-99'
  if (am !== bm) return am.localeCompare(bm)
  return a.title.localeCompare(b.title, 'ja')
})

const fixture = {
  schemaVersion: 1,
  sources: [
    'lib/articles/article-theme.ts',
    'components/articles/ArticlesTabScreen.tsx',
    'lib/calendar/types.ts',
    'lib/calendar/japan-holidays.ts',
    'lib/calendar/resolve-prefecture.ts',
    'components/calendar/CalendarTabScreen.tsx',
  ],
  articles: {
    themes: themeInputs.map((input) => ({
      ...input,
      expected: parseArticleTheme(input.theme),
    })),
    monthKeys: monthInputs.map((input) => ({
      ...input,
      expected: eventRoundupMonthKey(input),
    })),
    eventOrder: {
      articles: eventOrderInputs,
      expectedIds: orderedEvents.map((article) => article.id),
    },
    availableGenreOrder: {
      themes: ['【東京】ホテル', '【東京】カフェ', '2026-08 関東 イベント', '【東京】公園'],
      expected: ARTICLE_GENRE_CHIPS
        .filter((chip) =>
          ['【東京】ホテル', '【東京】カフェ', '2026-08 関東 イベント', '【東京】公園']
            .map((theme) => parseArticleTheme(theme).genre)
            .includes(chip.key)
        )
        .map((chip) => chip.key),
    },
  },
  calendar: {
    dates: dateInputs.map((input) => ({
      ...input,
      expectedDateKey: jstDateKey(input.iso),
      expectedTimeLabel: jstTimeLabel(input.iso),
    })),
    occurrences: occurrenceInputs.map((input) => ({
      ...input,
      expected: occurrenceLabel(input.occurrence),
    })),
    tones: toneInputs.map((input) => ({
      ...input,
      expected: calendarDateTone(input.dateKey, {
        todayKey: input.todayKey,
        holidayName: input.holidayName,
      }),
    })),
    holidayFormats: holidayFormatInputs.map((input) => ({
      ...input,
      expected: formatJapanHolidayName(input.entry),
    })),
    knownHoliday: {
      dateKey: '2026-01-01',
      expected: japanHolidayName('2026-01-01'),
    },
    prefectures: prefectureInputs.map((input) => ({
      ...input,
      expectedFromAddress: prefectureFromAddress(input.address),
      expectedResolved: resolveEventPrefecture({
        address: input.address,
        venue_name: input.venueName,
      }),
    })),
    monthGrids: [
      { id: 'starts-sunday', year: 2026, month: 2 },
      { id: 'six-week-month', year: 2026, month: 8 },
      { id: 'leap-february', year: 2028, month: 2 },
    ].map((input) => ({
      ...input,
      expected: buildMonthGrid(input.year, input.month),
    })),
  },
}

const currentFile = fileURLToPath(import.meta.url)
const output = resolve(
  dirname(currentFile),
  '../swift/WanspotKit/Tests/WanspotKitTests/Fixtures/content-domain.json'
)

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`Wrote ${output}`)

const holidayTable = Object.fromEntries(
  Object.entries(
    holidayJp.holidays as unknown as Record<string, { name: string; name_en?: string }>
  )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, entry]) => [dateKey, formatJapanHolidayName(entry)])
)
const holidayOutput = resolve(
  dirname(currentFile),
  '../swift/WanspotKit/Sources/WanspotKit/Resources/japan-holidays.json'
)
mkdirSync(dirname(holidayOutput), { recursive: true })
writeFileSync(holidayOutput, `${JSON.stringify(holidayTable, null, 2)}\n`)
console.log(`Wrote ${holidayOutput}`)
