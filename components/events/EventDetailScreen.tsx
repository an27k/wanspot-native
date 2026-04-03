import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import { RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'
import { wanspotFetchJson, wanspotPublicUrl } from '@/lib/wanspot-api'

type EventRow = {
  id: string
  title: string
  description: string | null
  event_at: string | null
  location_name: string | null
  area: string | null
  price: number | null
  /** DB に無い既存行は undefined 扱いで price から推測 */
  is_paid?: boolean | null
  capacity: number | null
  current_count: number | null
  thumbnail_url: string | null
  tags: string[] | null
  is_official: boolean
  creator_id: string
}

const IconChevronLeft = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
)
const IconCalendar = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round">
    <Path d="M7 3v4M17 3v4M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
  </Svg>
)
const IconPin = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <Path d="M12 10h.01" />
  </Svg>
)
const IconUsers = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round">
    <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </Svg>
)
const IconShare = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round">
    <Circle cx={18} cy={5} r={3} />
    <Circle cx={6} cy={12} r={3} />
    <Circle cx={18} cy={19} r={3} />
    <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </Svg>
)
const IconX = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
    <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </Svg>
)
const IconCopy = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round">
    <Path d="M9 9h10v10H9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
)

const DogPh = () => (
  <Svg width={56} height={56} viewBox="0 0 100 100" fill="#FFD84D">
    <Ellipse cx={20} cy={28} rx={10} ry={13} />
    <Ellipse cx={40} cy={16} rx={10} ry={13} />
    <Ellipse cx={60} cy={16} rx={10} ry={13} />
    <Ellipse cx={80} cy={28} rx={10} ry={13} />
    <Path d="M50 33 C26 33 14 54 17 70 C20 86 35 92 50 92 C65 92 80 86 83 70 C86 54 74 33 50 33Z" />
  </Svg>
)

const CANCEL_CONFIRM_MESSAGE =
  '参加をキャンセルしますか？\n\n※基本的に参加費の返金はできません。ご不明な点はメニューバーの「お問い合わせ」よりご連絡ください。'

function eventRequiresPayment(e: Pick<EventRow, 'is_paid' | 'price'>): boolean {
  if (e.is_paid === true) return true
  if (e.is_paid === false) return false
  return e.price != null && e.price > 0
}

