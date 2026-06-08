import { AppState, Dimensions, StyleSheet, Text, View } from 'react-native'
import { useEffect, useId, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { VlogLiquidGauge } from '@/components/album/VlogLiquidGauge'
import { VlogClipboardIcon } from '@/components/icons/VlogClipboardIcon'

type Props = {
  dogName?: string | null
  progress: number
  remaining: number
  current: number
  target: number
}

export function VlogProgressCard({ dogName, progress, remaining, current, target }: Props) {
  const isFocused = useIsFocused()
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const gradId = useId().replace(/:/g, '')

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active')
    })
    return () => sub.remove()
  }, [])

  const title = dogName?.trim() ? `${dogName.trim()}のVLOG` : 'VLOG'
  const animating = isFocused && appActive
  const gaugeWidth = Dimensions.get('window').width - 32 - 32

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.iconWrap}>
          <Svg width={40} height={40} style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFC247" />
                <Stop offset="0.5" stopColor="#F4A02A" />
                <Stop offset="1" stopColor="#FF6F43" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={40} height={40} rx={12} fill={`url(#${gradId})`} />
          </Svg>
          <VlogClipboardIcon size={22} color="#fff" />
        </View>
        <View style={styles.headText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            {remaining > 0 ? `あと${remaining}本でVLOGが完成` : 'VLOGが完成しました'}
          </Text>
        </View>
        <Text style={styles.fraction}>
          {current}/{target}
        </Text>
      </View>
      <VlogLiquidGauge progress={progress} animating={animating} width={gaugeWidth} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#2b2a28',
    gap: 12,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.72)' },
  fraction: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
})
