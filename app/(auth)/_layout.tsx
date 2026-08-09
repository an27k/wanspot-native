import { Stack } from 'expo-router'
import { Platform } from 'react-native'
import { useAppTheme } from '@/context/ThemeContext'

export default function AuthLayout() {
  const { colors } = useAppTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        fullScreenGestureEnabled: Platform.OS === 'ios',
        animationMatchesGesture: true,
        animationDuration: Platform.OS === 'ios' ? 380 : 280,
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  )
}
