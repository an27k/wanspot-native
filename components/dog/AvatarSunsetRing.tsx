import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { GRADIENT_SUNSET, GRADIENT_SUNSET_POINTS } from '@/constants/gradients'

const RING = 3
const GAP = 3

type Props = {
  size: number
  children: ReactNode
}

/** サンセットの細いリング（グラデ使用箇所の1つ） */
export function AvatarSunsetRing({ size, children }: Props) {
  const outer = size + (RING + GAP) * 2
  return (
    <LinearGradient
      colors={[...GRADIENT_SUNSET]}
      start={GRADIENT_SUNSET_POINTS.start}
      end={GRADIENT_SUNSET_POINTS.end}
      style={[styles.ring, { width: outer, height: outer, borderRadius: outer / 2, padding: RING }]}
    >
      <View style={[styles.gap, { borderRadius: (outer - RING * 2) / 2, padding: GAP }]}>
        <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>{children}</View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  gap: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
})
