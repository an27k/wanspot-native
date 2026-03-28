import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppHeader } from '@/components/AppHeader'
import { EventEditorForm } from '@/components/events/EventEditorForm'
import { colors } from '@/constants/colors'
import { supabase } from '@/lib/supabase'

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
  tags: string[] | null
  thumbnail_url: string | null
  creator_id: string
}

export default function EditEventScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const eventId = Array.isArray(id) ? id[0] : id
  const [ev, setEv] = useState<EventRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
    if (!data || !user || data.creator_id !== user.id) {
      setForbidden(true)
      setEv(null)
      setLoading(false)
      return
    }
    setEv(data as EventRow)
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  if (!eventId) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="編集" onBack={() => router.back()} />
        <Text style={styles.err}>無効なイベントです</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="編集" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      </View>
    )
  }

  if (forbidden || !ev) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="編集" onBack={() => router.back()} />
        <Text style={styles.err}>編集できません</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppHeader variant="back" title="イベント編集" onBack={() => router.back()} />
      <EventEditorForm
        mode="edit"
        eventId={ev.id}
        minCapacity={ev.current_count ?? 0}
        priceReadOnly
        initial={{
          title: ev.title,
          description: ev.description,
          event_at: ev.event_at,
          location_name: ev.location_name,
          area: ev.area,
          price: ev.price,
          capacity: ev.capacity,
          tags: ev.tags,
          thumbnail_url: ev.thumbnail_url,
        }}
        onSuccess={() => router.back()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  err: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
})
