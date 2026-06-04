import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BlurView } from 'expo-blur'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'

/** ピル本体の高さ。container の paddingTop と insets と合わせて TAB_BAR_HEIGHT と整合させる */
const PILL_HEIGHT = 58

/**
 * Instagram / iOS の「リキッドグラス」風フローティングタブバー。
 * - position:absolute で画面コンテンツの手前に浮かせ、マップ/リストがガラスの裏に透ける
 * - 角丸のすりガラス（BlurView）ピルを左右マージン付きで浮かせ、影で立体感を出す
 * - アクティブタブはアイコン背面に淡い黄色の「レンズ」を敷いて差別化
 * - 占有フットプリント（下端からの高さ）= insets.bottom + PILL_HEIGHT + paddingTop ≒ TAB_BAR_HEIGHT + insets.bottom。
 *   各タブ画面はこのぶんだけ下部に余白を確保している。
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <View style={styles.pillShadow}>
        <View style={styles.pill}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 36 : 64}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.glassTint} />
          <View pointerEvents="none" style={styles.glassHighlight} />

          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key]
              const focused = state.index === index
              const activeColor = options.tabBarActiveTintColor ?? colors.brandDark
              const inactiveColor = options.tabBarInactiveTintColor ?? colors.textMuted
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
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.tab}
                  hitSlop={8}
                >
                  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>{icon}</View>
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  pillShadow: {
    height: PILL_HEIGHT,
    borderRadius: 28,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  pill: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  glassHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrap: {
    width: 44,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255,216,77,0.30)',
  },
})
