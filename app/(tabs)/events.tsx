import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import Svg, { Line, Path } from 'react-native-svg'
import { AppHeader } from '@/components/AppHeader'
import { AiPlanTab } from '@/components/ai-plan/AiPlanTab'
import { EventCard, type WanspotEventRow } from '@/components/events/EventCard'
import { PowState, RunningDog } from '@/components/DogStates'
import { IconPaw } from '@/components/IconPaw'
import { colors } from '@/constants/colors'
import { supabase } from '@/lib/supabase'

const IconPlusLarge = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#2b2a28" strokeWidth={2.5} strokeLinecap="round">
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

/** 参加予定: 埋め込み select でイベントを一括取得（RLS／.in 制限の回避）。失敗時は event_id 経由にフォールバック */
async function fetchJoinedEventsList(userId: string): Promise<WanspotEventRow[]> {
  const { data: embedded, error: embErr } = await supabase
    .from('event_participants')
    .select('events(*)')
    .eq('user_id', userId)
  if (!embErr && embedded && embedded.length > 0) {
    const acc: WanspotEventRow[] = []
    const seen = new Set<string>()
    for (const row of embedded) {
      const raw = row.events as WanspotEventRow | WanspotEventRow[] | null | undefined
      const ev = Array.isArray(raw) ? raw[0] : raw
      if (ev && typeof ev === 'object' && 'id' in ev && typeof (ev as WanspotEventRow).id === 'string') {
        const id = (ev as WanspotEventRow).id
        if (!seen.has(id)) {
          seen.add(id)
          acc.push(ev as WanspotEventRow)
        }
      }
    }
    if (acc.length > 0) {
      acc.sort((a, b) => eventAtTime(a) - eventAtTime(b))
      return acc
    }
  }
  const { data: parts } = await supabase.from('event_participants').select('event_id').eq('user_id', userId)
  const ids = [
    ...new Set(
      (parts ?? [])
        .map((p) => p.event_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ]
  if (ids.length === 0) return []
  const { data: joinedData } = await supabase
    .from('events')
    .select('*')
    .in('id', ids)
    .order('event_at', { ascending: true })
  return (joinedData ?? []) as WanspotEventRow[]
}

export default function EventsTab() {
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  const [events, setEvents] = useState<WanspotEventRow[]>([])
  const [joinedEvents, setJoinedEvents] = useState<WanspotEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [joinedLoading, setJoinedLoading] = useState(true)
  const [tab, setTab] = useState<'ai_plan' | 'scheduled' | 'joined'>('ai_plan')
  /** AI プラン結果画面ではイベントタブのサブタブ＋並び替えを隠す */
  const [aiPlanChromeVisible, setAiPlanChromeVisible] = useState(true)
  const [eventSort, setEventSort] = useState<WanspotSort>('event_at')
  const [showSort, setShowSort] = useState(false)
  const [showVaccineBanner, setShowVaccineBanner] = useState(false)
  const [fabMenuOpen, setFabMenuOpen] = useState(false)
  const [pagerLayoutW, setPagerLayoutW] = useState<number | null>(null)
  const eventsContentW = pagerLayoutW ?? windowWidth

  const fabRotate = useRef(new Animated.Value(0)).current
  const fabScale = useRef(new Animated.Value(1)).current
  const fabMenuAnim = useRef(new Animated.Value(0)).current
  const tabSlideX = useRef(new Animated.Value(0)).current

  const [refreshScheduled, setRefreshScheduled] = useState(false)
  const [refreshJoined, setRefreshJoined] = useState(false)

  const reloadScheduledEvents = useCallback(async () => {
    const { data: eventsData } = await supabase.from('events').select('*').order('event_at', { ascending: true })
    setEvents((eventsData ?? []) as WanspotEventRow[])
  }, [])

  useEffect(() => {
    void (async () => {
      await reloadScheduledEvents()
      setLoading(false)
    })()
  }, [reloadScheduledEvents])

  useFocusEffect(
    useCallback(() => {
      let active = true
      setJoinedLoading(true)
      void (async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!active) return
        if (!user) {
          setJoinedEvents([])
          setShowVaccineBanner(false)
          setJoinedLoading(false)
          return
        }
        const { data: dogRow } = await supabase
          .from('dogs')
          .select('rabies_vaccinated_at, vaccine_vaccinated_at')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!active) return
        setShowVaccineBanner(
          !!dogRow && (dogRow.rabies_vaccinated_at == null || dogRow.vaccine_vaccinated_at == null)
        )
        const list = await fetchJoinedEventsList(user.id)
        if (!active) return
        setJoinedEvents(list)
        setJoinedLoading(false)
      })()
      return () => {
        active = false
        setJoinedLoading(false)
      }
    }, [])
  )

  const onRefreshScheduled = useCallback(async () => {
    setRefreshScheduled(true)
    try {
      await reloadScheduledEvents()
    } finally {
      setRefreshScheduled(false)
    }
  }, [reloadScheduledEvents])

  const onRefreshJoined = useCallback(async () => {
    setRefreshJoined(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setJoinedEvents([])
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
      setJoinedEvents(await fetchJoinedEventsList(user.id))
    } finally {
      setRefreshJoined(false)
    }
  }, [])

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
    const idx = tab === 'ai_plan' ? 0 : tab === 'scheduled' ? 1 : 2
    Animated.spring(tabSlideX, {
      toValue: -idx * eventsContentW,
      useNativeDriver: true,
      friction: 14,
      tension: 68,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    }).start()
  }, [tab, eventsContentW, tabSlideX])

  const sortedWanspotEvents = useMemo(() => sortEvents(events, eventSort), [events, eventSort])
  const sortedJoinedEvents = useMemo(() => sortEvents(joinedEvents, eventSort), [joinedEvents, eventSort])
  const currentSort = WANSPOT_SORT_OPTIONS.find((o) => o.value === eventSort)!

  /** タブシーンの下端は既にタブバー直上。FAB はそのすぐ上（マイページ列の中心に合わせる） */
  const FAB_SIZE = 56
  const padBottom = FAB_SIZE + 48
  const fabBottom = 16
  const fabRight = Math.max(12, Math.round(windowWidth / 8 - FAB_SIZE / 2))
  const fabMenuBottom = fabBottom + FAB_SIZE + 10

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
      {!(tab === 'ai_plan' && !aiPlanChromeVisible) ? (
        <View style={styles.subHeader}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsInner}>
            <Pressable
              onPress={() => setTab('ai_plan')}
              style={[styles.eventTabChip, tab === 'ai_plan' ? styles.eventTabChipOn : styles.eventTabChipOff]}
            >
              <Text style={[styles.eventTabTxt, tab === 'ai_plan' ? styles.eventTabTxtOn : styles.eventTabTxtOff]}>AIプラン</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('scheduled')}
              style={[styles.eventTabChip, tab === 'scheduled' ? styles.eventTabChipOn : styles.eventTabChipOff]}
            >
              <Text style={[styles.eventTabTxt, tab === 'scheduled' ? styles.eventTabTxtOn : styles.eventTabTxtOff]}>イベント</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('joined')}
              style={[styles.eventTabChip, tab === 'joined' ? styles.eventTabChipOn : styles.eventTabChipOff]}
            >
              <Text style={[styles.eventTabTxt, tab === 'joined' ? styles.eventTabTxtOn : styles.eventTabTxtOff]}>参加予定</Text>
            </Pressable>
          </ScrollView>
          {tab !== 'ai_plan' ? (
            <View style={styles.sortWrap}>
              <Pressable style={styles.sortBtn} onPress={() => setShowSort(true)}>
                <IconSort />
                <Text style={styles.sortBtnTxt}>{currentSort.label}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {showVaccineBanner && (tab === 'scheduled' || tab === 'joined') ? (
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
          if (w > 0 && (pagerLayoutW == null || Math.abs(w - pagerLayoutW) > 0.5)) {
            setPagerLayoutW(w)
          }
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
            {tab === 'ai_plan' ? (
              <AiPlanTab onEmbeddedChromeVisibility={setAiPlanChromeVisible} />
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
          <View style={[styles.eventsPage, { width: eventsContentW }]}>
            {loading ? (
              <ScrollView
                style={styles.pageScroll}
                contentContainerStyle={styles.pageScrollContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshScheduled}
                    onRefresh={onRefreshScheduled}
                    tintColor={colors.brand}
                    colors={[colors.brand]}
                  />
                }
              >
                <RunningDog label="イベントを読み込み中..." />
              </ScrollView>
            ) : events.length === 0 ? (
              <ScrollView
                style={styles.pageScroll}
                contentContainerStyle={styles.pageScrollContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshScheduled}
                    onRefresh={onRefreshScheduled}
                    tintColor={colors.brand}
                    colors={[colors.brand]}
                  />
                }
              >
                <View style={styles.emptyBlock}>
                  <PowState label="現在開催中のイベントはありません" />
                  <Text style={styles.emptyHint}>右下の＋からイベントを作成できます</Text>
                </View>
              </ScrollView>
            ) : (
              <FlatList
                style={styles.pageFlex}
                data={sortedWanspotEvents}
                keyExtractor={(item) => item.id}
                removeClippedSubviews={false}
                contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 16 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshScheduled}
                    onRefresh={onRefreshScheduled}
                    tintColor={colors.brand}
                    colors={[colors.brand]}
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
              <ScrollView
                style={styles.pageScroll}
                contentContainerStyle={styles.pageScrollContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshJoined}
                    onRefresh={onRefreshJoined}
                    tintColor={colors.brand}
                    colors={[colors.brand]}
                  />
                }
              >
                <RunningDog label="参加予定のイベントを読み込み中..." />
              </ScrollView>
            ) : joinedEvents.length === 0 ? (
              <ScrollView
                style={styles.pageScroll}
                contentContainerStyle={styles.pageScrollContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshJoined}
                    onRefresh={onRefreshJoined}
                    tintColor={colors.brand}
                    colors={[colors.brand]}
                  />
                }
              >
                <View style={styles.emptyJoined}>
                  <IconPaw size={40} color="#aaa" />
                  <Text style={styles.emptyJoinedTxt}>参加予定のイベントはありません</Text>
                </View>
              </ScrollView>
            ) : (
              <FlatList
                style={styles.pageFlex}
                data={sortedJoinedEvents}
                keyExtractor={(item) => item.id}
                removeClippedSubviews={false}
                contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 16 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshJoined}
                    onRefresh={onRefreshJoined}
                    tintColor={colors.brand}
                    colors={[colors.brand]}
                  />
                }
                renderItem={({ item }) => (
                  <EventCard event={item} variant="joined" onPressDetail={() => router.push(`/events/${item.id}`)} />
                )}
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
  root: { flex: 1, backgroundColor: '#f7f6f3', position: 'relative' },
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
  eventTabTxtOn: { color: '#2b2a28' },
  eventTabTxtOff: { color: '#888' },
  sortWrap: { justifyContent: 'center' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2b2a28',
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
  vBannerTxt: { fontSize: 12, fontWeight: '800', color: '#2b2a28', lineHeight: 18 },
  vBannerBtn: {
    alignSelf: 'stretch',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFD84D',
    borderWidth: 1,
    borderColor: '#e8c84a',
    alignItems: 'center',
  },
  vBannerBtnTxt: { fontSize: 12, fontWeight: '800', color: '#2b2a28' },
  emptyBlock: { paddingTop: 48, alignItems: 'center' },
  emptyHint: { marginTop: 12, fontSize: 12, color: '#aaa', textAlign: 'center' },
  emptyJoined: { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyJoinedTxt: { fontSize: 14, color: '#aaa' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 120, paddingRight: 16 },
  sortMenu: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', minWidth: 160, overflow: 'hidden' },
  sortItem: { paddingHorizontal: 16, paddingVertical: 12 },
  sortItemOn: { backgroundColor: '#FFF9E0' },
  sortItemTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  sortItemTxtOn: { color: '#2b2a28' },
  fabOverlayAnim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 99 },
  fabMenu: { position: 'absolute', zIndex: 101, width: 280, maxWidth: '100%', gap: 8 },
  eventsPagerHost: { flex: 1, overflow: 'hidden' },
  eventsPagerRow: { flexDirection: 'row', flex: 1 },
  /** 横ページャの各列: 幅は inline、縦は親に合わせ stretch（flex:1 幅と併用しない） */
  eventsPage: { alignSelf: 'stretch' },
  /** ページャ内でプル更新可能にする（空・ロード時も下方向に引ける） */
  pageScroll: { flex: 1 },
  pageScrollContent: { flexGrow: 1, justifyContent: 'center', minHeight: 360 },
  pageFlex: { flex: 1 },
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
  fabMenuPrimaryTxt: { fontSize: 14, fontWeight: '800', color: '#2b2a28' },
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
  fabMenuSecTxt: { fontSize: 14, fontWeight: '800', color: '#2b2a28' },
  fab: {
    position: 'absolute',
    zIndex: 100,
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
