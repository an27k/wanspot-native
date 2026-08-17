import { type ReactNode } from 'react'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { REVIEW_ALBUM_TAB_ENABLED } from '@/lib/feature-flags'
import type { AppColors } from '@/constants/colors'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'

function isTabBarVisible(routeName: string): boolean {
  // 旧検索ホームはタブから撤去（ルート自体はリダイレクト互換のため残存）
  if (routeName === 'search') return false
  if (routeName === 'camera' && !REVIEW_ALBUM_TAB_ENABLED) return false
  return true
}

/** セーフエリアを除いた共通タブバーの高さ。 */
export const PILL_HEIGHT = 64

/**
 * 全タブ共通の固定タブバー。
 * 文字ラベルは表示せず、選択中のアイコンだけをコーラルの円で示す。
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          if (!isTabBarVisible(route.name)) return null
          const { options } = descriptors[route.key]
          const focused = state.index === index
          const activeColor = options.tabBarActiveTintColor ?? colors.primary
          const inactiveColor = options.tabBarInactiveTintColor ?? colors.textSecondary
          const color = focused ? activeColor : inactiveColor
          const icon = options.tabBarIcon?.({
            focused,
            color,
            size: focused ? 26 : 24,
          })

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params)
            }
          }

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key })
          }

          return (
            <TabBarItem
              key={route.key}
              focused={focused}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
              icon={icon}
            />
          )
        })}
      </View>
    </View>
  )
}

function TabBarItem({
  focused,
  onPress,
  onLongPress,
  accessibilityLabel,
  icon,
}: {
  focused: boolean
  onPress: () => void
  onLongPress: () => void
  accessibilityLabel?: string
  icon: ReactNode
}) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.tab}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.tabPressable, pressed && styles.tabPressed]}
        hitSlop={8}
      >
        <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>{icon}</View>
      </Pressable>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    height: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabPressable: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: { opacity: 0.62 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapFocused: { backgroundColor: colors.tintWeak },
})
