import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/AppHeader'
import { EventCard, type WanspotEventRow } from '@/components/events/EventCard'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'
import { wanspotFetch } from '@/lib/wanspot-api'

type ExternalEv = {
  title?: string
  event_at?: string | null
  location_name?: string | null
  area?: string | null
  url?: string | null
  description?: string | null
}

type TabKey = 'upcoming' | 'joined' | 'external'

export default function EventsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<TabKey>('upcoming')
  const [events, setEvents] = useState<WanspotEventRow[]>([])
  const [joined, setJoined] = useState<WanspotEventRow[]>([])
  const [external, setExternal] = useState<ExternalEv[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: evs } = await supabase
      .from('events')
      .select('*')
      .order('event_at', { ascending: true })
      .limit(80)
    setEvents((evs ?? []) as WanspotEventRow[])
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: parts } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id)
      const ids = (parts ?? []).map((p) => p.event_id as string)
      if (ids.length) {
        const { data: je } = await supabase.from('events').select('*').in('id', ids)
        setJoined((je ?? []) as WanspotEventRow[])
      } else setJoined([])
    } else setJoined([])
    const res = await wanspotFetch('/api/events/external')
    const json = (await res.json()) as { events?: unknown }
    const raw = json.events
    setExternal(Array.isArray(raw) ? (raw as ExternalEv[]) : [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const data = useMemo(() => {
    if (tab === 'upcoming') return events
    if (tab === 'joined') return joined
    return []
  }, [tab, events, joined])

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 80
  const fabBottom = TAB_BAR_HEIGHT + insets.bottom + 16

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.tabs}>
        {(['upcoming', 'joined', 'external'] as const).map((k) => (
          <Pressable key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabTxt, tab === k && styles.tabTxtOn]}>
              {k === 'upcoming' ? '開催予定' : k === 'joined' ? '参加予定' : '外部'}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'external' ? (
        <FlatList
          data={external}
          keyExtractor={(item, i) => `${item.title}-${i}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          contentContainerStyle={{ padding: 12, paddingBottom: padBottom }}
          ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : <Text style={styles.empty}>データがありません</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.extCard}
              onPress={() => item.url && Linking.openURL(item.url)}
            >
              <Text style={styles.extTitle}>{item.title ?? 'イベント'}</Text>
              <Text style={styles.extSub}>{item.event_at ? new Date(item.event_at).toLocaleString('ja-JP') : ''}</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={data as WanspotEventRow[]}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          contentContainerStyle={{ padding: 12, paddingBottom: padBottom, gap: 10 }}
          ListEmptyComponent={
            loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : <Text style={styles.empty}>イベントがありません</Text>
          }
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push(`/events/${item.id}`)} />
          )}
        />
      )}
      <View style={[styles.fabWrap, { bottom: fabBottom, right: 16 }]}>
        {fabOpen ? (
          <Pressable style={styles.fabSec} onPress={() => { setFabOpen(false); router.push('/events/new') }}>
            <Text style={styles.fabSecTxt}>イベント作成</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.fab} onPress={() => setFabOpen((o) => !o)}>
          <Ionicons name={fabOpen ? 'close' : 'add'} size={28} color={colors.text} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabTxt: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  tabTxtOn: { color: colors.text },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  extCard: {
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  extTitle: { fontWeight: '800', color: colors.text },
  extSub: { fontSize: 12, color: colors.textLight, marginTop: 6 },
  fabWrap: { position: 'absolute', alignItems: 'flex-end' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabSec: {
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fabSecTxt: { fontWeight: '700', color: colors.text },
})
