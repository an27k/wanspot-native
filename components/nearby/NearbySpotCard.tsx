import { useEffect, useRef, useState } from 'react'
import { WanspotIconHeart } from '@/components/icons/WanspotIconHeart'
import { Image } from 'expo-image'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { listImageExpoProps } from '@/lib/images/remoteImageDefaults'
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg'
import { HEART_ICON } from '@/lib/constants'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
import { track } from '@/lib/analytics'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import { supabase } from '@/lib/supabase'
import { ensureSpotId } from '@/lib/ensureSpot'
import { openSpotDetailFromPlace } from '@/lib/open-spot-detail'
import { spotPhotoUrl } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'

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
  <WanspotIconHeart size={16} filled={filled} />
)

const IconStar = ({ color }: { color: string }) => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

const IconMoney = ({ filled, colors }: { filled: boolean; colors: AppColors }) => (
  <Svg
    width={10}
    height={10}
    viewBox="0 0 24 24"
    fill={filled ? colors.primary : colors.borderEmphasis}
  >
    <Circle cx="12" cy="12" r="10" />
    <SvgText
      x="12"
      y="16"
      textAnchor="middle"
      fontSize="12"
      fill={filled ? colors.onPrimary : colors.textMuted}
      fontWeight="bold"
    >
      ¥
    </SvgText>
  </Svg>
)

const PriceLevel = ({ level, colors }: { level: number | null; colors: AppColors }) => {
  if (level === null || level === undefined) {
    return <Text style={[type.caption, { color: colors.textHint }]}>?</Text>
  }
  return (
    <View style={iconStyles.priceRow}>
      {[1, 2, 3, 4].map((i) => (
        <IconMoney key={i} filled={i <= level} colors={colors} />
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
  initialSpotId = null,
  initiallyLiked = false,
  onLikeStateChange,
}: {
  spot: PlaceResult
  likeCount: number
  userLocation: { lat: number; lng: number } | null
  userWalkTags: string[]
  initialSpotId?: string | null
  initiallyLiked?: boolean
  onLikeStateChange?: (placeId: string, liked: boolean) => void
}) {
  const router = useRouter()
  const requireAuth = useRequireAuth()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const [spotId, setSpotId] = useState<string | null>(initialSpotId)
  const [liked, setLiked] = useState(initiallyLiked)
  const [localLikeCount, setLocalLikeCount] = useState(likeCount)
  const [likeLoading, setLikeLoading] = useState(false)
  const uri = spotPhotoUrl(spot.photo_ref, 'thumbnail')

  useEffect(() => {
    setLocalLikeCount(likeCount)
  }, [likeCount])

  useEffect(() => {
    setSpotId(initialSpotId)
  }, [initialSpotId])

  useEffect(() => {
    setLiked(initiallyLiked)
  }, [initiallyLiked])

  const handleOpenDetail = () => {
    openSpotDetailFromPlace(router, spot, spotId)
  }

  const handleLike = async () => {
    if (likeLoading) return
    playLikeHeartAnimation(scaleAnim)
    setLikeLoading(true)
    if (!requireAuth('いいねはアカウントに保存されます。')) {
      setLikeLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLikeLoading(false)
      return
    }

    if (!liked) {
      const ensuredId = await ensureSpotId(spot)
      if (!ensuredId) {
        setLikeLoading(false)
        return
      }
      await supabase.from('spot_likes').insert({ user_id: user.id, spot_id: ensuredId })
      setLiked(true)
      setLocalLikeCount((c) => c + 1)
      onLikeStateChange?.(spot.place_id, true)
      track('spot_liked', { spot_id: ensuredId })
    } else {
      const ensuredId = spotId ?? (await ensureSpotId(spot))
      if (ensuredId) {
        await supabase.from('spot_likes').delete().eq('user_id', user.id).eq('spot_id', ensuredId)
      }
      setLiked(false)
      setLocalLikeCount((c) => Math.max(0, c - 1))
      onLikeStateChange?.(spot.place_id, false)
    }
    setLikeLoading(false)
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
        {uri ? (
          <Image source={{ uri }} style={styles.cardImg} contentFit="cover" recyclingKey={uri} {...listImageExpoProps} />
        ) : null}
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
                <IconStar color={colors.primary} />
                <Text style={styles.rateSmall}>{spot.rating}</Text>
                <PriceLevel level={spot.price_level} colors={colors} />
              </View>
            ) : null}
            {distLabel ? <Text style={styles.distSmall}>{distLabel}</Text> : null}
          </View>
        </View>
        <Text style={styles.spotName}>{spot.name}</Text>
        <Text style={styles.spotAddr}>{spot.address}</Text>
      </View>
    </TouchableOpacity>
  )
}

const iconStyles = StyleSheet.create({
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
})

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPhoto: { height: 144, backgroundColor: colors.mapMuted, position: 'relative' },
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
    ...type.label,
    color: HEART_ICON.filled,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardBody: { padding: 12, gap: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spotCat: {
    ...type.label,
    backgroundColor: colors.tintStrong,
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateSmall: { ...type.caption, color: colors.textSecondary },
  // 距離は右端に単独で置く数値。行内の他のメタより太くして目的地までの遠近を拾えるようにする
  distSmall: { ...type.caption, fontWeight: '700' as const, color: colors.textMuted },
  // 一覧の視線の起点。ここが14pxだとカードの中で写真しか目に入らない
  spotName: { ...type.heading, color: colors.textPrimary },
  spotAddr: { ...type.caption, color: colors.textMuted },
})
