import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { GRADIENT_SUNSET, GRADIENT_SUNSET_POINTS } from '@/constants/gradients'

const RING = 3
const GAP = 3

/** グレー系（クリアな質感）のリング配色 */
const GRADIENT_GRAY = ['#D6D9DE', '#A9AEB6', '#7C828B'] as const
const GRADIENT_AURORA = ['#55E0B4', '#B66CFF', '#F27AD7'] as const

type Props = {
  size: number
  children: ReactNode
  /** 5/5 アンロック時 — リングをやや明るく */
  energized?: boolean
  /** リング配色 */
  tone?: 'sunset' | 'gray' | 'aurora'
}

/** アバターの細いリング（サンセット or グレー） */
export function AvatarSunsetRing({ size, children, energized, tone = 'sunset' }: Props) {
  const outer = size + (RING + GAP) * 2
  const ringColors = tone === 'gray' ? GRADIENT_GRAY : tone === 'aurora' ? GRADIENT_AURORA : GRADIENT_SUNSET
  return (
    <LinearGradient
      colors={[...ringColors]}
      start={GRADIENT_SUNSET_POINTS.start}
      end={GRADIENT_SUNSET_POINTS.end}
      style={[
        styles.ring,
        {
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          padding: RING,
          opacity: energized ? 1 : 0.92,
        },
      ]}
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
