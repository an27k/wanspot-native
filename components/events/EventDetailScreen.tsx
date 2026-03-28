import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { AppHeader } from '@/components/AppHeader'
import { supabase } from '@/lib/supabase'
import { wanspotFetchJson } from '@/lib/wanspot-api'

type EventRow = {
  id: string
  title: string
  description: string | null
  event_at: string | null
  location_name: string | null
  area: string | null
  price: number | null
  capacity: number | null
  current_count: number | null
  thumbnail_url: string | null
  creator_id: string
}

export default function EventDetailScreen({ eventId }: { eventId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [ev, setEv] = useState<EventRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
    setEv(data as EventRow | null)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && data) {
      const { data: p } = await supabase
        .from('event_participants')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle()
      setJoined(!!p)
    }
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  const join = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert('ログインが必要です')
      return
    }
    const { data: dogs } = await supabase
      .from('dogs')
      .select('rabies_vaccinated_at, vaccine_vaccinated_at, rabies_vaccinated, vaccine_vaccinated')
      .eq('user_id', user.id)
      .limit(1)
    const d = dogs?.[0]
    const vaccineOk =
      !!(d?.rabies_vaccinated_at && d?.vaccine_vaccinated_at) ||
      (d?.rabies_vaccinated === true && d?.vaccine_vaccinated === true)
    if (!vaccineOk) {
      Alert.alert(
        'ワクチン情報',
        '狂犬病・混合ワクチンの接種日をマイページの犬プロフィールで登録してください。',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/mypage') }]
      )
      return
    }
    if (!ev) return
    if (ev.price != null && ev.price > 0) {
      const checkout = await wanspotFetchJson<{ url?: string }>('/api/events/checkout', {
        method: 'POST',
        json: { eventId: ev.id },
      })
      if (checkout.url) {
        Linking.openURL(checkout.url)
      } else {
        Alert.alert('決済を開始できませんでした')
      }
      return
    }
    const { error } = await supabase.from('event_participants').insert({
      event_id: ev.id,
      user_id: user.id,
    })
    if (error) {
      Alert.alert('エラー', error.message)
      return
    }
    setJoined(true)
    Alert.alert('参加登録しました')
  }

  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 32

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="イベント" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      </View>
    )
  }

  if (!ev) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="イベント" onBack={() => router.back()} />
        <Text style={styles.empty}>イベントが見つかりません</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppHeader variant="back" title="イベント" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
        {ev.thumbnail_url ? (
          <Image source={{ uri: ev.thumbnail_url }} style={styles.hero} resizeMode="cover" />
        ) : null}
        <View style={styles.pad}>
          <Text style={styles.title}>{ev.title}</Text>
          <Text style={styles.when}>
            {ev.event_at ? new Date(ev.event_at).toLocaleString('ja-JP') : '日時未定'}
          </Text>
          <Text style={styles.loc}>
            {[ev.area, ev.location_name].filter(Boolean).join(' · ')}
          </Text>
          {ev.description ? <Text style={styles.desc}>{ev.description}</Text> : null}
          <Pressable
            style={[styles.joinBtn, joined && styles.joined]}
            onPress={joined ? undefined : join}
            disabled={joined}
          >
            <Text style={styles.joinTxt}>
              {joined ? '参加済み' : ev.price != null && ev.price > 0 ? '有料で参加（決済）' : '無料で参加'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  hero: { width: '100%', height: 200 },
  pad: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  when: { fontSize: 14, color: colors.textLight, marginTop: 10 },
  loc: { fontSize: 14, color: colors.textMuted, marginTop: 6 },
  desc: { fontSize: 15, lineHeight: 24, color: colors.text, marginTop: 16 },
  joinBtn: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  joined: { backgroundColor: colors.border },
  joinTxt: { fontWeight: '800', color: colors.text, fontSize: 16 },
})
