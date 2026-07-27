import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RunningDog, PowState } from '@/components/DogStates'
import { GoogleHomeBackground } from '@/components/search/GoogleHomeBackground'
import { BrandTabHeader } from '@/components/common/BrandTabHeader'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { useTabBarScroll } from '@/hooks/useTabBarScroll'
import Animated from 'react-native-reanimated'
import { fetchWithCache } from '@/lib/client-cache'
import { stashCalendarEvent } from '@/lib/calendar/calendar-detail-stash'
import {
  jstDateKey,
  jstTimeLabel,
  priceRankLabel,
  type CalendarEventWithRelations,
  type CalendarMonthResponse,
} from '@/lib/calendar/types'
import { remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
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
  const tabBarScrollHandler = useTabBarScroll()
  const today = useMemo(todayJst, [])

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
  const dayEvents = eventsByDay.get(selectedKey) ?? []

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
      return oc.is_all_day ? '終日' : jstTimeLabel(oc.starts_at)
    },
    [selectedKey]
  )

  return (
    <GoogleHomeBackground>
      <Animated.ScrollView
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
      >
        <BrandTabHeader />

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
                style={[styles.weekday, i === 0 && { color: '#D85A5A' }, i === 6 && { color: '#4E97F2' }]}
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
                return (
                  <Pressable
                    key={di}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    onPress={() => setSelectedKey(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && styles.dayNumToday,
                        isSelected && styles.dayNumSelected,
                      ]}
                    >
                      {day}
                    </Text>
                    <View style={styles.dotRow}>
                      {dots.map((ev, i) => (
                        <View
                          key={`${ev.id}-${i}`}
                          style={[styles.dot, { backgroundColor: ev.tags?.[0]?.color || colors.primary }]}
                        />
                      ))}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          ))}
        </View>

        {loading ? (
          <View style={styles.stateWrap}>
            <RunningDog label="イベントを読み込み中..." />
          </View>
        ) : fetchError ? (
          <View style={styles.stateWrap}>
            <PowState label="うまく読み込めませんでした。通信環境を確認して、もう一度お試しください。" />
          </View>
        ) : dayEvents.length === 0 ? (
          <Text style={styles.emptyDayTxt}>この日のイベントはありません</Text>
        ) : (
          <View style={styles.dayList}>
            {dayEvents.map((ev) => {
              const price = priceRankLabel(ev.price_level)
              return (
                <Pressable key={ev.id} style={styles.eventCard} onPress={() => openDetail(ev)}>
                  {ev.thumbnail_url ? (
                    <Image
                      source={{ uri: ev.thumbnail_url }}
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
                      {price ? (
                        <View style={[styles.pricePill, price === '無料' && styles.pricePillFree]}>
                          <Text style={[styles.pricePillTxt, price === '無料' && styles.pricePillTxtFree]}>
                            {price}
                          </Text>
                        </View>
                      ) : null}
                      {(ev.tags ?? []).slice(0, 2).map((t) => (
                        <View key={t.id} style={[styles.tagPill, { borderColor: t.color }]}>
                          <Text style={styles.tagPillTxt} numberOfLines={1}>
                            {t.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </Pressable>
              )
            })}
          </View>
        )}
      </Animated.ScrollView>
    </GoogleHomeBackground>
  )
}

const styles = StyleSheet.create({

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  monthNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthTitle: { fontSize: 17, fontWeight: '800', color: GOOGLE_HOME.textPrimary },
  gridCard: {
    marginHorizontal: 16,
    backgroundColor: colors.background,
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
    fontSize: 11,
    fontWeight: '700',
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
  dayCellSelected: { backgroundColor: colors.tintStrong },
  dayNum: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  dayNumToday: { color: colors.brandDark, fontWeight: '900' },
  dayNumSelected: { fontWeight: '900' },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 3, minHeight: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  stateWrap: { marginTop: 24, alignItems: 'center' },
  emptyDayTxt: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 13,
    color: GOOGLE_HOME.textSecondary,
  },
  dayList: { marginTop: 12, paddingHorizontal: 16, gap: 10 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  eventThumb: { width: 64, height: 64, borderRadius: 12 },
  eventThumbPh: {
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 19 },
  eventMeta: { fontSize: 12, color: colors.textSecondary },
  eventTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pricePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.tintWeak,
  },
  pricePillFree: { backgroundColor: '#F0FDF4' },
  pricePillTxt: { fontSize: 11, fontWeight: '800', color: colors.pillText },
  pricePillTxtFree: { color: '#2FA56A' },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  tagPillTxt: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
})
