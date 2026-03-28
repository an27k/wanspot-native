import { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'

type Mode = 'create' | 'edit'

type Initial = Partial<{
  title: string
  description: string | null
  event_at: string | null
  location_name: string | null
  area: string | null
  price: number | null
  capacity: number | null
}>

type Props = {
  mode: Mode
  eventId?: string
  initial?: Initial
  priceReadOnly?: boolean
  minCapacity?: number
  onSuccess: (id: string) => void
}

export function EventEditorForm({
  mode,
  eventId,
  initial,
  priceReadOnly,
  minCapacity,
  onSuccess,
}: Props) {
  const insets = useSafeAreaInsets()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [eventAt, setEventAt] = useState(initial?.event_at ?? '')
  const [locationName, setLocationName] = useState(initial?.location_name ?? '')
  const [area, setArea] = useState(initial?.area ?? '')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '0')
  const [capacity, setCapacity] = useState(initial?.capacity != null ? String(initial.capacity) : '20')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!title.trim()) {
      setErr('タイトルを入力してください')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setErr('ログインが必要です')
      return
    }
    setLoading(true)
    try {
      const cap = Math.max(Number(capacity) || 0, minCapacity ?? 0)
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        event_at: eventAt.trim() || null,
        location_name: locationName.trim() || null,
        area: area.trim() || null,
        price: priceReadOnly ? initial?.price ?? 0 : Number(price) || 0,
        capacity: cap,
        creator_id: user.id,
        is_official: false,
        tags: [] as string[],
        current_count: 0,
      }
      if (mode === 'create') {
        const { data, error } = await supabase.from('events').insert(payload).select('id').single()
        if (error) throw error
        onSuccess(data.id)
      } else if (eventId) {
        const updatePayload = { ...payload }
        delete (updatePayload as { creator_id?: string }).creator_id
        const { error } = await supabase.from('events').update(updatePayload).eq('id', eventId)
        if (error) throw error
        onSuccess(eventId)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 40

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: padBottom }}>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Text style={styles.label}>タイトル</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="イベント名" />
      <Text style={styles.label}>説明</Text>
      <TextInput
        style={[styles.input, styles.ta]}
        value={description}
        onChangeText={setDescription}
        placeholder="説明"
        multiline
      />
      <Text style={styles.label}>開催日時（ISO 推奨 例: 2026-04-01T10:00:00+09:00）</Text>
      <TextInput style={styles.input} value={eventAt} onChangeText={setEventAt} placeholder="2026-04-01T10:00:00+09:00" />
      <Text style={styles.label}>エリア</Text>
      <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="東京都" />
      <Text style={styles.label}>会場名</Text>
      <TextInput style={styles.input} value={locationName} onChangeText={setLocationName} />
      <Text style={styles.label}>参加費（円・0で無料）</Text>
      <TextInput
        style={[styles.input, priceReadOnly && styles.ro]}
        value={price}
        onChangeText={setPrice}
        keyboardType="number-pad"
        editable={!priceReadOnly}
      />
      <Text style={styles.label}>定員</Text>
      <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <Pressable style={styles.btn} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.btnTxt}>保存</Text>}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: colors.textLight, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  ro: { opacity: 0.6 },
  ta: { minHeight: 100, textAlignVertical: 'top' },
  err: { color: colors.error, marginBottom: 8 },
  btn: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  btnTxt: { fontWeight: '800', fontSize: 16, color: colors.text },
})
