import { useCallback, useEffect, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/AppHeader'
import { EventCard, type WanspotEventRow } from '@/components/events/EventCard'
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
      setRows([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('creator_id', user.id)
      .order('event_at', { ascending: false })
    setRows((data ?? []) as WanspotEventRow[])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="主催イベント" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppHeader variant="back" title="主催イベント" onBack={() => router.back()} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: padBottom, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>主催イベントはまだありません</Text>}
        renderItem={({ item }) => (
          <View>
            <EventCard event={item} onPress={() => router.push(`/events/${item.id}`)} />
            <Pressable style={styles.edit} onPress={() => router.push(`/mypage/events/${item.id}/edit`)}>
              <Text style={styles.editTxt}>編集</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  edit: {
    marginTop: 6,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editTxt: { fontWeight: '700', fontSize: 13, color: colors.text },
})
