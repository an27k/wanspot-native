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
    /*
      ネイティブのガラスが一瞬落ちて、バーが完全に透明になることがある。
      操作中（isInteractive で再合成が走る）と、freezeOnBlur / detachInactiveScreens で
      凍結された画面が戻るときに起きる。画面遷移で直るのは、そこで作り直されるため。

      効果が落ちても中身が読めるよう、薄い面を下に敷いておく。ガラスが効いている
      ときはほぼ見えず、落ちたときだけ受け皿になる濃さにしてある。
      フォールバック側（BlurView）は 0.72 の面を持っているのでこの問題が出ない。
    */
    const safety = isDark ? 'rgba(28,26,24,0.16)' : 'rgba(255,252,250,0.16)'
    return (
      <GlassView
        style={[style, { backgroundColor: safety }]}
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
