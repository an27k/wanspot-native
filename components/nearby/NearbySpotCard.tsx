import { useEffect, useRef, useState } from 'react'
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg'
import { RunningDog } from '@/components/DogStates'
import { IconPaw } from '@/components/IconPaw'
import { HEART_ICON } from '@/lib/constants'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
import { track } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetch } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const IconHeart = ({ filled }: { filled: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
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

const IconStar = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="#FFD84D" stroke="#FFD84D" strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

const IconMoney = ({ filled }: { filled: boolean }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill={filled ? '#FFD84D' : '#e8e8e8'}>
    <Circle cx="12" cy="12" r="10" />
    <SvgText x="12" y="16" textAnchor="middle" fontSize="12" fill={filled ? '#1a1a1a' : '#bbb'} fontWeight="bold">
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

const IconGoogle = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
)

export function NearbySpotCard({
  spot,
  likeCount,
  userLocation,
  userWalkTags,
  onOpenDetail,
  onLikeStateChange,
}: {
  spot: PlaceResult
  likeCount: number
  userLocation: { lat: number; lng: number } | null
  userWalkTags: string[]
  onOpenDetail: (id: string) => void
  onLikeStateChange?: (placeId: string, liked: boolean) => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const [spotId, setSpotId] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [localLikeCount, setLocalLikeCount] = useState(likeCount)
  const [likeLoading, setLikeLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<{ keywords: string[]; summary: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const uri = spotPhotoUrl(spot.photo_ref, 288)

  useEffect(() => {
    setLocalLikeCount(likeCount)
  }, [likeCount])

  useEffect(() => {
    const fetchLikeData = async () => {
      const { data: spotRow } = await supabase.from('spots').select('id').eq('place_id', spot.place_id).single()
      if (!spotRow) return
      setSpotId(spotRow.id)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: myLike } = await supabase
          .from('spot_likes')
          .select('id')
          .eq('spot_id', spotRow.id)
          .eq('user_id', user.id)
          .maybeSingle()
        setLiked(!!myLike)
      }
    }
    void fetchLikeData()
  }, [spot.place_id])

  const handleOpenDetail = async () => {
    if (spotId) {
      onOpenDetail(spotId)
      return
    }
    const { data: spotRow, error } = await supabase
      .from('spots')
      .upsert(
        {
          place_id: spot.place_id,
          name: spot.name,
          category: spot.category,
          address: spot.address,
          lat: spot.lat,
          lng: spot.lng,
          rating: spot.rating,
          price_level: spot.price_level,
          ...(Array.isArray(spot.types) && spot.types.length > 0
            ? { google_types: spot.types.filter((t): t is string => typeof t === 'string') }
            : {}),
        },
        { onConflict: 'place_id' }
      )
      .select('id')
      .single()
    if (!error && spotRow) {
      setSpotId(spotRow.id)
      onOpenDetail(spotRow.id)
    }
  }

  const handleLike = async () => {
    if (likeLoading) return
    playLikeHeartAnimation(scaleAnim)
    setLikeLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLikeLoading(false)
      return
    }

    if (!liked) {
      const { data: spotRow, error: spotErr } = await supabase
        .from('spots')
        .upsert(
          {
            place_id: spot.place_id,
            name: spot.name,
            category: spot.category,
            address: spot.address,
            lat: spot.lat,
            lng: spot.lng,
            rating: spot.rating,
            price_level: spot.price_level,
            ...(Array.isArray(spot.types) && spot.types.length > 0
              ? { google_types: spot.types.filter((t): t is string => typeof t === 'string') }
              : {}),
          },
          { onConflict: 'place_id' }
        )
        .select('id')
        .single()
      if (spotErr || !spotRow) {
        setLikeLoading(false)
        return
      }
      await supabase.from('spot_likes').insert({ user_id: user.id, spot_id: spotRow.id })
      setLiked(true)
      setLocalLikeCount((c) => c + 1)
      onLikeStateChange?.(spot.place_id, true)
      track('spot_liked', { spot_id: spotRow.id })
    } else {
      const { data: spotRow } = await supabase.from('spots').select('id').eq('place_id', spot.place_id).single()
      if (spotRow)
        await supabase.from('spot_likes').delete().eq('user_id', user.id).eq('spot_id', spotRow.id)
      setLiked(false)
      setLocalLikeCount((c) => Math.max(0, c - 1))
      onLikeStateChange?.(spot.place_id, false)
    }
    setLikeLoading(false)
  }

  const handleAiSummary = async () => {
    if (aiSummary || aiLoading) return
    setAiLoading(true)
    const res = await wanspotFetch('/api/ai-summary', {
      method: 'POST',
      json: {
        place_id: spot.place_id,
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
      data.keywords && data.summary ? { keywords: data.keywords, summary: data.summary } : {
        keywords: [],
        summary: typeof data.summary === 'string' ? data.summary : '',
      }
    )
    setAiLoading(false)
  }

  const distLabel =
    userLocation &&
    (() => {
      const d = calcDistance(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
      return d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`
    })()

  return (
    <TouchableOpacity style={styles.card} onPress={handleOpenDetail} activeOpacity={0.95}>
      <View style={styles.cardPhoto}>
        {uri ? <Image source={{ uri }} style={styles.cardImg} resizeMode="cover" /> : null}
        <View style={styles.heartCol}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              onPress={() => void handleLike()}
              disabled={likeLoading}
              style={styles.heartCircle}
            >
              <IconHeart filled={liked} />
            </TouchableOpacity>
          </Animated.View>
          {localLikeCount > 0 ? (
            <Text style={styles.likeCnt}>{localLikeCount}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.spotCat}>{spot.category}</Text>
          <View style={styles.cardMeta}>
            {spot.rating ? (
              <View style={styles.rateRow}>
                <IconGoogle />
                <IconStar />
                <Text style={styles.rateSmall}>{spot.rating}</Text>
                <PriceLevel level={spot.price_level} />
              </View>
            ) : null}
            {distLabel ? <Text style={styles.distSmall}>{distLabel}</Text> : null}
          </View>
        </View>
        <Text style={styles.spotName}>{spot.name}</Text>
        <Text style={styles.spotAddr}>{spot.address}</Text>
        {!aiSummary && !aiLoading ? (
          <TouchableOpacity style={styles.aiBtn} onPress={() => void handleAiSummary()}>
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
            <Text style={styles.aiSum}>{aiSummary.summary}</Text>
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
  },
  cardPhoto: { height: 144, backgroundColor: '#e8e4de', position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  heartCol: { position: 'absolute', top: 8, right: 8, alignItems: 'center', gap: 4 },
  heartCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCnt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C9A227',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardBody: { padding: 12, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spotCat: {
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#FFF9E0',
    color: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateSmall: { fontSize: 12, color: '#888' },
  distSmall: { fontSize: 12, color: '#aaa' },
  spotName: { fontWeight: '700', fontSize: 14, color: '#1a1a1a' },
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
    backgroundColor: '#FFD84D',
    color: '#1a1a1a',
  },
  aiSum: { fontSize: 12, lineHeight: 18, color: '#555' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  qMark: { fontSize: 12, color: '#ccc' },
})
