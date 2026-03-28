import { useCallback, useState } from 'react'
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
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { AppHeader } from '@/components/AppHeader'
import { supabase } from '@/lib/supabase'
import { fetchCheckedInSpotsForUser, fetchLikedSpotsForUser, type UserSpotRow } from '@/lib/fetchUserSpotLists'

type Mode = 'likes' | 'checkins'

export function UserSpotsListScreen({ mode, title }: { mode: Mode; title: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [spots, setSpots] = useState<UserSpotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSpots([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    const res =
      mode === 'likes'
        ? await fetchLikedSpotsForUser(supabase, user.id)
        : await fetchCheckedInSpotsForUser(supabase, user.id)
    setSpots(res.ok ? res.spots : [])
    setLoading(false)
    setRefreshing(false)
  }, [mode])

  useFocusEffect(
    useCallback(() => {
      load(false)
    }, [load])
  )

  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 24

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title={title} onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppHeader variant="back" title={title} onBack={() => router.back()} />
      <FlatList
        data={spots}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>まだありません</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/spots/${item.id}`)}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.category} · ♥ {item.likeCount}</Text>
            {item.address ? <Text style={styles.addr} numberOfLines={2}>{item.address}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  card: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  addr: { fontSize: 13, color: colors.textLight, marginTop: 6 },
})
