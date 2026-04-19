import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg'
import { TOKENS } from '@/constants/color-tokens'
import { getCategoryLabel } from '@/lib/ai-plan/category-labels'
import { spotPhotoUrl } from '@/lib/wanspot-api'
import type { AiPlanStop } from '@/components/ai-plan/types'

const IconStar = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill={TOKENS.brand.yellow} stroke={TOKENS.brand.yellow} strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

const IconMoney = ({ filled }: { filled: boolean }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill={filled ? TOKENS.brand.yellow : '#e8e8e8'}>
    <Circle cx="12" cy="12" r="10" />
    <SvgText
      x="12"
      y="16"
      textAnchor="middle"
      fontSize="12"
      fill={filled ? TOKENS.text.primary : '#bbb'}
      fontWeight="bold"
    >
      ¥
    </SvgText>
  </Svg>
)

const PriceLevel = ({ level }: { level: number | null }) => {
  if (level === null || level === undefined) {
    return <Text style={styles.q}>?</Text>
  }
  return (
    <View style={styles.priceRow}>
      {[1, 2, 3, 4].map((i) => (
        <IconMoney key={i} filled={i <= level} />
      ))}
    </View>
  )
}

const IconGoogle = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </Svg>
)

export type AiPlanSpotDbRow = {
  photo_ref: string | null
  name: string | null
  address: string | null
  category: string | null
  rating: number | null
  price_level: number | null
} | null

/**
 * 現在地タブの SpotListCard と同系のレイアウト（写真・カテゴリ・名前・住所・評価）。
 * AI プラン固有の滞在時間バッジと note はオーバーレイ／直下に追加。
 */
export function AiPlanSpotCard({
  stop,
  db,
  onPress,
}: {
  stop: AiPlanStop
  db: AiPlanSpotDbRow
  onPress: () => void
}) {
  const photoRef = db?.photo_ref ?? null
  const uri = spotPhotoUrl(photoRef, 288)
  const dwellMinutes = stop.dwell_minutes ?? 0
  const note = stop.note?.trim() ?? ''
  const catLabel = getCategoryLabel(stop)
  const title = stop.name ?? db?.name ?? 'スポット'
  const address = db?.address?.trim() ? db.address : '—'
  const displayRating = typeof db?.rating === 'number' ? db.rating : null
  const priceLevel = typeof db?.price_level === 'number' ? db.price_level : null
  const showRatingRow = displayRating != null && displayRating > 0

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
        <View style={styles.photoWrap}>
          {uri ? <Image source={{ uri }} style={styles.photo} resizeMode="cover" /> : null}
          <View style={styles.dwellBadge}>
            <Text style={styles.dwellBadgeTxt}>{dwellMinutes}分滞在</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.rowTop}>
            <Text style={styles.cat}>{catLabel}</Text>
            <View style={styles.metaRight}>
              {showRatingRow ? (
                <View style={styles.rateRow}>
                  <IconGoogle />
                  <IconStar />
                  <Text style={styles.rateTxt}>{displayRating}</Text>
                  <PriceLevel level={priceLevel} />
                </View>
              ) : null}
            </View>
          </View>
          <Text style={styles.name}>{title}</Text>
          <Text style={styles.addr}>{address}</Text>
        </View>
      </TouchableOpacity>

      {note ? (
        <Text style={styles.note} numberOfLines={6}>
          {note}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  photoWrap: {
    height: 144,
    backgroundColor: TOKENS.surface.mapMuted,
    position: 'relative',
  },
  photo: { width: '100%', height: '100%' },
  dwellBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: TOKENS.brand.yellow,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dwellBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: TOKENS.text.primary,
  },
  body: { paddingHorizontal: 14, paddingVertical: 14, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cat: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontWeight: '700',
    backgroundColor: TOKENS.brand.yellowLight,
    color: TOKENS.text.primary,
  },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateTxt: { fontSize: 12, color: TOKENS.text.tertiary },
  name: { fontWeight: '700', fontSize: 14, color: TOKENS.text.primary },
  addr: { fontSize: 12, color: TOKENS.text.tertiary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  q: { fontSize: 12, color: TOKENS.text.hint },
  note: {
    fontSize: 13,
    color: TOKENS.text.secondary,
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 4,
  },
})
