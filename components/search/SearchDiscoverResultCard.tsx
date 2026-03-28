import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Polygon } from 'react-native-svg'
import { HEART_ICON } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl } from '@/lib/wanspot-api'
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

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

const IconHeart = ({ filled }: { filled: boolean }) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill={filled ? HEART_ICON.filled : 'none'} stroke={filled ? HEART_ICON.filled : HEART_ICON.strokeEmpty} strokeWidth={2}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
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
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="#FFD84D" stroke="#FFD84D" strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

type Props = {
  spot: PlaceResult
  userLocation: { lat: number; lng: number } | null
  onOpen: (spotId: string) => void
  onLikesChange?: () => void
  onBeforeNavigate?: () => void
}

export function SearchDiscoverResultCard({ spot, userLocation, onOpen, onLikesChange, onBeforeNavigate }: Props) {
  const [liked, setLiked] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const photoUrl = spotPhotoUrl(spot.photo_ref, 400)

  const dist =
    userLocation && spot.lat && spot.lng
      ? formatDist(calcDistance(userLocation.lat, userLocation.lng, spot.lat, spot.lng))
      : null

  const handleOpen = async () => {
    const { data: spotRow, error } = await supabase
      .from('spots')
      .upsert({ place_id: spot.place_id, name: spot.name, category: spot.category }, { onConflict: 'place_id' })
      .select('id')
      .single()
    if (!error && spotRow) {
      onBeforeNavigate?.()
      onOpen(spotRow.id as string)
    }
  }

  const handleLike = async (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.()
    if (likeLoading) return
    setLikeLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLikeLoading(false)
      return
    }
    const { data: spotRow } = await supabase
      .from('spots')
      .upsert({ place_id: spot.place_id, name: spot.name, category: spot.category }, { onConflict: 'place_id' })
      .select('id')
      .single()
    if (!spotRow) {
      setLikeLoading(false)
      return
    }
    const sid = spotRow.id as string
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

  return (
    <Pressable style={styles.card} onPress={() => void handleOpen()}>
      <View style={styles.thumbWrap}>
        {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.thumb} resizeMode="cover" /> : <View style={[styles.thumb, styles.ph]} />}
        <Pressable style={styles.heartFab} onPress={() => void handleLike()} disabled={likeLoading}>
          <IconHeart filled={liked} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.row1}>
          <View style={styles.catPill}>
            <Text style={styles.catTxt}>{spot.category}</Text>
          </View>
          <View style={styles.metaRight}>
            {dist ? <Text style={styles.dist}>{dist}</Text> : null}
            {spot.rating != null && spot.rating > 0 ? (
              <View style={styles.rateRow}>
                <IconGoogle />
                <IconStar />
                <Text style={styles.rateTxt}>{spot.rating}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text style={styles.name}>{spot.name}</Text>
        <Text style={styles.addr} numberOfLines={2}>
          {spot.address}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb' },
  thumbWrap: { width: '100%', height: 144, backgroundColor: '#e8e4de', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  ph: { backgroundColor: '#e8e4de' },
  heartFab: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  body: { padding: 12, gap: 4 },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPill: { backgroundColor: '#FFF9E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  catTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dist: { fontSize: 12, color: '#aaa' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateTxt: { fontSize: 12, color: '#888' },
  name: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  addr: { fontSize: 12, color: '#aaa' },
})
