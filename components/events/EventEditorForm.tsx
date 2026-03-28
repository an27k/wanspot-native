import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { CapacityDrumPicker } from '@/components/events/CapacityDrumPicker'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { EVENT_MODERATION_REJECT_MESSAGE } from '@/lib/event-moderation'
import { supabase } from '@/lib/supabase'
import { wanspotFetchJson } from '@/lib/wanspot-api'

type Mode = 'create' | 'edit'

export type EventEditorSnapshot = {
  title: string
  description: string | null
  location_name: string | null
  area: string | null
  event_at: string | null
  capacity: number | null
  price: number | null
  tags: string[] | null
  thumbnail_url: string | null
}

type Props = {
  mode: Mode
  eventId?: string
  initial?: Partial<EventEditorSnapshot>
  priceReadOnly?: boolean
  minCapacity?: number
  onSuccess: (id: string) => void
}

const PRESET_TAGS = ['ドッグラン', 'お散歩', 'カフェ', 'しつけ教室', '写真撮影', 'パーティー', '公園', 'ビーチ']

const AREA_PRESETS = ['渋谷', '新宿', '港区', '目黒', '世田谷', '中目黒', '恵比寿', '吉祥寺', '代官山', '自由が丘', 'その他']

const PRICE_OPTIONS = [
  { value: '0', label: '無料' },
  { value: '1000', label: '¥1,000' },
  { value: '1500', label: '¥1,500' },
  { value: '2000', label: '¥2,000' },
  { value: '2500', label: '¥2,500' },
  { value: '3000', label: '¥3,000' },
  { value: '4000', label: '¥4,000' },
  { value: '5000', label: '¥5,000' },
  { value: '7000', label: '¥7,000' },
  { value: '10000', label: '¥10,000' },
]

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultNextDayTenAm(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}

function dateToDatetimeLocalString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatEventAtJa(d: Date): string {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateToDatetimeLocalString(d)
  }
}

