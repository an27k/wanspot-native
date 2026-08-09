import { Stack } from 'expo-router'
import { useAppTheme } from '@/context/ThemeContext'

/** オンボーディングは初回のみ。スワイプで戻らない・メインスタックと混ざらないようジェスチャーを無効化 */
export default function OnboardingLayout() {
  const { colors } = useAppTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  )
}
