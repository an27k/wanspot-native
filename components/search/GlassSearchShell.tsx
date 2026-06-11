import { type ReactNode, useEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useTabBarScrollContext } from '@/context/TabBarScrollContext'
import { SOFT_SPRING } from '@/lib/motion/constants'
import { colors } from '@/constants/colors'

type Props = {
  children: ReactNode
  focused: boolean
}

/** 検索バー外枠: ガラス材質 + フォーカス/スクロール連動 spring */
export function GlassSearchShell({ children, focused }: Props) {
  const { tabBarProgress } = useTabBarScrollContext()
  const focusSv = useSharedValue(focused ? 1 : 0)

  useEffect(() => {
    focusSv.value = withSpring(focused ? 1 : 0, SOFT_SPRING)
  }, [focused, focusSv])

  const shellStyle = useAnimatedStyle(() => {
    const scrollP = tabBarProgress.value
    const scale = interpolate(scrollP, [0, 1], [1, 0.97], Extrapolation.CLAMP)
    const shadowOpacity = interpolate(focusSv.value, [0, 1], [0.06, 0.14], Extrapolation.CLAMP)
    return {
      transform: [{ scale }],
      shadowOpacity,
    }
  })

  const innerStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusSv.value, [0, 1], [colors.border, colors.primary]),
    backgroundColor:
      Platform.OS === 'ios'
        ? `rgba(255,255,255,${0.52 + focusSv.value * 0.12})`
        : `rgba(255,255,255,${0.94 + focusSv.value * 0.04})`,
  }))

  return (
    <Animated.View style={[styles.shell, shellStyle]}>
      <Animated.View style={[styles.inner, innerStyle]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={focused ? 48 : 32} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    shadowColor: '#000',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
})
