import { useRef } from 'react'
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import type { PlaceResult } from '@/types/places'

type Props = {
  spot: PlaceResult
  likeCount: number
  liked: boolean
  distanceLabel?: string | null
  photoUri: string | null
  onPress: () => void
  onToggleLike: () => void
}

export function NearbySpotCard({
  spot,
  likeCount,
  liked,
  distanceLabel,
  photoUri,
  onPress,
  onToggleLike,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current

  const animateHeart = () => {
    scale.setValue(0.7)
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, friction: 5, tension: 200 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 200 }),
    ]).start()
    onToggleLike()
  }

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.photoWrap}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPh]} />
        )}
        <Pressable style={styles.heartBtn} onPress={(e) => { e?.stopPropagation?.(); animateHeart() }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? colors.brandDark : colors.textMuted}
            />
          </Animated.View>
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{spot.name}</Text>
        <Text style={styles.meta}>
          {spot.category}
          {spot.rating != null && spot.rating > 0 ? ` · ★${spot.rating.toFixed(1)}` : ''}
          {distanceLabel ? ` · ${distanceLabel}` : ''}
        </Text>
        <Text style={styles.addr} numberOfLines={2}>{spot.address}</Text>
        <Text style={styles.likes}>♥ {likeCount}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 140 },
  photoPh: { backgroundColor: colors.cardBg },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 8,
  },
  body: { padding: 12 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  addr: { fontSize: 13, color: colors.textLight, marginTop: 6 },
  likes: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
})
