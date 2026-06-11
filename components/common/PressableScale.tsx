import { type ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { Pressable } from 'react-native-gesture-handler'
import { PRESS_SCALE, SOFT_SPRING } from '@/lib/motion/constants'

type Props = {
  children: ReactNode
  onPress?: () => void
  onLongPress?: () => void
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  /** 連打面（いいね等）では false */
  haptic?: boolean
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'link' | 'none'
}

export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  haptic = true,
  accessibilityLabel,
  accessibilityRole = 'button',
}: Props) {
  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePress = () => {
    if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = withSpring(PRESS_SCALE, SOFT_SPRING)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SOFT_SPRING)
      }}
    >
      <Animated.View
        style={[style, animStyle]}
        layout={LinearTransition.springify()
          .damping(SOFT_SPRING.damping)
          .stiffness(SOFT_SPRING.stiffness)}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}
