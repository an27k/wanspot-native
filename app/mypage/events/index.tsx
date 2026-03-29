import { useCallback, useEffect, useState } from 'react'
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { UiIconChevronLeft } from '@/components/ui-icons'
import { type WanspotEventRow } from '@/components/events/EventCard'
import { RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'

export default function MyHostedEventsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [rows, setRows] = useState<WanspotEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/(auth)/login')
      setRows([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    const { data, error } = await supabase
      .from('events')
      .select('id, title, event_at, location_name, thumbnail_url, capacity, current_count, creator_id, tags, is_official, description, area, price')
      .eq('creator_id', user.id)
      .order('event_at', { ascending: false })
    if (error) {
      console.error('[mypage/events]', error)
      setRows([])
    } else {
      setRows((data ?? []) as WanspotEventRow[])
    }
    setLoading(false)
    setRefreshing(false)
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '日時未定'
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.sticky, { paddingTop: Math.max(12, insets.top) }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
            <UiIconChevronLeft size={22} />
          </Pressable>
          <Text style={styles.pageTitle}>主催したイベント</Text>
        </View>
        <RunningDog label="イベントを読み込み中..." />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={[styles.sticky, { paddingTop: Math.max(12, insets.top) }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
          <UiIconChevronLeft size={22} />
        </Pressable>
        <Text style={styles.pageTitle}>主催したイベント</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} />}
        contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>まだ作成したイベントはありません</Text>}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <Pressable
              onPress={() => router.push(`/events/${item.id}`)}
              style={styles.rowCard}
            >
              <View style={styles.thumb}>
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={styles.thumbImg} resizeMode="cover" />
                ) : (
                  <View style={styles.thumbPh}>
                    <Text style={styles.noImg}>No img</Text>
                  </View>
                )}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.evTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.evDate}>{formatDate(item.event_at)}</Text>
                {item.location_name ? (
                  <Text style={styles.evLoc} numberOfLines={1}>{item.location_name}</Text>
                ) : null}
              </View>
            </Pressable>
            <Pressable style={styles.editFab} onPress={() => router.push(`/mypage/events/${item.id}/edit`)}>
              <Text style={styles.editFabTxt}>編集</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  sticky: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backHit: { alignSelf: 'flex-start', marginBottom: 8 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', paddingLeft: 4 },
  empty: { textAlign: 'center', fontSize: 14, color: '#aaa', paddingVertical: 48 },
  cardWrap: { position: 'relative', borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb' },
  rowCard: { flexDirection: 'row', gap: 12, padding: 12, paddingRight: 88 },
  thumb: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF9E0' },
  thumbImg: { width: '100%', height: '100%' },
  thumbPh: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noImg: { fontSize: 10, fontWeight: '800', color: '#ccc' },
  rowBody: { flex: 1, minWidth: 0 },
  evTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  evDate: { fontSize: 12, color: '#888', marginTop: 4 },
  evLoc: { fontSize: 12, color: '#aaa', marginTop: 2 },
  editFab: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  editFabTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
})
