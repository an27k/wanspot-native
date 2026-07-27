import 'react-native-gesture-handler'
import '@/lib/ios-safe-console'
import { useEffect } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as WebBrowser from 'expo-web-browser'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { enableScreens } from 'react-native-screens'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { initAnalytics } from '@/lib/analytics'
import { useNotificationDeeplink } from '@/lib/notifications/use-notification-deeplink'
import { logUserEvent } from '@/lib/user-events'
import { perfMark } from '@/lib/perf/marks'

perfMark('app:root-layout')

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
  /** Ionicons は裏で読み込み、認証/ルーティングの開始はブロックしない */
  useFonts(Ionicons.font)

  /** 「◯ヶ月前の今日」通知のタップ → アルバムの該当レビューへ */
  useNotificationDeeplink()

  useEffect(() => {
    initAnalytics()
    // セッションの起点を記録（ログイン済みのときのみ記録される）
    logUserEvent({ eventType: 'app_open' })
  }, [])

  useEffect(() => {
    try {
      WebBrowser.maybeCompleteAuthSession()
    } catch {
      /* Hermes / ネイティブ側の想定外 URL で落ちないよう握りつぶす */
    }
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <ScreenErrorBoundary label="root">
          <Stack screenOptions={stackScreenOptions}>
            {/* タブシェル・ゲート画面のみスワイプ pop を無効化。詳細ルートは stackScreenOptions のまま */}
            <Stack.Screen
              name="(tabs)"
              options={{
                gestureEnabled: false,
                fullScreenGestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="index"
              options={{
                gestureEnabled: false,
                fullScreenGestureEnabled: false,
              }}
            />
          </Stack>
          </ScreenErrorBoundary>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
