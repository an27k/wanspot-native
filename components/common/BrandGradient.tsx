import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { GRADIENTS, GRADIENT_SUNSET_POINTS, type GradientVariant } from '@/constants/gradients'

type Props = {
  variant?: GradientVariant
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

/** ヒーロー用サンセットグラデ（全画面でこのコンポーネント経由のみ使用） */
export function BrandGradient({ variant = 'sunset', style, children }: Props) {
  const colors = GRADIENTS[variant]
  return (
    <LinearGradient
      colors={[...colors]}
      start={GRADIENT_SUNSET_POINTS.start}
      end={GRADIENT_SUNSET_POINTS.end}
      style={style}
    >
      {children}
    </LinearGradient>
  )
}
