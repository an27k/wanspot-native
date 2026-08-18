import { type ReactNode, useEffect, useState } from 'react'
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect'
import { useAppTheme } from '@/context/ThemeContext'

export function isNativeLiquidGlassSupported(): boolean {
  if (Platform.OS !== 'ios') return false
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
  } catch {
    return false
  }
}

function useReduceTransparency() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'ios' || typeof AccessibilityInfo.isReduceTransparencyEnabled !== 'function') {
      return
    }

    let mounted = true
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (mounted) setEnabled(value)
    })
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setEnabled)
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  return enabled
}

type LiquidGlassProps = {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  glassEffectStyle?: 'clear' | 'regular'
  tintColor?: string
  isInteractive?: boolean
} & Pick<ViewProps, 'pointerEvents'>

/**
 * iOS 26 ではネイティブの Liquid Glass。未対応環境では Blur + 半透明で近似する。
 * 背後のコンテンツが透ける前提なので、親で solid の背景を敷かないこと。
 */
export function LiquidGlass({
  children,
  style,
  glassEffectStyle = 'regular',
  tintColor,
  isInteractive = false,
  pointerEvents,
}: LiquidGlassProps) {
  const { isDark, resolvedScheme } = useAppTheme()
  const reduceTransparency = useReduceTransparency()
  const native = isNativeLiquidGlassSupported() && !reduceTransparency

  if (native) {
    return (
      <GlassView
        style={style}
        glassEffectStyle={glassEffectStyle}
        tintColor={tintColor}
        isInteractive={isInteractive}
        colorScheme={resolvedScheme}
        pointerEvents={pointerEvents}
      >
        {children}
      </GlassView>
    )
  }

  const fill = isDark ? 'rgba(28,26,24,0.72)' : 'rgba(255,252,250,0.62)'
  const edge = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)'
  const androidFill = isDark ? 'rgba(28,26,24,0.88)' : 'rgba(255,252,250,0.9)'

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.fallback,
        { borderColor: edge, backgroundColor: Platform.OS === 'android' ? androidFill : 'transparent' },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <>
          <BlurView
            intensity={isDark ? 40 : 52}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        </>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
})
