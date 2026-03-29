import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { track } from '@/lib/analytics'

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      /** 非表示タブを切り離さず、切替時の空白・遅延を減らす */
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        /** shift は両画面が一瞬 opacity 0 付近を通り「真っ白」に見えやすいのでオフ */
        animation: 'none',
        /** 初回タブでも中身を即表示（マウント済みにする） */
        lazy: false,
        freezeOnBlur: false,
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
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} color={color} size={size} />
          ),
        }}
        listeners={{ focus: () => track('tab_viewed', { tab_name: 'index' }) }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '検索',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} color={color} size={size} />
          ),
        }}
        listeners={{ focus: () => track('tab_viewed', { tab_name: 'search' }) }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'イベント',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color} size={size} />
          ),
        }}
        listeners={{ focus: () => track('tab_viewed', { tab_name: 'events' }) }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: 'マイページ',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} color={color} size={size} />
          ),
        }}
        listeners={{ focus: () => track('tab_viewed', { tab_name: 'mypage' }) }}
      />
    </Tabs>
  )
}