export function EventEditorForm({
  mode,
  eventId,
  initial,
  priceReadOnly,
  minCapacity = 0,
  onSuccess,
}: Props) {
  const insets = useSafeAreaInsets()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationName, setLocationName] = useState('')
  const [area, setArea] = useState('')
  const [eventAtDate, setEventAtDate] = useState<Date>(() => defaultNextDayTenAm())
  const [eventPickerOpen, setEventPickerOpen] = useState(false)
  const [eventPickerTemp, setEventPickerTemp] = useState<Date>(() => defaultNextDayTenAm())
  const [capacity, setCapacity] = useState<number | null>(mode === 'create' ? null : Math.max(minCapacity, 3))
  const [price, setPrice] = useState('0')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null)
  const [thumbnailUrlExternal, setThumbnailUrlExternal] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [aiDescLoading, setAiDescLoading] = useState(false)
  const [aiThumbLoading, setAiThumbLoading] = useState(false)
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [hydrated, setHydrated] = useState(mode === 'create')

  const drumMin = mode === 'edit' ? Math.max(minCapacity ?? 0, 3) : 3

  const eventAt = useMemo(() => dateToDatetimeLocalString(eventAtDate), [eventAtDate])

  useEffect(() => {
    if (mode !== 'edit' || !initial) return
    setTitle(initial.title ?? '')
    setDescription(initial.description ?? '')
    setLocationName(initial.location_name ?? '')
    setArea(initial.area ?? '')
    if (initial.event_at) {
      const d = new Date(initial.event_at)
      if (!Number.isNaN(d.getTime())) setEventAtDate(d)
    }
    const mc = Math.max(minCapacity ?? 0, 3)
    const cap = initial.capacity ?? null
    setCapacity(cap == null ? mc : cap < mc ? mc : cap)
    setPrice(String(initial.price ?? 0))
    setTags(initial.tags ?? [])
    if (initial.thumbnail_url) {
      setThumbnailUrlExternal(initial.thumbnail_url)
      setThumbnailUri(initial.thumbnail_url)
    } else {
      setThumbnailUrlExternal(null)
      setThumbnailUri(null)
    }
    setHydrated(true)
  }, [mode, initial, minCapacity])

  const pickThumbnail = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setError('画像ライブラリへのアクセスが必要です')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    })
    if (!res.canceled && res.assets[0]?.uri) {
      setThumbnailUrlExternal(null)
      setThumbnailUri(res.assets[0].uri)
    }
  }

  const handleAiDescription = async () => {
    const t = title.trim()
    if (!t || aiDescLoading) return
    setAiDescLoading(true)
    setError('')
    try {
      const data = await wanspotFetchJson<{ description?: string; error?: string }>(
        '/api/events/generate-description',
        { method: 'POST', json: { title: t } }
      )
      if (data.error) {
        setError(typeof data.error === 'string' ? data.error : '説明の生成に失敗しました')
        return
      }
      if (data.description) setDescription(data.description)
    } catch {
      setError('説明の生成に失敗しました')
    } finally {
      setAiDescLoading(false)
    }
  }

  const handleAiThumbnail = async () => {
    const t = title.trim()
    if (!t || aiThumbLoading) return
    setAiThumbLoading(true)
    setError('')
    try {
      const data = await wanspotFetchJson<{ url?: string; error?: string }>(
        '/api/events/unsplash-thumbnail',
        {
          method: 'POST',
          json: { title: t, description: description.trim() || undefined },
        }
      )
      if (data.error && !data.url) {
        setError(typeof data.error === 'string' ? data.error : '画像の取得に失敗しました')
        return
      }
      if (!data.url) {
        setError('該当する画像が見つかりませんでした')
        return
      }
      setThumbnailUri(data.url)
      setThumbnailUrlExternal(data.url)
    } catch {
      setError('画像の取得に失敗しました')
    } finally {
      setAiThumbLoading(false)
    }
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]))
  }

  const addCustomTag = () => {
    const t = customTag.trim()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setCustomTag('')
  }

  const titleInvalid = showFieldErrors && !title.trim()
  const eventAtInvalid = showFieldErrors && !eventAt
  const locationInvalid = showFieldErrors && !locationName.trim()

  const handleSubmit = useCallback(async () => {
    setError('')
    if (!title.trim() || !eventAt || !locationName.trim()) {
      setShowFieldErrors(true)
      const msg = 'タイトル・開催日時・場所名をすべて入力してください'
      setError(msg)
      Alert.alert('', msg)
      return
    }
    setShowFieldErrors(false)
    setSubmitting(true)
    try {
      const modJson = await wanspotFetchJson<{ ok?: boolean; message?: string }>(
        '/api/events/moderate',
        { method: 'POST', json: { title, description } }
      )
      if (!modJson.ok) {
        Alert.alert('', modJson.message || EVENT_MODERATION_REJECT_MESSAGE)
        setSubmitting(false)
        return
      }
    } catch {
      setError('モデレーションに失敗しました。もう一度お試しください。')
      setSubmitting(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('ログインが必要です')
      setSubmitting(false)
      return
    }

    let thumbnailUrl: string | null = thumbnailUrlExternal
    const localUri = thumbnailUri && !thumbnailUri.startsWith('http') ? thumbnailUri : null
    if (localUri) {
      setUploading(true)
      try {
        const resFetch = await fetch(localUri)
        const buf = await resFetch.arrayBuffer()
        const path = `${user.id}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('events')
          .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
        if (uploadError) {
          setError('画像のアップロードに失敗しました')
          setSubmitting(false)
          setUploading(false)
          return
        }
        const { data: urlData } = supabase.storage.from('events').getPublicUrl(path)
        thumbnailUrl = urlData.publicUrl
      } finally {
        setUploading(false)
      }
    } else if (thumbnailUri?.startsWith('http')) {
      thumbnailUrl = thumbnailUri
    }

    const eventAtIso = new Date(eventAt).toISOString()
    const baseFields = {
      title: title.trim(),
      description: description.trim() || null,
      location_name: locationName.trim() || null,
      area: area.trim() || null,
      event_at: eventAtIso,
      capacity: capacity ?? null,
      tags: tags.length > 0 ? tags : null,
      thumbnail_url: thumbnailUrl,
    }

    if (mode === 'create') {
      const { data, error: insertError } = await supabase
        .from('events')
        .insert({
          creator_id: user.id,
          ...baseFields,
          price: parseInt(price, 10) || 0,
          is_official: false,
          current_count: 0,
        })
        .select('id')
        .single()
      if (insertError || !data) {
        setError('作成に失敗しました')
        setSubmitting(false)
        return
      }
      onSuccess(data.id)
    } else {
      if (!eventId) {
        setError('イベントIDがありません')
        setSubmitting(false)
        return
      }
      const updatePayload: Record<string, unknown> = { ...baseFields }
      if (!priceReadOnly) updatePayload.price = parseInt(price, 10) || 0
      const { error: upErr } = await supabase
        .from('events')
        .update(updatePayload)
        .eq('id', eventId)
        .eq('creator_id', user.id)
      if (upErr) {
        setError('更新に失敗しました')
        setSubmitting(false)
        return
      }
      setThumbnailUrlExternal(thumbnailUrl)
      setThumbnailUri(thumbnailUrl)
      onSuccess(eventId)
    }
    setSubmitting(false)
  }, [
    title,
    eventAt,
    locationName,
    description,
    area,
    capacity,
    tags,
    thumbnailUri,
    thumbnailUrlExternal,
    mode,
    eventId,
    price,
    priceReadOnly,
    onSuccess,
  ])

  const paidSelected = price !== '0'
  const canAi = !!title.trim()
  const submitDisabled =
    submitting ||
    uploading ||
    aiDescLoading ||
    aiThumbLoading ||
    (mode === 'edit' && !hydrated)

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 48

  if (mode === 'edit' && !hydrated) {
    return (
      <View style={styles.hydrate}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    )
  }

  return (
    <>
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: padBottom }]}>
      <View style={[styles.card, titleInvalid && styles.cardErr]}>
        <Text style={styles.lbl}>タイトル *</Text>
        <TextInput
          style={styles.inputBare}
          value={title}
          onChangeText={setTitle}
          placeholder="例：代々木公園でお散歩会"
          placeholderTextColor="#aaa"
        />
        <Text style={styles.hint}>タイトルを入力すると、下の「AIで説明を生成」「AIで画像を設定」が使えるようになります。</Text>
      </View>

      <View style={styles.card}>
        <Pressable style={styles.thumbTap} onPress={pickThumbnail}>
          {thumbnailUri ? (
            <View style={styles.thumbInner}>
              <Image source={{ uri: thumbnailUri }} style={styles.thumbImg} resizeMode="cover" />
              <View style={styles.thumbOverlay}>
                <Text style={styles.thumbOverlayTxt}>タップして変更</Text>
              </View>
            </View>
          ) : (
            <View style={styles.thumbEmpty}>
              <Ionicons name="camera-outline" size={28} color="#aaa" />
              <Text style={styles.thumbEmptyMain}>サムネイルを追加</Text>
              <Text style={styles.thumbEmptySub}>任意</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.thumbActions}>
          <Pressable
            style={[styles.aiBtn, !canAi && styles.aiBtnOff]}
            disabled={!canAi || aiThumbLoading}
            onPress={() => void handleAiThumbnail()}
          >
            {aiThumbLoading ? (
              <ActivityIndicator color={canAi ? colors.text : '#ccc'} />
            ) : (
              <Text style={[styles.aiBtnTxt, !canAi && styles.aiBtnTxtOff]}>AIで画像を設定</Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.lbl}>説明</Text>
        <TextInput
          style={[styles.inputBare, styles.ta]}
          value={description}
          onChangeText={setDescription}
          placeholder="イベントの内容を書いてください"
          placeholderTextColor="#aaa"
          multiline
        />
        <Pressable
          style={[styles.aiBtn, !canAi && styles.aiBtnOff]}
          disabled={!canAi || aiDescLoading}
          onPress={() => void handleAiDescription()}
        >
          {aiDescLoading ? (
            <ActivityIndicator color={canAi ? colors.text : '#ccc'} />
          ) : (
            <Text style={[styles.aiBtnTxt, !canAi && styles.aiBtnTxtOff]}>AIで説明を生成</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.card, eventAtInvalid && styles.cardErr]}>
        <Text style={styles.lbl}>開催日時 *</Text>
        <Pressable
          style={styles.eventPickBtn}
          onPress={() => {
            setEventPickerTemp(eventAtDate)
            setEventPickerOpen(true)
          }}
        >
          <Text style={styles.eventPickMain}>{formatEventAtJa(eventAtDate)}</Text>
          <Text style={styles.eventPickSub}>タップして日付と時刻を選択</Text>
        </Pressable>
      </View>

      <View style={[styles.card, locationInvalid && styles.cardErr]}>
        <Text style={styles.lbl}>場所名 *</Text>
        <TextInput
          style={styles.inputBare}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="例：代々木公園 ドッグラン"
          placeholderTextColor="#aaa"
        />
        <Text style={[styles.lbl, { marginTop: 12 }]}>エリア</Text>
        <View style={styles.tagWrap}>
          {AREA_PRESETS.map((a) => (
            <Pressable
              key={a}
              style={[styles.areaChip, area === a && styles.areaChipOn]}
              onPress={() => setArea((prev) => (prev === a ? '' : a))}
            >
              <Text style={[styles.areaChipTxt, area === a && styles.areaChipTxtOn]}>{a}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.lbl}>
          定員（名）{mode === 'edit' ? <Text style={styles.lblSub}>（参加人数以上）</Text> : null}
        </Text>
        <CapacityDrumPicker
          value={capacity}
          onChange={setCapacity}
          allowEmpty={mode === 'create'}
          min={drumMin}
          max={20}
        />
        <Text style={[styles.lbl, { marginTop: 16 }]}>参加費</Text>
        <ScrollView style={styles.priceList} nestedScrollEnabled>
          {PRICE_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              style={[styles.priceRow, price === o.value && styles.priceRowOn]}
              disabled={priceReadOnly}
              onPress={() => setPrice(o.value)}
            >
              <Text style={[styles.priceRowTxt, price === o.value && styles.priceRowTxtOn]}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {paidSelected ? (
          <Text style={styles.paidNote}>現在βテスト中のため、有料イベントは管理者確認後に公開されます。</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.lbl}>タグ</Text>
        <View style={styles.tagWrap}>
          {PRESET_TAGS.map((tag) => (
            <Pressable
              key={tag}
              style={[styles.pill, tags.includes(tag) && styles.pillOn]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[styles.pillTxt, tags.includes(tag) && styles.pillTxtOn]}>{tag}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInp}
            value={customTag}
            onChangeText={setCustomTag}
            placeholder="カスタムタグを追加"
            placeholderTextColor="#aaa"
            onSubmitEditing={addCustomTag}
          />
          <Pressable style={styles.addTagBtn} onPress={addCustomTag}>
            <Text style={styles.addTagTxt}>追加</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errBox}>
          <Text style={styles.errTxt}>{error}</Text>
        </View>
      ) : null}

      <Pressable style={[styles.submit, submitDisabled && styles.submitOff]} disabled={submitDisabled} onPress={() => void handleSubmit()}>
        <Text style={[styles.submitTxt, submitDisabled && styles.submitTxtOff]}>
          {uploading
            ? '画像アップロード中...'
            : submitting
              ? '処理中...'
              : mode === 'create'
                ? 'イベントを公開する'
                : '変更を保存する'}
        </Text>
      </Pressable>
    </ScrollView>

    {eventPickerOpen && Platform.OS === 'ios' ? (
      <Modal visible transparent animationType="fade" onRequestClose={() => setEventPickerOpen(false)}>
        <View style={styles.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEventPickerOpen(false)} />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>開催日時</Text>
            <DateTimePicker
              value={eventPickerTemp}
              mode="datetime"
              display="spinner"
              locale="ja_JP@calendar=gregorian"
              themeVariant="light"
              onChange={(_, d) => {
                if (d) setEventPickerTemp(d)
              }}
            />
            <View style={styles.pickerActions}>
              <Pressable style={styles.pickerGhost} onPress={() => setEventPickerOpen(false)}>
                <Text style={styles.pickerGhostTxt}>キャンセル</Text>
              </Pressable>
              <Pressable
                style={styles.pickerPri}
                onPress={() => {
                  setEventAtDate(eventPickerTemp)
                  setEventPickerOpen(false)
                }}
              >
                <Text style={styles.pickerPriTxt}>決定</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    ) : null}
    {eventPickerOpen && Platform.OS === 'android' ? (
      <DateTimePicker
        value={eventPickerTemp}
        mode="datetime"
        display="default"
        locale="ja_JP@calendar=gregorian"
        onChange={(ev, d) => {
          if (ev.type === 'dismissed') {
            setEventPickerOpen(false)
            return
          }
          if (ev.type === 'set' && d) {
            setEventAtDate(d)
            setEventPickerOpen(false)
          }
        }}
      />
    ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  hydrate: { paddingVertical: 48, alignItems: 'center' },
  container: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  cardErr: { borderColor: '#E84335' },
  eventPickBtn: {
    borderRadius: 12,
    backgroundColor: '#f7f6f3',
    borderWidth: 1,
    borderColor: '#ebebeb',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  eventPickMain: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  eventPickSub: { fontSize: 12, color: '#888', marginTop: 6, fontWeight: '600' },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  pickerTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  pickerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pickerGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  pickerGhostTxt: { fontSize: 14, fontWeight: '800', color: '#888' },
  pickerPri: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
  },
  pickerPriTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  lbl: { fontSize: 12, fontWeight: '800', color: '#aaa', marginBottom: 8, letterSpacing: 0.5 },
  lblSub: { fontWeight: '400', color: '#888' },
  hint: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 18 },
  inputBare: { fontSize: 14, color: '#1a1a1a', paddingVertical: 4 },
  ta: { minHeight: 100, textAlignVertical: 'top' },
  thumbTap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#f7f6f3', minHeight: 180 },
  thumbInner: { width: '100%', height: 180 },
  thumbImg: { width: '100%', height: '100%' },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverlayTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  thumbEmpty: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 8 },
  thumbEmptyMain: { fontSize: 12, fontWeight: '800', color: '#aaa' },
  thumbEmptySub: { fontSize: 12, color: '#ccc' },
  thumbActions: { borderTopWidth: 1, borderTopColor: '#ebebeb', paddingTop: 10, marginTop: 0 },
  aiBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFD84D',
    borderWidth: 1,
    borderColor: '#e8c84a',
    alignItems: 'center',
  },
  aiBtnOff: { backgroundColor: '#f5f5f5', borderColor: '#ebebeb' },
  aiBtnTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  aiBtnTxtOff: { color: '#ccc' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  areaChipOn: { backgroundColor: '#FFD84D', borderWidth: 0 },
  areaChipTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  areaChipTxtOn: { color: '#1a1a1a' },
  priceList: { maxHeight: 220, marginTop: 8 },
  priceRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f7f6f3',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  priceRowOn: { backgroundColor: '#FFF9E0', borderColor: '#e8c84a' },
  priceRowTxt: { fontSize: 14, fontWeight: '700', color: '#555' },
  priceRowTxtOn: { color: '#1a1a1a' },
  paidNote: { fontSize: 12, color: '#b45309', marginTop: 10, lineHeight: 18 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  pillOn: { backgroundColor: '#FFD84D', borderWidth: 0 },
  pillTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  pillTxtOn: { color: '#1a1a1a' },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  customInp: {
    flex: 1,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    color: '#1a1a1a',
  },
  addTagBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFD84D',
    justifyContent: 'center',
  },
  addTagTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  errBox: { backgroundColor: '#FEE2E2', borderRadius: 16, padding: 12 },
  errTxt: { fontSize: 14, color: '#E84335' },
  submit: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
  },
  submitOff: { backgroundColor: '#f5f5f5' },
  submitTxt: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  submitTxtOff: { color: '#bbb' },
})
