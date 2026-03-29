import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Line, Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/AppHeader'
import { EventCard, type WanspotEventRow } from '@/components/events/EventCard'
import { PowState, RunningDog } from '@/components/DogStates'
import { IconPaw } from '@/components/IconPaw'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { EXTERNAL_EVENTS_EMPTY_FALLBACK } from '@/lib/external-events-fallback'
import { supabase } from '@/lib/supabase'
import { wanspotFetch } from '@/lib/wanspot-api'

type ExternalEventLink = { label: string; url: string }

type ExternalEvent = {
  id?: string
  title: string
  description: string | null
  event_at: string | null
  location_name: string | null
  area: string | null
  url: string | null
  source: string | null
  links?: ExternalEventLink[] | null
}

function externalEventDetailLinks(ev: ExternalEvent): ExternalEventLink[] {
  if (Array.isArray(ev.links)) {
    const out: ExternalEventLink[] = []
    for (const l of ev.links) {
      if (!l || typeof l !== 'object') continue
      const url = typeof l.url === 'string' && l.url.startsWith('http') ? l.url : null
      if (!url) continue
      const label = typeof l.label === 'string' && l.label.trim() ? l.label.trim() : '詳細'
      out.push({ label, url })
    }
    if (out.length > 0) return out
  }
  if (ev.url && ev.url.startsWith('http')) {
    const label = ev.source?.trim() || '詳細ページ'
    return [{ label, url: ev.url }]
  }
  return []
}

const IconPlusLarge = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round">
    <Line x1={12} y1={5} x2={12} y2={19} />
    <Line x1={5} y1={12} x2={19} y2={12} />
  </Svg>
)

const IconSort = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
    <Line x1={3} y1={6} x2={21} y2={6} />
    <Line x1={3} y1={12} x2={15} y2={12} />
    <Line x1={3} y1={18} x2={9} y2={18} />
  </Svg>
)

const IconCalendar = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round">
    <Path d="M7 3v4M17 3v4M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
  </Svg>
)

const IconPin = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <Path d="M12 10h.01" />
  </Svg>
)

const IconExternalLink = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round">
    <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
  </Svg>
)

type WanspotSort = 'event_at' | 'price_asc' | 'price_desc' | 'participants'

const WANSPOT_SORT_OPTIONS: { value: WanspotSort; label: string }[] = [
  { value: 'event_at', label: '開催日順' },
  { value: 'price_asc', label: '価格が低い順' },
  { value: 'price_desc', label: '価格が高い順' },
  { value: 'participants', label: '参加人数順' },
]

