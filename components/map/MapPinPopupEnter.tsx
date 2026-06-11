import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'
import { SOFT_SPRING } from '@/lib/motion/constants'

/** ピン選択キーが変わったときだけ再 entering */
export function MapPinPopupKeyed({ spotKey, children }: { spotKey: string; children: React.ReactNode }) {
  return (
    <Animated.View
      key={spotKey}
      entering={FadeInDown.springify().damping(SOFT_SPRING.damping).stiffness(SOFT_SPRING.stiffness).duration(280)}
      exiting={FadeOut.duration(140)}
    >
      {children}
    </Animated.View>
  )
}
