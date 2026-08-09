import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RunningDog, PowState } from '@/components/DogStates'
import { AppHeader } from '@/components/AppHeader'
import { PriceLevelMark } from '@/components/calendar/PriceLevelMark'
import { resolveEventPrefecture } from '@/lib/calendar/resolve-prefecture'
import type { AppColors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { fetchWithCache } from '@/lib/client-cache'
import { stashCalendarEvent } from '@/lib/calendar/calendar-detail-stash'
import {
  CALENDAR_DATE_COLORS,
  CALENDAR_DATE_COLORS_DARK,
  calendarDateTone,
  japanHolidaysInMonth,
} from '@/lib/calendar/japan-holidays'
import {
  jstDateKey,
  jstTimeLabel,
  type CalendarEventWithRelations,
  type CalendarMonthResponse,
} from '@/lib/calendar/types'
import { remoteImageAcceptHeaders, remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'
import { wanspotFetch } from '@/lib/wanspot-api'

const CALENDAR_MONTH_TTL_MS = 30 * 60_000
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** きょう（JST）の { year, month, dateKey } — 端末TZに依存しない */
function todayJst(): { year: number; month: number; dateKey: string } {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: m, dateKey: key }
}

function dateKeyOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 月グリッド（週ごとの配列。前後月ぶんは null） */
function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function CalendarTabScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const dateColors = isDark ? CALENDAR_DATE_COLORS_DARK : CALENDAR_DATE_COLORS
  const today = useMemo(() => todayJst(), [])

  const [year, setYear] = useState(today.year)
  const [month, setMonth] = useState(today.month)
  const [selectedKey, setSelectedKey] = useState(today.dateKey)
  const [events, setEvents] = useState<CalendarEventWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setFetchError(false)
    try {
      const { data } = await fetchWithCache(
        `calendar:month:${y}-${m}`,
        CALENDAR_MONTH_TTL_MS,
        async () => {
          const res = await wanspotFetch(`/api/calendar/events?year=${y}&month=${m}`, { auth: false })
          if (!res.ok) throw new Error(`calendar ${res.status}`)
          const json = (await res.json()) as CalendarMonthResponse
          return json.events ?? []
        }
      )
      setEvents(data)
    } catch {
      setEvents([])
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMonth(year, month)
  }, [loadMonth, year, month])

  const moveMonth = useCallback(
    (delta: number) => {
      let y = year
      let m = month + delta
      if (m < 1) {
        m = 12
        y -= 1
      } else if (m > 12) {
        m = 1
        y += 1
      }
      setYear(y)
      setMonth(m)
      setSelectedKey(dateKeyOf(y, m, 1))
    },
    [year, month]
  )

  /** JST日付キー → その日のイベント一覧（開催回で展開・重複イベントは1回） */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventWithRelations[]>()
    for (const ev of events) {
      const seen = new Set<string>()
      for (const oc of ev.occurrences ?? []) {
        const key = jstDateKey(oc.starts_at)
        if (seen.has(key)) continue
        seen.add(key)
        const list = map.get(key) ?? []
        list.push(ev)
        map.set(key, list)
      }
    }
    return map
  }, [events])

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month])
  const holidays = useMemo(() => japanHolidaysInMonth(year, month), [year, month])
  const dayEvents = eventsByDay.get(selectedKey) ?? []
  const selectedHoliday = holidays[selectedKey] ?? null
  const selectedTone = calendarDateTone(selectedKey, {
    todayKey: today.dateKey,
    holidayName: selectedHoliday,
  })
  const selectedIsPast = selectedTone === 'past'
  const selectedDay = Number(selectedKey.slice(-2))
  const selectedWeekday = WEEKDAYS[new Date(year, month - 1, selectedDay).getDay()]
  const selectedDayTitle = `${month}月${selectedDay}日（${selectedWeekday}）のイベント`

  const openDetail = useCallback(
    (ev: CalendarEventWithRelations) => {
      stashCalendarEvent(ev)
      router.push(`/calendar/${ev.slug}`)
    },
    [router]
  )

  /** その日の最初の開催回の時刻ラベル */
  const timeLabelFor = useCallback(
    (ev: CalendarEventWithRelations): string => {
      const oc = (ev.occurrences ?? []).find((o) => jstDateKey(o.starts_at) === selectedKey)
      if (!oc) return ''
      // is_all_day は時刻が分からなかったという意味。カードは幅が無いので短く出す
      return oc.is_all_day ? '時刻未記載' : jstTimeLabel(oc.starts_at)
    },
    [selectedKey]
  )

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
      >
        <View style={styles.monthHeader}>
          <Pressable style={styles.monthNavBtn} onPress={() => moveMonth(-1)} accessibilityLabel="前の月">
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {year}年{month}月
          </Text>
          <Pressable style={styles.monthNavBtn} onPress={() => moveMonth(1)} accessibilityLabel="次の月">
            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.gridCard}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text
                key={w}
                style={[
                  styles.weekday,
                  i === 0 && { color: isDark ? dateColors.sunday_or_holiday : '#D85A5A' },
                  i === 6 && { color: isDark ? dateColors.saturday : '#4E97F2' },
                ]}
              >
                {w}
              </Text>
            ))}
          </View>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day == null) return <View key={di} style={styles.dayCell} />
                const key = dateKeyOf(year, month, day)
                const dots = (eventsByDay.get(key) ?? []).slice(0, 3)
                const isSelected = key === selectedKey
                const isToday = key === today.dateKey
                const holidayName = holidays[key] ?? null
                const tone = calendarDateTone(key, { todayKey: today.dateKey, holidayName })
                const dateColor =
                  isSelected && !isToday
                    ? colors.textPrimary
                    : isToday
                      ? colors.brandDark
                      : dateColors[tone]
                return (
                  <Pressable
                    key={di}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      tone === 'past' && styles.dayCellPast,
                    ]}
                    onPress={() => setSelectedKey(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        { color: dateColor },
                        isToday && styles.dayNumToday,
                        isSelected && styles.dayNumSelected,
                      ]}
                    >
                      {day}
                    </Text>
                    {holidayName ? (
                      <Text
                        style={[
                          styles.holidayMark,
                          { color: tone === 'past' ? dateColors.past : dateColors.sunday_or_holiday },
                        ]}
                        numberOfLines={1}
                      >
                        {holidayName}
                      </Text>
                    ) : null}
                    <View style={styles.dotRow}>
                      {dots.map((ev, i) => (
                        <View
                          key={`${ev.id}-${i}`}
                          style={[
                            styles.dot,
                            {
                              backgroundColor: colors.primary,
                              opacity: tone === 'past' ? 0.45 : 1,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          ))}
        </View>

        <Text style={styles.dayListTitle}>{selectedDayTitle}</Text>

        {loading ? (
          <View style={styles.stateWrap}>
            <RunningDog label="イベントを読み込み中..." />
          </View>
        ) : fetchError ? (
          <View style={styles.stateWrap}>
            <PowState label="うまく読み込めませんでした。通信環境を確認して、もう一度お試しください。" />
          </View>
        ) : dayEvents.length === 0 && !selectedHoliday ? (
          <Text style={styles.emptyDayTxt}>この日のイベントはありません</Text>
        ) : (
          <View style={styles.dayList}>
            {selectedHoliday ? (
              <View
                style={[
                  styles.holidayBanner,
                  selectedIsPast && { opacity: 0.65, backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Text
                  style={[
                    styles.holidayBannerTxt,
                    {
                      color: selectedIsPast
                        ? dateColors.past
                        : dateColors.sunday_or_holiday,
                    },
                  ]}
                >
                  {selectedHoliday}
                </Text>
              </View>
            ) : null}
            {dayEvents.length === 0 ? (
              <Text style={styles.emptyDayTxt}>この日のイベントはありません</Text>
            ) : null}
            {dayEvents.map((ev) => {
              // 都道府県マスタを優先し、無いものは住所から読む（シート同期分は prefecture_id が空）
              const prefecture = ev.prefecture?.name ?? resolveEventPrefecture(ev)
              return (
                <Pressable
                  key={ev.id}
                  style={[styles.eventCard, selectedIsPast && { opacity: 0.55 }]}
                  onPress={() => openDetail(ev)}
                >
                  {ev.thumbnail_url ? (
                    <Image
                      // 原本は約2MBのPNG。64pxサムネなので変換配信で縮小して読む
                      source={{
                        uri: resizePlacesImageUrl(ev.thumbnail_url, 'thumbnail'),
                        headers: remoteImageAcceptHeaders,
                      }}
                      style={styles.eventThumb}
                      contentFit="cover"
                      recyclingKey={`cal-${ev.id}`}
                      {...remoteImageExpoProps}
                    />
                  ) : (
                    <View style={[styles.eventThumb, styles.eventThumbPh]}>
                      <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {ev.title}
                    </Text>
                    <Text style={styles.eventMeta} numberOfLines={1}>
                      {[timeLabelFor(ev), ev.venue_name ?? ev.region_name].filter(Boolean).join(' · ')}
                    </Text>
                    <View style={styles.eventTagRow}>
                      {prefecture ? (
                        <View style={styles.prefPill}>
                          <Text style={styles.prefPillTxt} numberOfLines={1}>
                            {prefecture}
                          </Text>
                        </View>
                      ) : null}
                      <PriceLevelMark level={ev.price_level} />
                      {(ev.tags ?? []).slice(0, 2).map((t) => (
                        <View key={t.id} style={[styles.tagPill, { borderColor: t.color }]}>
                          <Text style={styles.tagPillTxt} numberOfLines={1}>
                            {t.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  monthNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthTitle: { ...type.heading, color: colors.textPrimary },
  gridCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...type.label,
    color: colors.textSecondary,
    paddingVertical: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    minHeight: 44,
  },
  dayCellSelected: { backgroundColor: colors.tintWeak },
  dayCellPast: { opacity: 0.72 },
  // 日付はハンドオフ指定の 17/600。リスト行と同じ大きさで、数字だけ少し締める
  dayNum: { ...type.row, fontWeight: '600' as const, color: colors.textPrimary },
  dayNumToday: { fontWeight: '800' },
  dayNumSelected: { fontWeight: '800' },
  // 祝日名だけは 8px のまま。セル幅は画面幅の1/7（約47px）しかなく、
  // label(12) にすると「スポーツの日」のような名前が1文字目で切れる
  holidayMark: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '700',
    maxWidth: '100%',
    textAlign: 'center',
  },
  holidayBanner: {
    borderRadius: 12,
    backgroundColor: colors.errorMutedBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  holidayBannerTxt: { ...type.row, fontWeight: '800' as const },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 3, minHeight: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  stateWrap: { marginTop: 24, alignItems: 'center' },
  emptyDayTxt: {
    marginTop: 20,
    textAlign: 'center',
    ...type.caption,
    color: colors.textSecondary,
  },
  dayListTitle: {
    ...type.heading,
    color: colors.textPrimary,
    marginTop: 16,
    marginHorizontal: 20,
  },
  dayList: { marginTop: 10, paddingHorizontal: 20, gap: 10 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  eventThumb: { width: 72, height: 72, borderRadius: 12 },
  eventThumbPh: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: { flex: 1, gap: 3 },
  eventTitle: { ...type.row, fontWeight: '700' as const, color: colors.textPrimary },
  eventMeta: { ...type.caption, color: colors.textSecondary },
  eventTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  tagPillTxt: { ...type.label, color: colors.textSecondary },
  /** 都道府県。ジャンルタグと並ぶが「どこでやるか」は性質が違うので塗りで区別する */
  prefPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.tintWeak,
  },
  prefPillTxt: { ...type.label, color: colors.primary },
})
