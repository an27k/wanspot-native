import { useRef, useState } from 'react'
import { Image } from 'expo-image'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { listImageExpoProps } from '@/lib/images/remoteImageDefaults'
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg'
import { PressableScale } from '@/components/common/PressableScale'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import { HEART_ICON } from '@/lib/constants'
import { ensureSpotId } from '@/lib/ensureSpot'
import { openSpotDetailFromPlace } from '@/lib/open-spot-detail'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'
import { GoogleGlassPanel } from '@/components/search/GoogleGlassPanel'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { colors } from '@/constants/colors'

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

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

const IconStar = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill={colors.primary} stroke={colors.primary} strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

const IconMoney = ({ filled }: { filled: boolean }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill={filled ? colors.primary : '#e8e8e8'}>
    <Circle cx="12" cy="12" r="10" />
    <SvgText x="12" y="16" textAnchor="middle" fontSize="12" fill={filled ? colors.textPrimary : '#bbb'} fontWeight="bold">
      ¥
    </SvgText>
  </Svg>
)

const PriceLevel = ({ level }: { level: number | null | undefined }) => {
  if (level === null || level === undefined) return null
  return (
    <View style={styles.priceRow}>
      {[1, 2, 3, 4].map((i) => (
        <IconMoney key={i} filled={i <= level} />
      ))}
    </View>
  )
}

type Props = {
  spot: PlaceResult
  userLocation: { lat: number; lng: number } | null
  userWalkTags?: string[]
  onOpen?: (spotId: string, place: PlaceResult) => void
  onLikesChange?: () => void
  onBeforeNavigate?: () => void
  /** google = 検索タブのグラデ背景向けダークガラス */
  chrome?: 'light' | 'google'
}

export function SearchDiscoverResultCard({
  spot,
  userLocation,
  onLikesChange,
  onBeforeNavigate,
  chrome = 'light',
}: Props) {
  const router = useRouter()
  const isGoogle = chrome === 'google'
  const requireAuth = useRequireAuth()
  const [liked, setLiked] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const likeScale = useRef(new Animated.Value(1)).current
  const photoUrl = spotPhotoUrl(spot.photo_ref, 'thumbnail')

  const dist =
    userLocation && spot.lat && spot.lng
      ? formatDist(calcDistance(userLocation.lat, userLocation.lng, spot.lat, spot.lng))
      : null

  const handleOpen = () => {
    onBeforeNavigate?.()
    openSpotDetailFromPlace(router, spot)
  }

  const handleLike = async (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.()
    if (likeLoading) return
    playLikeHeartAnimation(likeScale)
    setLikeLoading(true)
    if (!requireAuth('いいねするにはログインしてください。')) {
      setLikeLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLikeLoading(false)
      return
    }
    const sid = await ensureSpotId(spot)
    if (!sid) {
      setLikeLoading(false)
      return
    }
    if (!liked) {
      await supabase.from('spot_likes').insert({ user_id: user.id, spot_id: sid })
      setLiked(true)
      onLikesChange?.()
    } else {
      await supabase.from('spot_likes').delete().eq('user_id', user.id).eq('spot_id', sid)
      setLiked(false)
      onLikesChange?.()
    }
    setLikeLoading(false)
  }

  const inner = (
    <View style={[styles.card, isGoogle && styles.cardGoogle]}>
      <PressableScale onPress={handleOpen}>
        <View style={[styles.thumbWrap, isGoogle && styles.thumbWrapGoogle]}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.thumb}
              contentFit="cover"
              recyclingKey={photoUrl}
              {...listImageExpoProps}
            />
          ) : (
            <View style={[styles.thumb, styles.ph]} />
          )}
          <Pressable
            style={styles.heartFab}
            onPress={(ev) => void handleLike(ev)}
            disabled={likeLoading}
          >
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <IconHeart filled={liked} />
            </Animated.View>
          </Pressable>
        </View>
        <View style={styles.body}>
          <View style={styles.row1}>
            <View style={[styles.catPill, isGoogle && styles.catPillGoogle]}>
              <Text style={[styles.catTxt, isGoogle && styles.catTxtGoogle]}>{spot.category}</Text>
            </View>
            <View style={styles.metaRight}>
              {dist ? <Text style={[styles.dist, isGoogle && styles.distGoogle]}>{dist}</Text> : null}
              {spot.rating != null && spot.rating > 0 ? (
                <View style={styles.rateRow}>
                  <IconGoogle />
                  <IconStar />
                  <Text style={[styles.rateTxt, isGoogle && styles.rateTxtGoogle]}>{spot.rating}</Text>
                  <PriceLevel level={spot.price_level} />
                </View>
              ) : null}
            </View>
          </View>
          <Text style={[styles.name, isGoogle && styles.nameGoogle]}>{spot.name}</Text>
          <Text style={[styles.addr, isGoogle && styles.addrGoogle]} numberOfLines={2}>
            {spot.address}
          </Text>
        </View>
      </PressableScale>
    </View>
  )

  if (isGoogle) {
    return <GoogleGlassPanel style={styles.googleShell}>{inner}</GoogleGlassPanel>
  }
  return inner
}

const styles = StyleSheet.create({
  googleShell: { marginBottom: GOOGLE_HOME.gapCard },
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  cardGoogle: {
    borderRadius: GOOGLE_HOME.radiusPanel,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  thumbWrapGoogle: { borderTopLeftRadius: GOOGLE_HOME.radiusPanel, borderTopRightRadius: GOOGLE_HOME.radiusPanel },
  thumbWrap: { width: '100%', height: 144, backgroundColor: '#e8e4de', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  ph: { backgroundColor: '#e8e4de' },
  heartFab: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  body: { padding: 12, paddingBottom: 10, gap: 2 },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPill: { backgroundColor: colors.tintStrong, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  catPillGoogle: { backgroundColor: 'rgba(255,255,255,0.14)' },
  catTxt: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
  catTxtGoogle: { color: GOOGLE_HOME.textPrimary, fontWeight: '600' },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dist: { fontSize: 12, color: '#aaa' },
  distGoogle: { color: GOOGLE_HOME.textMuted },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateTxt: { fontSize: 12, color: '#888' },
  rateTxtGoogle: { color: GOOGLE_HOME.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  name: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  nameGoogle: { fontSize: 15, fontWeight: '600', color: GOOGLE_HOME.textPrimary },
  addr: { fontSize: 12, color: '#aaa' },
  addrGoogle: { color: GOOGLE_HOME.textSecondary },
})
