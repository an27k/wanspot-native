import { useRef, useState } from 'react'
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { UiIconGoogle, UiIconHeart, UiIconStar } from '@/components/ui-icons'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
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
  const likeScale = useRef(new Animated.Value(1)).current
  const photoUrl = spotPhotoUrl(spot.photo_ref, 288)

  const dist =
    userLocation && spot.lat && spot.lng
      ? formatDist(calcDistance(userLocation.lat, userLocation.lng, spot.lat, spot.lng))
      : null

  const handleOpen = async () => {
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
        },
        { onConflict: 'place_id' }
      )
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
    playLikeHeartAnimation(likeScale)
    setLikeLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLikeLoading(false)
      return
    }
    const { data: spotRow } = await supabase
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
        },
        { onConflict: 'place_id' }
      )
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
        <Pressable
          style={styles.heartFab}
          onPress={(ev) => void handleLike(ev)}
          disabled={likeLoading}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <UiIconHeart filled={liked} size={15} />
          </Animated.View>
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
                <UiIconGoogle />
                <UiIconStar />
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
