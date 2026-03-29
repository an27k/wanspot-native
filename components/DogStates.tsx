import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { IconPaw } from '@/components/IconPaw'

function RunningDogEmojiAnimation() {
  const bounce = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -6, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [bounce])

  return (
    <Animated.View style={{ transform: [{ translateY: bounce }] }}>
      <Text style={styles.runEmoji} accessible={false}>
        🐕
      </Text>
    </Animated.View>
  )
}

export const RunningDog = ({ label = '読み込み中...' }: { label?: string }) => (
  <View style={styles.runWrap}>
    <RunningDogEmojiAnimation />
    <Text style={styles.runLabel}>{label}</Text>
  </View>
)

export const PowState = ({
  label = '見つかりませんでした',
  onRetry,
}: {
  label?: string
  onRetry?: () => void
}) => (
  <View style={styles.runWrap}>
    <IconPaw size={40} color="#aaa" />
    <Text style={styles.powLabel}>{label}</Text>
    {onRetry ? (
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.retryTxt}>もう一度検索する</Text>
      </TouchableOpacity>
    ) : null}
  </View>
)

const styles = StyleSheet.create({
  runWrap: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  runEmoji: { fontSize: 48, lineHeight: 52 },
  runLabel: { fontSize: 12, color: '#aaa' },
  powLabel: { fontSize: 14, color: '#aaa' },
  retryBtn: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ebebeb',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
})
