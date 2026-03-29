import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { UiIconGoogle, UiIconHeart, UiIconMoneyDot, UiIconStar } from '@/components/ui-icons'
import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import type { PlaceCardEnrichment } from '@/lib/user-spot-list-utils'
import { calcDistanceMeters } from '@/lib/user-spot-list-utils'
import { spotPhotoUrl } from '@/lib/wanspot-api'

const PriceLevel = ({ level }: { level: number | null }) => {
  if (level === null || level === undefined) {
    return <Text style={styles.q}>?</Text>
  }
  return (
    <View style={styles.priceRow}>
      {[1, 2, 3, 4].map((i) => (
        <UiIconMoneyDot key={i} filled={i <= level} size={10} />
      ))}
    </View>
  )
}

export type SpotListCardProps = {
  row: UserSpotRow
  enrichment: PlaceCardEnrichment | undefined
  userLocation: { lat: number; lng: number } | null
  heartMode: 'toggle' | 'likedOnly'
  onOpen: () => void
  onUnlike?: () => void
  unlikeLoading?: boolean
}

export function SpotListCard({
  row,
  enrichment,
  userLocation,
  heartMode,
  onOpen,
  onUnlike,
  unlikeLoading,
}: SpotListCardProps) {
  const photoRef = enrichment?.photo_ref ?? null
  const uri = spotPhotoUrl(photoRef, 288)
  const displayRating = enrichment?.rating ?? null
  const priceLevel = enrichment?.price_level ?? null

  const [liked, setLiked] = useState(heartMode === 'likedOnly')
  const [localLikeCount, setLocalLikeCount] = useState(row.likeCount)
  const [likeLoading, setLikeLoading] = useState(false)

  useEffect(() => {
    setLocalLikeCount(row.likeCount)
  }, [row.likeCount])

  useEffect(() => {
    if (heartMode === 'likedOnly') {
      setLiked(true)
      return
    }
    let cancelled = false
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: myLike } = await supabase
        .from('spot_likes')
        .select('id')
        .eq('spot_id', row.id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!cancelled) setLiked(!!myLike)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [heartMode, row.id])

  const handleLikeToggle = async () => {
    if (likeLoading || unlikeLoading) return

    if (heartMode === 'likedOnly') {
      onUnlike?.()
      return
    }

    setLikeLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLikeLoading(false)
      return
    }

    if (!liked) {
      await supabase.from('spot_likes').insert({ user_id: user.id, spot_id: row.id })
      setLiked(true)
      setLocalLikeCount((c) => c + 1)
    } else {
      await supabase.from('spot_likes').delete().eq('user_id', user.id).eq('spot_id', row.id)
      setLiked(false)
      setLocalLikeCount((c) => Math.max(0, c - 1))
    }
    setLikeLoading(false)
  }

  const distLabel =
    userLocation && row.lat != null && row.lng != null
      ? (() => {
          const d = calcDistanceMeters(userLocation.lat, userLocation.lng, row.lat, row.lng)
          return d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`
        })()
      : null

  const showRatingRow = displayRating != null && displayRating > 0

  return (
    <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.92}>
      <View style={styles.photoWrap}>
        {uri ? <Image source={{ uri }} style={styles.photo} resizeMode="cover" /> : null}
        <View style={styles.heartCol}>
          <TouchableOpacity
            onPress={() => void handleLikeToggle()}
            disabled={likeLoading || unlikeLoading}
            style={styles.heartBtn}
          >
            <UiIconHeart filled={heartMode === 'likedOnly' ? true : liked} size={16} />
          </TouchableOpacity>
          {localLikeCount > 0 ? (
            <Text style={styles.likeBadge}>{localLikeCount}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.rowTop}>
          <Text style={styles.cat}>{row.category}</Text>
          <View style={styles.metaRight}>
            {showRatingRow ? (
              <View style={styles.rateRow}>
                <UiIconGoogle />
                <UiIconStar />
                <Text style={styles.rateTxt}>{displayRating}</Text>
                <PriceLevel level={priceLevel} />
              </View>
            ) : null}
            {distLabel ? <Text style={styles.dist}>{distLabel}</Text> : null}
          </View>
        </View>
        <Text style={styles.name}>{row.name}</Text>
        <Text style={styles.addr}>{row.address ?? '—'}</Text>
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
  photoWrap: { height: 144, backgroundColor: '#e8e4de', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  heartCol: { position: 'absolute', top: 8, right: 8, alignItems: 'center', gap: 4 },
  heartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#C9A227',
    minWidth: 20,
    textAlign: 'center',
  },
  body: { paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cat: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontWeight: '700',
    backgroundColor: '#FFF9E0',
    color: '#1a1a1a',
  },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateTxt: { fontSize: 12, color: '#888' },
  dist: { fontSize: 12, color: '#aaa' },
  name: { fontWeight: '700', fontSize: 14, color: '#1a1a1a' },
  addr: { fontSize: 12, color: '#aaa' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  q: { fontSize: 12, color: '#ccc' },
})
