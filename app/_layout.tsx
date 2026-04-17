import { useEffect } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as WebBrowser from 'expo-web-browser'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { Platform, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { enableScreens } from 'react-native-screens'
import { AuthProvider } from '@/context/AuthContext'
import { initAnalytics } from '@/lib/analytics'
import { iosUsesSafeConsoleGuards } from '@/lib/ads-policy'

/** ルート Stack: ネイティブの UINavigationController / Android Fragment トランジションに寄せる */
const stackScreenOptions = {
  headerShown: false,
  // 画面遷移は iOS 標準に近い右スライドで「ぬるっと」動かす
  animation: 'slide_from_right' as const,
  gestureEnabled: true,
  gestureDirection: 'horizontal' as const,
  /** iOS: エッジだけでなく画面全体からのインタラクティブな戻り（写真アプリに近い挙動） */
  fullScreenGestureEnabled: Platform.OS === 'ios',
  /** ジェスチャー中のカード移動とアニメを揃えてヌルっと感を出す */
  animationMatchesGesture: true,
  /** 標準の push/pop に近い尺（短すぎると安っぽく、長すぎると重く感じる） */
  animationDuration: Platform.OS === 'ios' ? 380 : 280,
  /** iOS 18 + react-native-screens の snapshot 周りのクラッシュを避けるため、ルートでは画面分離しない */
  detachInactiveScreens: false as const,
}

// iOS 18 周りの UISnapshot / RNSScreen クラッシュ回避のため、screens 最適化自体を無効化
enableScreens(false)

export default function RootLayout() {
  /** ヘッダー・タブの Ionicons が componentDidMount まで空表示になるのを防ぐ */
  const [ioniconsLoaded, ioniconsError] = useFonts(Ionicons.font)

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    // iOS 26.x + Hermes: avoid passing Error objects to console (stack getter crashes). Runs even when ads are enabled.
    if (!iosUsesSafeConsoleGuards()) return

    const safeToString = (v: unknown) => {
      if (v instanceof Error) return v.message
      if (typeof v === 'string') return v
      try {
        return JSON.stringify(v)
      } catch {
        return String(v)
      }
    }

    const origWarn = console.warn
    const origError = console.error

    console.warn = (...args: unknown[]) => origWarn(args.map(safeToString).join(' '))
    console.error = (...args: unknown[]) => origError(args.map(safeToString).join(' '))

    // グローバルエラーハンドラも stack を触らないようにする（fallback）
    const anyGlobal = globalThis as unknown as {
      ErrorUtils?: { getGlobalHandler?: () => unknown; setGlobalHandler?: (h: unknown) => void }
    }
    const errorUtils = anyGlobal.ErrorUtils
    const prevHandler = errorUtils?.getGlobalHandler?.()
    if (errorUtils?.setGlobalHandler) {
      errorUtils.setGlobalHandler((err: unknown, isFatal?: boolean) => {
        const msg = safeToString(err)
        origError(`[globalError] fatal=${String(isFatal ?? false)} ${msg}`)
      })
    }

    return () => {
      console.warn = origWarn
      console.error = origError
      if (errorUtils?.setGlobalHandler && prevHandler) errorUtils.setGlobalHandler(prevHandler)
    }
  }, [])

  useEffect(() => {
    try {
      WebBrowser.maybeCompleteAuthSession()
    } catch {
      /* Hermes / ネイティブ側の想定外 URL で落ちないよう握りつぶす */
    }
  }, [])

  if (!ioniconsLoaded && !ioniconsError) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={stackScreenOptions} />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
