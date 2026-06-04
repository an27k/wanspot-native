import { useEffect, useState } from 'react'
import { Image } from 'expo-image'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg'
import { RunningDog } from '@/components/DogStates'
import { IconPaw } from '@/components/IconPaw'
import { HEART_ICON } from '@/lib/constants'
import { formatDistanceLabel, calcDistanceMeters } from '@/lib/nearby/geo'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import { fetchUserWalkAreaTags } from '@/lib/fetch-user-walk-area-tags'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetch } from '@/lib/wanspot-api'

const IconStar = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="#FF8A1F" stroke="#FF8A1F" strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

const IconHeart = ({ filled }: { filled: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill={filled ? HEART_ICON.filled : 'none'}
      stroke={filled ? HEART_ICON.filled : HEART_ICON.strokeEmpty}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

const IconGoogle = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
)

const IconMoney = ({ filled }: { filled: boolean }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill={filled ? '#FF8A1F' : '#e8e8e8'}>
    <Circle cx="12" cy="12" r="10" />
    <SvgText x="12" y="16" textAnchor="middle" fontSize="12" fill={filled ? '#2b2a28' : '#bbb'} fontWeight="bold">
      ¥
    </SvgText>
  </Svg>
)

const PriceLevel = ({ level }: { level: number | null }) => {
  if (level === null || level === undefined) return <Text style={styles.qMark}>?</Text>
  return (
    <View style={styles.priceRow}>
      {[1, 2, 3, 4].map((i) => (
        <IconMoney key={i} filled={i <= level} />
      ))}
    </View>
  )
}

export function NearbySheetSpotCard({
  spot,
  userLocation,
  onPress,
  compact = false,
  variant = 'list',
  liked = false,
  onToggleLike,
  onClose,
}: {
  spot: SheetSpot
  userLocation: { lat: number; lng: number } | null
  onPress: () => void
  compact?: boolean
  /** list: 右上にいいね / popup: 右上に×（ピン真上のポップアップ用） */
  variant?: 'list' | 'popup'
  liked?: boolean
  onToggleLike?: () => void
  onClose?: () => void
}) {
  const [userWalkTags, setUserWalkTags] = useState<string[]>([])
  const [aiSummary, setAiSummary] = useState<{ keywords: string[]; summary: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const uri = spotPhotoUrl(spot.photoRef)

  useEffect(() => {
    void fetchUserWalkAreaTags(supabase).then(setUserWalkTags)
  }, [])

  const handleAiSummary = async () => {
    if (aiSummary || aiLoading) return
    setAiLoading(true)
    const res = await wanspotFetch('/api/ai-summary', {
      method: 'POST',
      json: {
        place_id: spot.placeId,
        name: spot.name,
        category: spot.category,
        rating: spot.rating,
        address: spot.address,
        reviews: [],
        userContext: {
          walkAreaTags: userWalkTags,
          lat: userLocation?.lat ?? null,
          lng: userLocation?.lng ?? null,
        },
      },
    })
    const data = (await res.json()) as { keywords?: string[]; summary?: string }
    setAiSummary(
      data.keywords && data.summary
        ? { keywords: data.keywords, summary: data.summary }
        : { keywords: [], summary: typeof data.summary === 'string' ? data.summary : '' }
    )
    setAiLoading(false)
  }

  const distLabel =
    userLocation &&
    formatDistanceLabel(calcDistanceMeters(userLocation.lat, userLocation.lng, spot.lat, spot.lng))

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact, variant === 'popup' && styles.cardPopup]}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {variant === 'popup' ? (
        <TouchableOpacity
          style={styles.cornerBtn}
          onPress={(e) => {
            e.stopPropagation?.()
            onClose?.()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="閉じる"
        >
          <Ionicons name="close" size={18} color="#2b2a28" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.cornerBtn}
          onPress={(e) => {
            e.stopPropagation?.()
            onToggleLike?.()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'いいねを外す' : 'いいね'}
        >
          <IconHeart filled={liked} />
        </TouchableOpacity>
      )}

      {!compact && uri ? (
        <View style={styles.cardPhoto}>
          <Image source={{ uri }} style={styles.cardImg} contentFit="cover" {...remoteImageExpoProps} />
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.spotCat}>{spot.category}</Text>
          <View style={styles.cardMeta}>
            {spot.rating ? (
              <View style={styles.rateRow}>
                <IconGoogle />
                <IconStar />
                <Text style={styles.rateSmall}>{spot.rating}</Text>
                <PriceLevel level={spot.priceLevel} />
              </View>
            ) : null}
            {distLabel ? <Text style={styles.distSmall}>{distLabel}</Text> : null}
          </View>
        </View>
        <Text style={styles.spotName} numberOfLines={compact ? 1 : 2}>
          {spot.name}
        </Text>
        {!compact ? <Text style={styles.spotAddr} numberOfLines={2}>{spot.address}</Text> : null}
        {!aiSummary && !aiLoading ? (
          <TouchableOpacity
            style={styles.aiBtn}
            onPress={(e) => {
              e.stopPropagation?.()
              void handleAiSummary()
            }}
          >
            <IconPaw size={11} color="#aaa" />
            <Text style={styles.aiBtnTxt}> AIまとめを見る</Text>
          </TouchableOpacity>
        ) : null}
        {aiLoading ? <RunningDog label="AIまとめを生成中..." /> : null}
        {aiSummary && !aiLoading ? (
          <View style={styles.aiBox}>
            <View style={styles.kwRow}>
              {aiSummary.keywords.map((kw) => (
                <Text key={kw} style={styles.kw}>
                  {kw}
                </Text>
              ))}
            </View>
            <Text style={styles.aiSum} numberOfLines={compact ? 3 : undefined}>
              {aiSummary.summary}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebebeb',
    marginBottom: 12,
  },
  cardCompact: { marginBottom: 0 },
  cardPopup: { marginBottom: 0 },
  cornerBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#ebebeb',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cardPhoto: { height: 120, backgroundColor: '#e8e4de' },
  cardImg: { width: '100%', height: '100%' },
  cardBody: { padding: 12, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spotCat: {
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#FFF1E3',
    color: '#2b2a28',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateSmall: { fontSize: 12, color: '#888' },
  distSmall: { fontSize: 12, color: '#aaa' },
  spotName: { fontWeight: '700', fontSize: 14, color: '#2b2a28' },
  spotAddr: { fontSize: 12, color: '#aaa' },
  aiBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  aiBtnTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
  aiBox: { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: '#FFFBEC' },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kw: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FF8A1F',
    color: '#2b2a28',
  },
  aiSum: { fontSize: 12, lineHeight: 18, color: '#555' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  qMark: { fontSize: 12, color: '#ccc' },
})