function eventAtTime(ev: WanspotEventRow): number {
  if (!ev.event_at) return Number.POSITIVE_INFINITY
  const t = new Date(ev.event_at).getTime()
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

function sortEvents(list: WanspotEventRow[], sort: WanspotSort): WanspotEventRow[] {
  const copy = [...list]
  copy.sort((a, b) => {
    if (sort === 'event_at') return eventAtTime(a) - eventAtTime(b)
    if (sort === 'price_asc') {
      const pa = a.price != null && Number.isFinite(a.price) ? a.price : Number.POSITIVE_INFINITY
      const pb = b.price != null && Number.isFinite(b.price) ? b.price : Number.POSITIVE_INFINITY
      return pa - pb
    }
    if (sort === 'price_desc') {
      const na = a.price != null && Number.isFinite(a.price)
      const nb = b.price != null && Number.isFinite(b.price)
      if (!na && !nb) return 0
      if (!na) return 1
      if (!nb) return -1
      return (b.price ?? 0) - (a.price ?? 0)
    }
    const ca = Number(a.current_count ?? 0)
    const cb = Number(b.current_count ?? 0)
    return cb - ca
  })
  return copy
}

function externalEventAtTime(ev: ExternalEvent): number {
  if (!ev.event_at) return Number.POSITIVE_INFINITY
  const t = new Date(ev.event_at).getTime()
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

function sortExternalEvents(list: ExternalEvent[], sort: WanspotSort): ExternalEvent[] {
  const copy = [...list]
  copy.sort((a, b) => {
    const ta = externalEventAtTime(a)
    const tb = externalEventAtTime(b)
    if (sort === 'price_desc') return tb - ta || a.title.localeCompare(b.title, 'ja')
    return ta - tb || a.title.localeCompare(b.title, 'ja')
  })
  return copy
}

export default function EventsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [events, setEvents] = useState<WanspotEventRow[]>([])
  const [joinedEvents, setJoinedEvents] = useState<WanspotEventRow[]>([])
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [joinedLoading, setJoinedLoading] = useState(true)
  const [externalLoading, setExternalLoading] = useState(true)
  const [tab, setTab] = useState<'scheduled' | 'joined' | 'external'>('scheduled')
  const [eventSort, setEventSort] = useState<WanspotSort>('event_at')
  const [showSort, setShowSort] = useState(false)
  const [showVaccineBanner, setShowVaccineBanner] = useState(false)
  const [fabMenuOpen, setFabMenuOpen] = useState(false)
  const [externalError, setExternalError] = useState(false)
  const [eventsContentW, setEventsContentW] = useState(() => Dimensions.get('window').width)

  const fabRotate = useRef(new Animated.Value(0)).current
  const fabScale = useRef(new Animated.Value(1)).current
  const fabMenuAnim = useRef(new Animated.Value(0)).current
  const tabSlideX = useRef(new Animated.Value(0)).current

  const fetchExternalEvents = useCallback(() => {
    setExternalLoading(true)
    setExternalEvents([])
    setExternalError(false)
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 15_000)
    wanspotFetch('/api/events/external', { signal: ac.signal })
      .then(async (r) => {
        let data: { events?: unknown; error?: string } = {}
        try {
          data = (await r.json()) as { events?: unknown; error?: string }
        } catch {
          /* ignore */
        }
        if (!r.ok) {
          setExternalError(true)
          setExternalLoading(false)
          return
        }
        let list = Array.isArray(data.events) ? data.events : []
        // 本番が旧APIのまま「空キャッシュをTTL内で返す」等で [] になる場合の表示用
        if (list.length === 0) {
          list = EXTERNAL_EVENTS_EMPTY_FALLBACK as ExternalEvent[]
        }
        setExternalEvents(list as ExternalEvent[])
        setExternalLoading(false)
      })
      .catch(() => {
        setExternalError(true)
        setExternalLoading(false)
      })
      .finally(() => clearTimeout(t))
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: eventsData } = await supabase.from('events').select('*').order('event_at', { ascending: true })
      setEvents((eventsData ?? []) as WanspotEventRow[])
      setLoading(false)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setJoinedEvents([])
        setJoinedLoading(false)
        setShowVaccineBanner(false)
        return
      }
      const { data: dogRow } = await supabase
        .from('dogs')
        .select('rabies_vaccinated_at, vaccine_vaccinated_at')
        .eq('user_id', user.id)
        .maybeSingle()
      setShowVaccineBanner(
        !!dogRow && (dogRow.rabies_vaccinated_at == null || dogRow.vaccine_vaccinated_at == null)
      )
      const { data: parts } = await supabase.from('event_participants').select('event_id').eq('user_id', user.id)
      const ids = [...new Set((parts ?? []).map((p) => p.event_id))]
      if (ids.length === 0) {
        setJoinedEvents([])
        setJoinedLoading(false)
        return
      }
      const { data: joinedData } = await supabase
        .from('events')
        .select('*')
        .in('id', ids)
        .order('event_at', { ascending: true })
      setJoinedEvents((joinedData ?? []) as WanspotEventRow[])
      setJoinedLoading(false)
    }
    void load()
    fetchExternalEvents()
  }, [fetchExternalEvents])

  useEffect(() => {
    if (tab !== 'scheduled') setFabMenuOpen(false)
  }, [tab])

  useEffect(() => {
    if (showSort) setFabMenuOpen(false)
  }, [showSort])

  useEffect(() => {
    Animated.spring(fabRotate, {
      toValue: fabMenuOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 56,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    }).start()
  }, [fabMenuOpen, fabRotate])

  useEffect(() => {
    Animated.spring(fabMenuAnim, {
      toValue: fabMenuOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 10,
      tension: 70,
    }).start()
  }, [fabMenuOpen, fabMenuAnim])

  useEffect(() => {
    if (eventsContentW <= 0) return
    const idx = tab === 'scheduled' ? 0 : tab === 'joined' ? 1 : 2
    Animated.spring(tabSlideX, {
      toValue: -idx * eventsContentW,
      useNativeDriver: true,
      friction: 14,
      tension: 68,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    }).start()
  }, [tab, eventsContentW, tabSlideX])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const sortedWanspotEvents = useMemo(() => sortEvents(events, eventSort), [events, eventSort])
  const sortedJoinedEvents = useMemo(() => sortEvents(joinedEvents, eventSort), [joinedEvents, eventSort])
  const sortedExternalEvents = useMemo(() => sortExternalEvents(externalEvents, eventSort), [externalEvents, eventSort])
  const currentSort = WANSPOT_SORT_OPTIONS.find((o) => o.value === eventSort)!

  /** リスト末尾がFABに隠れないよう（コンテンツ領域は既にタブバー上まで） */
  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 100
  const fabRight = 16 + insets.right
  /** コンテンツ下端＝タブバー直上のため、タブ高は足さない（下に空きができる） */
  const fabBottom = 10
  const fabMenuBottom = fabBottom + 56 + 10

  const fabIconSpin = fabRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  })
  const menuOpacity = fabMenuAnim
  const menuTranslateY = fabMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  })
  const menuScale = fabMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  })
  const overlayOpacity = fabMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  const onFabPressIn = () => {
    Animated.spring(fabScale, {
      toValue: 0.9,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start()
  }
  const onFabPressOut = () => {
    Animated.spring(fabScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 140,
    }).start()
  }

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.subHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsInner}>
          <Pressable
            onPress={() => setTab('scheduled')}
            style={[styles.eventTabChip, tab === 'scheduled' ? styles.eventTabChipOn : styles.eventTabChipOff]}
          >
            <Text style={[styles.eventTabTxt, tab === 'scheduled' ? styles.eventTabTxtOn : styles.eventTabTxtOff]}>開催予定</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('joined')}
            style={[styles.eventTabChip, tab === 'joined' ? styles.eventTabChipOn : styles.eventTabChipOff]}
          >
            <Text style={[styles.eventTabTxt, tab === 'joined' ? styles.eventTabTxtOn : styles.eventTabTxtOff]}>参加予定</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('external')}
            style={[styles.eventTabChip, tab === 'external' ? styles.eventTabChipOn : styles.eventTabChipOff]}
          >
            <Text style={[styles.eventTabTxt, tab === 'external' ? styles.eventTabTxtOn : styles.eventTabTxtOff]}>外部イベント</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.sortWrap}>
          <Pressable style={styles.sortBtn} onPress={() => setShowSort(true)}>
            <IconSort />
            <Text style={styles.sortBtnTxt}>{currentSort.label}</Text>
          </Pressable>
        </View>
      </View>

      {showVaccineBanner ? (
        <View style={styles.bannerPad}>
          <View style={styles.vBanner}>
            <Text style={styles.vBannerTxt}>🐾 ワクチン接種日を登録するとイベントに参加できます</Text>
            <Pressable style={styles.vBannerBtn} onPress={() => router.push('/(tabs)/mypage')}>
              <Text style={styles.vBannerBtnTxt}>接種日を登録 →</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View
        style={styles.eventsPagerHost}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width
          if (w > 0 && w !== eventsContentW) setEventsContentW(w)
        }}
      >
        <Animated.View
          style={[
            styles.eventsPagerRow,
            {
              width: eventsContentW * 3,
              transform: [{ translateX: tabSlideX }],
            },
          ]}
        >
          <View style={[styles.eventsPage, { width: eventsContentW }]}>
            {loading ? (
              <RunningDog label="イベントを読み込み中..." />
            ) : events.length === 0 ? (
              <View style={styles.emptyBlock}>
                <PowState label="現在開催中のイベントはありません" />
                <Text style={styles.emptyHint}>右下の＋からイベントを作成できます</Text>
              </View>
            ) : (
              <FlatList
                data={sortedWanspotEvents}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 16 }}
                refreshControl={
                  <RefreshControl
                    refreshing={false}
                    onRefresh={async () => {
                      const { data } = await supabase.from('events').select('*').order('event_at', { ascending: true })
                      setEvents((data ?? []) as WanspotEventRow[])
                    }}
                  />
                }
                renderItem={({ item }) => (
                  <EventCard event={item} onPressDetail={() => router.push(`/events/${item.id}`)} />
                )}
              />
            )}
          </View>
          <View style={[styles.eventsPage, { width: eventsContentW }]}>
            {joinedLoading ? (
              <RunningDog label="参加予定のイベントを読み込み中..." />
            ) : joinedEvents.length === 0 ? (
              <View style={styles.emptyJoined}>
                <IconPaw size={40} color="#aaa" />
                <Text style={styles.emptyJoinedTxt}>参加予定のイベントはありません</Text>
              </View>
            ) : (
              <FlatList
                data={sortedJoinedEvents}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 16 }}
                renderItem={({ item }) => (
                  <EventCard event={item} variant="joined" onPressDetail={() => router.push(`/events/${item.id}`)} />
                )}
              />
            )}
          </View>
          <View style={[styles.eventsPage, { width: eventsContentW }]}>
            {externalLoading ? (
              <RunningDog label="外部イベントを読み込み中..." />
            ) : externalError ? (
              <View style={styles.emptyJoined}>
                <IconPaw size={40} color="#aaa" />
                <Text style={styles.extErrTxt}>しばらくしてから再度お試しください</Text>
                <Pressable style={styles.retryBtn} onPress={fetchExternalEvents}>
                  <Text style={styles.retryTxt}>再読み込み</Text>
                </Pressable>
              </View>
            ) : externalEvents.length === 0 ? (
              <View style={styles.emptyJoined}>
                <IconPaw size={40} color="#aaa" />
                <Text style={styles.extErrTxt}>外部イベントが見つかりませんでした</Text>
                <Pressable style={styles.retryBtn} onPress={fetchExternalEvents}>
                  <Text style={styles.retryTxt}>再読み込み</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={sortedExternalEvents}
                keyExtractor={(item, index) => (item.id ? String(item.id) : `ext-${index}`)}
                contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 16 }}
                renderItem={({ item }) => {
                  const detailLinks = externalEventDetailLinks(item)
                  return (
                    <View style={styles.extCard}>
                      <View style={styles.extHead}>
                        {item.source ? (
                          <View style={styles.srcPill}>
                            <Text style={styles.srcTxt}>{item.source}</Text>
                          </View>
                        ) : (
                          <View />
                        )}
                        {item.area ? <Text style={styles.areaTxt}>{item.area}</Text> : null}
                      </View>
                      <View style={styles.extBody}>
                        <Text style={styles.extTitle}>{item.title}</Text>
                        {item.description ? <Text style={styles.extDesc}>{item.description}</Text> : null}
                        <View style={styles.extMeta}>
                          {item.event_at ? (
                            <View style={styles.metaLine}>
                              <IconCalendar />
                              <Text style={styles.metaSmall}>{formatDate(item.event_at)}</Text>
                            </View>
                          ) : null}
                          {item.location_name ? (
                            <View style={styles.metaLine}>
                              <IconPin />
                              <Text style={styles.metaSmall}>{item.location_name}</Text>
                            </View>
                          ) : null}
                        </View>
                        {detailLinks.length > 0 ? (
                          <View style={styles.extLinksWrap}>
                            {detailLinks.map((link) => (
                              <Pressable
                                key={link.url}
                                style={styles.extLink}
                                onPress={() => Linking.openURL(link.url)}
                              >
                                <IconExternalLink />
                                <Text style={styles.extLinkTxt}> {link.label}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )
                }}
              />
            )}
          </View>
        </Animated.View>
      </View>

      <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
        <Pressable style={styles.modalRoot} onPress={() => setShowSort(false)}>
          <View style={styles.sortMenu}>
            {WANSPOT_SORT_OPTIONS.map(({ value, label }) => {
              const active = eventSort === value
              return (
                <Pressable
                  key={value}
                  style={[styles.sortItem, active && styles.sortItemOn]}
                  onPress={() => {
                    setEventSort(value)
                    setShowSort(false)
                  }}
                >
                  <Text style={[styles.sortItemTxt, active && styles.sortItemTxtOn]}>
                    {label}
                    {active ? ' ✓' : ''}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Modal>

      {tab === 'scheduled' ? (
        <Animated.View
          pointerEvents={fabMenuOpen ? 'auto' : 'none'}
          style={[styles.fabOverlayAnim, { opacity: overlayOpacity }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFabMenuOpen(false)} />
        </Animated.View>
      ) : null}

      {tab === 'scheduled' ? (
        <Animated.View
          pointerEvents={fabMenuOpen ? 'auto' : 'none'}
          style={[
            styles.fabMenu,
            {
              bottom: fabMenuBottom,
              right: fabRight,
              opacity: menuOpacity,
              transform: [{ translateY: menuTranslateY }, { scale: menuScale }],
            },
          ]}
        >
          <Pressable
            style={styles.fabMenuPrimary}
            onPress={() => {
              setFabMenuOpen(false)
              router.push('/events/new')
            }}
          >
            <Text style={styles.fabMenuPrimaryTxt}>新規作成</Text>
          </Pressable>
          <Pressable
            style={styles.fabMenuSec}
            onPress={() => {
              setFabMenuOpen(false)
              router.push('/mypage/events')
            }}
          >
            <Text style={styles.fabMenuSecTxt}>イベントを編集</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {tab === 'scheduled' ? (
        <Pressable
          style={[styles.fab, { bottom: fabBottom, right: fabRight }]}
          onPress={() => setFabMenuOpen((o) => !o)}
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
        >
          <Animated.View style={{ transform: [{ scale: fabScale }, { rotate: fabIconSpin }] }}>
            <IconPlusLarge />
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  tabsScroll: { flex: 1, marginRight: 8 },
  /** サブヘッダー内でタブ行を縦方向中央に（並び替えボタンと高さ揃え） */
  tabsInner: { flexDirection: 'row', alignItems: 'center', gap: 8, flexGrow: 1 },
  /** 現在地ジャンル（genreChip）と同形状：未選択グレー、選択のみ黄 */
  eventTabChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  eventTabChipOn: { backgroundColor: '#FFD84D' },
  eventTabChipOff: { backgroundColor: '#f5f5f5' },
  eventTabTxt: { fontSize: 12, fontWeight: '800' },
  eventTabTxtOn: { color: '#1a1a1a' },
  eventTabTxtOff: { color: '#888' },
  sortWrap: { justifyContent: 'center' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
  },
  sortBtnTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  bannerPad: { paddingHorizontal: 16, paddingTop: 12 },
  vBanner: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFF9E0',
    borderWidth: 1,
    borderColor: '#e8c84a',
    gap: 8,
  },
  vBannerTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a', lineHeight: 18 },
  vBannerBtn: {
    alignSelf: 'stretch',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFD84D',
    borderWidth: 1,
    borderColor: '#e8c84a',
    alignItems: 'center',
  },
  vBannerBtnTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  emptyBlock: { paddingTop: 48, alignItems: 'center' },
  emptyHint: { marginTop: 12, fontSize: 12, color: '#aaa', textAlign: 'center' },
  emptyJoined: { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyJoinedTxt: { fontSize: 14, color: '#aaa' },
  extErrTxt: { fontSize: 14, color: '#aaa', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f5f5f5' },
  retryTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  extCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb' },
  extHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  srcPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#f5f5f5' },
  srcTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  areaTxt: { fontSize: 12, color: '#aaa' },
  extBody: { padding: 16 },
  extTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  extDesc: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 8 },
  extMeta: { gap: 6, marginBottom: 12 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaSmall: { fontSize: 12, color: '#888' },
  extLinksWrap: { gap: 8 },
  extLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  extLinkTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 120, paddingRight: 16 },
  sortMenu: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', minWidth: 160, overflow: 'hidden' },
  sortItem: { paddingHorizontal: 16, paddingVertical: 12 },
  sortItemOn: { backgroundColor: '#FFF9E0' },
  sortItemTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  sortItemTxtOn: { color: '#1a1a1a' },
  fabOverlayAnim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 38 },
  fabMenu: { position: 'absolute', zIndex: 42, width: 280, maxWidth: '100%', gap: 8 },
  eventsPagerHost: { flex: 1, overflow: 'hidden' },
  eventsPagerRow: { flexDirection: 'row', flex: 1 },
  eventsPage: { flex: 1 },
  fabMenuPrimary: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  fabMenuPrimaryTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  fabMenuSec: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ebebeb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  fabMenuSecTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  fab: {
    position: 'absolute',
    zIndex: 44,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8c84a',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
})
