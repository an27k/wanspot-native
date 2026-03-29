import Ionicons from '@expo/vector-icons/Ionicons'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { Platform, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
// debug minimal: 認証まわりを切る（AuthProvider 内で onAuthStateChange 等）
// import { AuthProvider } from '@/context/AuthContext'
// import { initAnalytics } from '@/lib/analytics'

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
  /** ヘッダー・タブの Ionicons が componentDidMount まで空表示になるのを防ぐ */
  const [ioniconsLoaded, ioniconsError] = useFonts(Ionicons.font)

  // useEffect(() => {
  //   initAnalytics()
  // }, [])

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
      {/* <AuthProvider> */}
      <StatusBar style="dark" />
      <Stack screenOptions={stackScreenOptions} />
      {/* </AuthProvider> */}
    </SafeAreaProvider>
  )
}
