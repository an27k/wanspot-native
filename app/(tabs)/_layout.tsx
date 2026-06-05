import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { GlassTabBar } from '@/components/navigation/GlassTabBar'
import { track } from '@/lib/analytics'

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="search"
      /** 非表示タブを切り離さず、切替時の空白・遅延を減らす */
      detachInactiveScreens={false}
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        /** shift は両画面が一瞬 opacity 0 付近を通り「真っ白」に見えやすいのでオフ */
        animation: 'none',
        /** 起動時に全タブをマウントしない（検索の広告・一覧と Hermes の競合を避ける） */
        lazy: true,
        /** true だと非アクティブタブの更新が止まり、再フォーカス時にネイティブ広告周りが「消えた」ように見えることがある */
        freezeOnBlur: false,
        tabBarActiveTintColor: colors.brandDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          title: '検索',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} color={color} size={focused ? 26 : 24} />
          ),
        }}
        listeners={{ focus: () => track('tab_viewed', { tab_name: 'search' }) }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '現在地',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'location' : 'location-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
        listeners={{ focus: () => track('tab_viewed', { tab_name: 'index' }) }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'カメラ',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'camera' : 'camera-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
        listeners={{ focus: () => track('tab_viewed', { tab_name: 'camera' }) }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: '設定',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
        listeners={{ focus: () => track('tab_viewed', { tab_name: 'mypage' }) }}
      />
    </Tabs>
  )
}
