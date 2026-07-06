import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { GlassTabBar } from '@/components/navigation/GlassTabBar'
import { FloatingFeedbackButton } from '@/components/feedback/FloatingFeedbackButton'
import { AlbumTabIcon } from '@/components/icons/AlbumTabIcon'
import { TabBarScrollProvider } from '@/context/TabBarScrollContext'
import { track } from '@/lib/analytics'
import { REVIEW_ALBUM_TAB_ENABLED } from '@/lib/feature-flags'

export default function TabsLayout() {
  return (
    <TabBarScrollProvider>
      <Tabs
      initialRouteName="search"
      /** 非表示タブを切り離さず、切替時の空白・遅延を減らす */
      detachInactiveScreens={false}
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        /**
         * shift は両画面が一瞬 opacity 0 付近を通り「真っ白」に見えやすかった。
         * fade + sceneStyle の紙色背景で、切替中も白飛びせず柔らかくクロスフェードさせる。
         */
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.paper },
        /** 起動時に全タブをマウントしない（検索の広告・一覧と Hermes の競合を避ける） */
        lazy: true,
        /** true だと非アクティブタブの更新が止まり、再フォーカス時にネイティブ広告周りが「消えた」ように見えることがある */
        freezeOnBlur: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          title: '検索',
          /** 検索タブはグラデ背景を全面に見せる */
          sceneStyle: { backgroundColor: 'transparent' },
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
          href: REVIEW_ALBUM_TAB_ENABLED ? undefined : null,
          title: 'レビュー',
          freezeOnBlur: true,
          /** レビュータブも検索と同じグラデ背景を全面に見せる */
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarIcon: ({ color, focused }) => (
            <AlbumTabIcon color={color} size={focused ? 26 : 24} />
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
      <FloatingFeedbackButton />
    </TabBarScrollProvider>
  )
}