export default function EventDetailScreen({
  eventId,
  onJoinedFree,
}: {
  eventId: string
  /** 無料イベントで DB への参加登録が成功した直後（計測用） */
  onJoinedFree?: () => void
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ payment?: string; created?: string }>()
  const paymentParam = Array.isArray(params.payment) ? params.payment[0] : params.payment
  const createdParam = Array.isArray(params.created) ? params.created[0] : params.created

  const [event, setEvent] = useState<EventRow | null>(null)
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [participantCount, setParticipantCount] = useState(0)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [showCreatedToast, setShowCreatedToast] = useState(false)

  const loadCore = useCallback(async () => {
    const { data: eventData } = await supabase.from('events').select('*').eq('id', eventId).single()
    if (!eventData) {
      router.replace('/(tabs)/events')
      return
    }
    setEvent(eventData as EventRow)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const waitPayment = paymentParam === 'success'
      let myP: { id: string } | null = null
      const maxAttempts = waitPayment ? 10 : 1
      for (let i = 0; i < maxAttempts; i++) {
        const { data } = await supabase
          .from('event_participants')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (data) {
          myP = data as { id: string }
          break
        }
        if (waitPayment && i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 800))
      }
      setJoined(!!myP)
    }
    const { count } = await supabase
      .from('event_participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
    setParticipantCount(count ?? 0)
    setLoading(false)
  }, [eventId, router, paymentParam])

  useEffect(() => {
    void loadCore()
  }, [loadCore])

  useEffect(() => {
    if (createdParam !== '1') return
    const t0 = setTimeout(() => setShowShareSheet(true), 400)
    setShowCreatedToast(true)
    const t1 = setTimeout(() => setShowCreatedToast(false), 6500)
    const t2 = setTimeout(() => router.replace(`/events/${eventId}`), 300)
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [createdParam, router, eventId])

  const handleJoin = async () => {
    if (!userId || !event || joining || joined) return
    setJoining(true)
    try {
      if (eventRequiresPayment(event)) {
        const data = await wanspotFetchJson<{ url?: string; error?: string }>('/api/stripe/payment-intent', {
          method: 'POST',
          json: { eventId: event.id },
        })
        if (data.url) {
          await Linking.openURL(data.url)
          return
        }
        Alert.alert('', typeof data.error === 'string' ? data.error : '決済の開始に失敗しました')
        return
      }
      await supabase.from('event_participants').insert({ event_id: event.id, user_id: userId })
      setJoined(true)
      setParticipantCount((c) => c + 1)
      onJoinedFree?.()
    } finally {
      setJoining(false)
    }
  }

  const handleCancelJoin = () => {
    if (!userId || !event || joining || !joined) return
    Alert.alert('確認', CANCEL_CONFIRM_MESSAGE, [
      { text: '戻る', style: 'cancel' },
      {
        text: 'キャンセルする',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setJoining(true)
            try {
              await supabase.from('event_participants').delete().eq('event_id', event.id).eq('user_id', userId)
              setJoined(false)
              setParticipantCount((c) => Math.max(0, c - 1))
            } finally {
              setJoining(false)
            }
          })()
        },
      },
    ])
  }

  const share = async (platform: string) => {
    if (!event) return
    const url = wanspotPublicUrl(`/events/${eventId}`)
    const text = `${event.title}｜wanspotでイベントを開催します🐾`
    if (platform === 'x') {
      await Linking.openURL(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
      )
    } else if (platform === 'line') {
      await Linking.openURL(`https://line.me/R/msg/text/?${encodeURIComponent(`${text}\n${url}`)}`)
    } else if (platform === 'copy') {
      await Share.share({ message: url })
    }
    setShowShareSheet(false)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 32
  const topBar = Math.max(56, 40 + insets.top)

  if (loading) {
    return (
      <View style={styles.loadRoot}>
        <RunningDog label="イベント詳細を読み込み中..." />
      </View>
    )
  }

  if (!event) return null

  const isFull = event.capacity != null && participantCount >= event.capacity

  return (
    <View style={styles.root}>
      {showCreatedToast ? (
        <View style={[styles.createdToast, { top: Math.max(16, insets.top) }]}>
          <Text style={styles.createdToastTxt}>
            公開しました。マイページの「主催したイベント」からいつでも編集できます。
          </Text>
        </View>
      ) : null}

      <View style={[styles.topActions, { paddingTop: topBar }]}>
        <Pressable style={styles.circleBtn} onPress={() => router.back()}>
          <IconChevronLeft />
        </Pressable>
        <Pressable style={styles.circleBtnLight} onPress={() => setShowShareSheet(true)}>
          <IconShare />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: topBar + 8 }}>
          <View style={styles.thumbCard}>
            <View style={styles.thumbInner}>
              {event.thumbnail_url ? (
                <Image source={{ uri: event.thumbnail_url }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <View style={[styles.thumbImg, styles.thumbPh]}>
                  <DogPh />
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.pad}>
          <View style={styles.card}>
            {event.tags && event.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {event.tags.map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagTxt}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.title}>{event.title}</Text>
            {event.price != null ? (
              <Text style={[styles.price, event.price === 0 && styles.priceFree]}>
                {event.price === 0 ? '無料' : `参加費 ¥${event.price.toLocaleString('ja-JP')}`}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            {event.event_at ? (
              <View style={styles.row}>
                <IconCalendar />
                <Text style={styles.rowTxt}>{formatDate(event.event_at)}</Text>
              </View>
            ) : null}
            {event.location_name ? (
              <View style={styles.row}>
                <IconPin />
                <View>
                  <Text style={styles.rowTxt}>{event.location_name}</Text>
                  {event.area ? <Text style={styles.areaSub}>{event.area}</Text> : null}
                </View>
              </View>
            ) : null}
            <View style={styles.row}>
              <IconUsers />
              <Text style={styles.rowTxt}>
                {participantCount}人参加{event.capacity != null ? ` / 定員${event.capacity}人` : ''}
              </Text>
            </View>
          </View>

          {event.description ? (
            <View style={styles.card}>
              <Text style={styles.secLbl}>イベント詳細</Text>
              <Text style={styles.desc}>{event.description}</Text>
            </View>
          ) : null}

          {joined ? (
            <View style={styles.joinedBlock}>
              <View style={styles.joinedRow}>
                <View style={styles.joinedPill}>
                  <Text style={styles.joinedPillTxt}>参加予定</Text>
                </View>
                {eventRequiresPayment(event) ? (
                  <View style={styles.paidBadge}>
                    <Text style={styles.paidBadgeTxt}>✓ 支払い済み</Text>
                  </View>
                ) : null}
              </View>
              <Pressable style={styles.cancelBtn} onPress={handleCancelJoin} disabled={!userId || joining}>
                <Text style={styles.cancelBtnTxt}>{joining ? '処理中...' : 'キャンセル'}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.joinBtn, isFull && styles.joinBtnFull]}
              onPress={() => void handleJoin()}
              disabled={!userId || joining || isFull}
            >
              <Text style={[styles.joinBtnTxt, isFull && styles.joinBtnTxtFull]}>
                {joining ? '処理中...' : isFull ? '満員です' : '参加する'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <Modal visible={showShareSheet} transparent animationType="slide" onRequestClose={() => setShowShareSheet(false)}>
        <Pressable style={styles.shareOverlay} onPress={() => setShowShareSheet(false)}>
          <Pressable style={[styles.shareSheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grab} />
            <Text style={styles.shareHead}>イベントをシェアする</Text>
            <Text style={styles.shareSub}>友達を誘ってみよう🐾</Text>
            <View style={styles.shareGrid}>
              <Pressable style={styles.shareX} onPress={() => void share('x')}>
                <IconX />
                <Text style={styles.shareLblW}>X</Text>
              </Pressable>
              <Pressable style={styles.shareLine} onPress={() => void share('line')}>
                <FontAwesome5 name="line" size={22} color="#fff" brand />
                <Text style={styles.shareLblW}>LINE</Text>
              </Pressable>
              <Pressable style={styles.shareCopy} onPress={() => void share('copy')}>
                <IconCopy />
                <Text style={styles.shareLbl}>コピー</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  loadRoot: { flex: 1, backgroundColor: '#f7f6f3', justifyContent: 'center' },
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  createdToast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 60,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  createdToastTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  circleBtnLight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  thumbCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#ebebeb', backgroundColor: '#FFF9E0' },
  thumbInner: { height: 224, position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tagPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFF9E0' },
  tagTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  priceFree: { color: '#34A853' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  rowTxt: { flex: 1, fontSize: 14, color: '#555', lineHeight: 22 },
  areaSub: { fontSize: 12, color: '#aaa', marginTop: 4 },
  secLbl: { fontSize: 12, fontWeight: '800', color: '#aaa', letterSpacing: 0.6, marginBottom: 8 },
  desc: { fontSize: 14, lineHeight: 22, color: '#555' },
  joinedBlock: { gap: 8 },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinedPill: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#9ca3af',
    alignItems: 'center',
  },
  joinedPillTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  paidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  paidBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  cancelBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelBtnTxt: { fontSize: 14, fontWeight: '800', color: '#fca5a5' },
  joinBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
  },
  joinBtnFull: { backgroundColor: '#f5f5f5' },
  joinBtnTxt: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  joinBtnTxtFull: { color: '#bbb' },
  shareOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  shareSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e8e8e8', alignSelf: 'center', marginBottom: 16 },
  shareHead: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  shareSub: { fontSize: 12, color: '#aaa', marginBottom: 16 },
  shareGrid: { flexDirection: 'row', gap: 12 },
  shareX: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#000' },
  shareLine: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#06C755' },
  shareCopy: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#f5f5f5' },
  shareLbl: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  shareLblW: { fontSize: 12, fontWeight: '800', color: '#fff' },
})
