import { type ReactNode } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { LIST_ENTER_DURATION, LIST_ENTER_STAGGER_MS, SOFT_SPRING } from '@/lib/motion/constants'

type Props = {
  index: number
  /** false にすると entering を付けない（再描画・プルリフレッシュ後） */
  animate: boolean
  children: ReactNode
}

/** リスト初回マウント時のみ FadeInDown + stagger（再描画では発火しない） */
export function ListEnterItem({ index, animate, children }: Props) {
  if (!animate) return <>{children}</>

  return (
    <Animated.View
      entering={FadeInDown.delay(index * LIST_ENTER_STAGGER_MS)
        .duration(LIST_ENTER_DURATION)
        .springify()
        .damping(SOFT_SPRING.damping)
        .stiffness(SOFT_SPRING.stiffness)}
    >
      {children}
    </Animated.View>
  )
}
