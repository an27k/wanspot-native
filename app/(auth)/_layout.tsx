import { Stack } from 'expo-router'
import { Platform } from 'react-native'

export default function AuthLayout() {
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
      }}
    />
  )
}
