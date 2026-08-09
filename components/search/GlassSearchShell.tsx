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
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { SOFT_SPRING } from '@/lib/motion/constants'
import type { AppColors } from '@/constants/colors'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Props = {
  children: ReactNode
  focused: boolean
  /** google = Chrome 新規タブ風ダークガラス */
  variant?: 'light' | 'google'
}

/** 検索バー外枠: ガラス材質 + フォーカス/スクロール連動 spring */
export function GlassSearchShell({ children, focused, variant = 'light' }: Props) {
  const focusSv = useSharedValue(focused ? 1 : 0)
  const isGoogle = variant === 'google'
  const { colors, isDark } = useAppTheme()
  const styles = useThemedStyles(createStyles)

  useEffect(() => {
    focusSv.value = withSpring(focused ? 1 : 0, SOFT_SPRING)
  }, [focused, focusSv])

  const shellStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(
      focusSv.value,
      [0, 1],
      [isGoogle ? 0.12 : 0.06, isGoogle ? 0.22 : 0.14],
      Extrapolation.CLAMP
    ),
  }))

  const innerStyle = useAnimatedStyle(() => {
    if (isGoogle) {
      return {
        borderColor: interpolateColor(
          focusSv.value,
          [0, 1],
          [GOOGLE_HOME.searchBorder, GOOGLE_HOME.pillActiveBorder]
        ),
        backgroundColor: `rgba(8,7,6,${0.76 + focusSv.value * 0.06})`,
      }
    }
    return {
      borderColor: interpolateColor(focusSv.value, [0, 1], [colors.border, colors.primary]),
      backgroundColor: colors.input,
    }
  }, [colors.border, colors.input, colors.primary, isGoogle])

  return (
    <Animated.View style={[styles.shell, isGoogle && styles.shellGoogle, shellStyle]}>
      <Animated.View style={[styles.inner, isGoogle && styles.innerGoogle, innerStyle]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={focused ? (isGoogle ? 36 : 48) : isGoogle ? 28 : 32}
            tint={isGoogle || isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Animated.View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  shell: {
    flex: 1,
    shadowColor: colors.shadow,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  shellGoogle: {
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  innerGoogle: {
    borderRadius: GOOGLE_HOME.radiusSearch,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
