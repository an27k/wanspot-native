import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '現在地',
          tabBarIcon: ({ color, size }) => <Ionicons name="location" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '検索',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'イベント',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: 'マイページ',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
