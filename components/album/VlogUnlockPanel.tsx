import { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { colors } from '@/constants/colors'

type Props = {
  dogName: string
  visible: boolean
  busy?: boolean
  onPress: () => void
}

/** 5/5 アンロック — バネで咲く生成ボタン */
export function VlogUnlockPanel({ dogName, visible, busy, onPress }: Props) {
  const scale = useSharedValue(0.3)
  const opacity = useSharedValue(0)
  const hapticFired = useRef(false)

  useEffect(() => {
    if (!visible) {
      scale.value = 0.3
      opacity.value = 0
      hapticFired.current = false
      return
    }
    if (!hapticFired.current) {
      hapticFired.current = true
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    opacity.value = withDelay(180, withSpring(1, { damping: 14, stiffness: 140 }))
    scale.value = withDelay(180, withSpring(1, { damping: 12, stiffness: 140 }))
  }, [visible, opacity, scale])

  const btnStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  if (!visible) return null

  const name = dogName.trim() || '愛犬'

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{name}の今月、できてるよ</Text>
      <Animated.View style={btnStyle}>
        <Pressable
          style={[styles.btn, busy && styles.btnBusy]}
          disabled={busy}
          onPress={onPress}
        >
          <Text style={styles.btnMain}>観てみる？</Text>
          <Text style={styles.btnSub}>5スポット・今月のVLOG</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingHorizontal: 8, marginTop: 4 },
  heading: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  btn: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnBusy: { opacity: 0.65 },
  btnMain: { fontSize: 17, fontWeight: '900', color: '#fff' },
  btnSub: { marginTop: 4, fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
})
