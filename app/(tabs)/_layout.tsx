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
        /** 非アクティブタブを切り離し、ログイン直後に map/Skia 等が同時マウントされないようにする */
        detachInactiveScreens
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          sceneStyle: { backgroundColor: colors.paper },
          /** 起動時に全タブをマウントしない（検索のみ先に描画） */
          lazy: true,
          freezeOnBlur: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: false,
        }}
      >
          <Tabs.Screen
            name="search"
            options={{
              title: '検索',
              freezeOnBlur: false,
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
          {REVIEW_ALBUM_TAB_ENABLED ? (
            <Tabs.Screen
              name="camera"
              options={{
                title: 'レビュー',
                freezeOnBlur: true,
                sceneStyle: { backgroundColor: 'transparent' },
                tabBarIcon: ({ color, focused }) => (
                  <AlbumTabIcon color={color} size={focused ? 26 : 24} />
                ),
              }}
              listeners={{ focus: () => track('tab_viewed', { tab_name: 'camera' }) }}
            />
          ) : (
            <Tabs.Screen
              name="camera"
              options={{
                href: null,
              }}
            />
          )}
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
