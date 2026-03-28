import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/context/AuthContext'

/** ルート Stack: ネイティブの UINavigationController / Android Fragment トランジションに寄せる */
const stackScreenOptions = {
  headerShown: false,
  animation: 'default' as const,
  gestureEnabled: true,
  gestureDirection: 'horizontal' as const,
  /** iOS: エッジだけでなく画面全体からのインタラクティブな戻り（写真アプリに近い挙動） */
  fullScreenGestureEnabled: Platform.OS === 'ios',
  /** ジェスチャー中のカード移動とアニメを揃えてヌルっと感を出す */
  animationMatchesGesture: true,
  /** 標準の push/pop に近い尺（短すぎると安っぽく、長すぎると重く感じる） */
  animationDuration: Platform.OS === 'ios' ? 380 : 280,
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={stackScreenOptions} />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
