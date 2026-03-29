import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { UiIconCalendar, UiIconPin } from '@/components/ui-icons'
import { colors } from '@/constants/colors'

export type WanspotEventRow = {
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
  tags?: string[] | null
  is_official?: boolean
  creator_id?: string
}

type Props = {
  event: WanspotEventRow
  onPressDetail: () => void
  /** 参加予定タブ: 支払い済みバッジ */
  variant?: 'default' | 'joined'
}

const DogPlaceholder = () => (
  <Text style={{ fontSize: 34, lineHeight: 40 }} accessible={false}>
    🐾
  </Text>
)

export function isEventFull(event: Pick<WanspotEventRow, 'capacity' | 'current_count'>): boolean {
  const cap = event.capacity
  if (cap == null || !Number.isFinite(cap) || cap <= 0) return false
  const count = Number(event.current_count ?? 0)
  const n = Number.isFinite(count) ? count : 0
  return n >= cap
}

export function EventCard({ event, onPressDetail, variant = 'default' }: Props) {
  const full = isEventFull(event)
  const isPaid = event.price != null && event.price > 0
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <View style={styles.card}>
      <View style={styles.banner}>
        {event.thumbnail_url ? (
          <Image source={{ uri: event.thumbnail_url }} style={styles.bannerImg} resizeMode="cover" />
        ) : (
          <View style={[styles.bannerImg, styles.bannerPh]}>
            <DogPlaceholder />
          </View>
        )}
        {full ? (
          <View style={styles.fullBadge}>
            <Text style={styles.fullBadgeTxt}>満員</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {variant === 'joined' ? (
          <View style={styles.joinedRow}>
            {isPaid ? (
              <View style={styles.paidPill}>
                <Text style={styles.paidPillTxt}>✓ 支払い済み</Text>
              </View>
            ) : (
              <Text style={styles.joinedLbl}>参加予定</Text>
            )}
          </View>
        ) : null}
        {event.tags && event.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {event.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagTxt}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.meta}>
          {event.price != null ? (
            <Text style={styles.price}>{event.price === 0 ? '無料' : `¥${event.price.toLocaleString('ja-JP')}`}</Text>
          ) : null}
          {event.event_at ? (
            <View style={styles.metaLine}>
              <UiIconCalendar />
              <Text style={styles.metaTxt}>{formatDate(event.event_at)}</Text>
            </View>
          ) : null}
          {event.capacity != null ? (
            <Text style={styles.capTxt}>
              {event.current_count ?? 0} / {event.capacity}人参加
            </Text>
          ) : null}
          {event.location_name ? (
            <View style={styles.metaLine}>
              <UiIconPin />
              <Text style={styles.metaTxt}>{event.location_name}</Text>
            </View>
          ) : null}
        </View>
        <Pressable style={styles.detailBtn} onPress={onPressDetail}>
          <Text style={styles.detailBtnTxt}>詳細を見る</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb' },
  banner: { width: '100%', height: 160, position: 'relative', backgroundColor: '#FFF9E0' },
  bannerImg: { width: '100%', height: '100%' },
  bannerPh: { alignItems: 'center', justifyContent: 'center' },
  fullBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E84335',
  },
  fullBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  body: { padding: 16 },
  joinedRow: { marginBottom: 8 },
  paidPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  paidPillTxt: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  joinedLbl: { fontSize: 12, fontWeight: '800', color: '#888' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tagPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFF9E0' },
  tagTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  title: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  meta: { gap: 6, marginBottom: 12 },
  price: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt: { fontSize: 12, color: '#888' },
  capTxt: { fontSize: 12, color: '#aaa' },
  detailBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ebebeb',
    alignItems: 'center',
  },
  detailBtnTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
})
