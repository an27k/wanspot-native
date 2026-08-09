import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { GlassTabBar } from '@/components/navigation/GlassTabBar'
import { AlbumTabIcon } from '@/components/icons/AlbumTabIcon'
import { useAppTheme } from '@/context/ThemeContext'
import { track } from '@/lib/analytics'
import { REVIEW_ALBUM_TAB_ENABLED } from '@/lib/feature-flags'

/**
 * 4タブ構成（検索 / まとめ記事 / カレンダー / 設定）。
 * 旧「検索ホーム」は概念ごと廃止し、検索はマップ画面（index）に集約。
 * 旧 search ルートは通知・保存状態からの遷移互換のため非表示で残す（index へリダイレクト）。
 */
export default function TabsLayout() {
  const { colors } = useAppTheme()

  return (
      <Tabs
        initialRouteName="index"
        /** 非アクティブタブを切り離し、ログイン直後に map/Skia 等が同時マウントされないようにする */
        detachInactiveScreens
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          sceneStyle: { backgroundColor: colors.paper },
          /** 起動時に全タブをマウントしない（検索=マップのみ先に描画） */
          lazy: true,
          freezeOnBlur: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: false,
        }}
      >
          <Tabs.Screen
            name="index"
            options={{
              title: '検索',
              freezeOnBlur: false,
              tabBarIcon: ({ color, focused }) => (
                <Ionicons name={focused ? 'search' : 'search-outline'} color={color} size={focused ? 26 : 24} />
              ),
            }}
            listeners={{ focus: () => track('tab_viewed', { tab_name: 'search_map' }) }}
          />
          <Tabs.Screen
            name="articles"
            options={{
              title: 'まとめ記事',
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? 'book' : 'book-outline'}
                  color={color}
                  size={focused ? 26 : 24}
                />
              ),
            }}
            listeners={{ focus: () => track('tab_viewed', { tab_name: 'articles' }) }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              title: 'カレンダー',
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? 'calendar' : 'calendar-outline'}
                  color={color}
                  size={focused ? 26 : 24}
                />
              ),
            }}
            listeners={{ focus: () => track('tab_viewed', { tab_name: 'calendar' }) }}
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
          {/* 旧検索ホーム: タブには出さない（ルートは index リダイレクトとして温存） */}
          <Tabs.Screen name="search" options={{ href: null }} />
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
        </Tabs>
  )
}
