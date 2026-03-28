import { Stack } from 'expo-router'

/** オンボーディングは初回のみ。スワイプで戻らない・メインスタックと混ざらないようジェスチャーを無効化 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        animation: 'slide_from_right',
      }}
    />
  )
}
