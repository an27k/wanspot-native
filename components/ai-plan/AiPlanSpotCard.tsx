import { useEffect, useRef } from 'react'
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { spotPhotoUrl } from '@/lib/wanspot-api'
import type { AiPlanStop } from '@/components/ai-plan/types'

export function AiPlanSpotCard({
  stop,
  photoRef,
  delayMs,
  onPress,
}: {
  stop: AiPlanStop
  photoRef: string | null
  delayMs: number
  onPress: () => void
}) {
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }).start()
    }, delayMs)
    return () => clearTimeout(t)
  }, [delayMs, opacity])

  const img = spotPhotoUrl(photoRef, 480)

  return (
    <Animated.View style={{ opacity }}>
      <Pressable style={styles.card} onPress={onPress}>
        {img ? <Image source={{ uri: img }} style={styles.img} resizeMode="cover" /> : <View style={styles.imgPh} />}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {stop.name ?? 'スポット'}
          </Text>
          <View style={styles.metaRow}>
            {stop.category ? <Text style={styles.meta}>{stop.category}</Text> : null}
            <Text style={styles.meta}>約{stop.dwell_minutes}分滞在</Text>
          </View>
          {stop.note ? <Text style={styles.note}>{stop.note}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
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
  img: { width: '100%', height: 150, backgroundColor: '#f0f0f0' },
  imgPh: { width: '100%', height: 150, backgroundColor: '#f5f5f5' },
  body: { padding: 14, gap: 8 },
  title: { fontSize: 16, fontWeight: '900', color: '#1a1a1a' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { fontSize: 12, fontWeight: '800', color: '#888' },
  note: { fontSize: 12, color: '#666', lineHeight: 18 },
})
