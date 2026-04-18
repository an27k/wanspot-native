import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg'
import { IconPaw } from '@/components/IconPaw'

function RunningDogSvgAnimation() {
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
      <Svg width={64} height={48} viewBox="0 0 64 48" aria-hidden>
        <Ellipse cx="32" cy="28" rx="16" ry="10" fill="#FFD84D" />
        <Circle cx="46" cy="20" r="10" fill="#FFD84D" />
        <Ellipse cx="50" cy="12" rx="4" ry="6" fill="#2b2a28" transform="rotate(15 50 12)" />
        <Ellipse cx="42" cy="11" rx="3" ry="5" fill="#2b2a28" transform="rotate(-10 42 11)" />
        <Circle cx="49" cy="19" r="1.5" fill="#2b2a28" />
        <Ellipse cx="54" cy="22" rx="2" ry="1.5" fill="#2b2a28" />
        <Ellipse cx="14" cy="20" rx="3" ry="8" fill="#2b2a28" transform="rotate(-30 14 20)" />
        <Rect x="38" y="36" width="5" height="10" rx="2" fill="#2b2a28" />
        <Rect x="24" y="36" width="5" height="10" rx="2" fill="#2b2a28" />
        <Rect x="18" y="36" width="5" height="10" rx="2" fill="#FFD84D" />
        <Rect x="32" y="36" width="5" height="10" rx="2" fill="#FFD84D" />
      </Svg>
    </Animated.View>
  )
}

export const RunningDog = ({ label = '読み込み中...' }: { label?: string }) => (
  <View style={styles.runWrap}>
    <RunningDogSvgAnimation />
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
