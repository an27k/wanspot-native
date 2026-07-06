import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BlurView } from 'expo-blur'
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTabBarScrollContext } from '@/context/TabBarScrollContext'
import { DISABLE_TABBAR_SCROLL } from '@/lib/debug/review-crash-flags'
import { REVIEW_ALBUM_TAB_ENABLED } from '@/lib/feature-flags'
import { SOFT_SPRING } from '@/lib/motion/constants'
import { colors } from '@/constants/colors'

function isTabBarVisible(routeName: string): boolean {
  if (routeName === 'camera' && !REVIEW_ALBUM_TAB_ENABLED) return false
  return true
}

/** ピル本体の高さ。container の paddingTop と insets と合わせて TAB_BAR_HEIGHT と整合させる */
export const PILL_HEIGHT = 58
const PILL_RADIUS = 28
const HORIZONTAL_MARGIN = 18
const COLLAPSED_WIDTH = 72
const INDICATOR_W = 44
const INDICATOR_H = 36

/**
 * Instagram / iOS の「リキッドグラス」風フローティングタブバー。
 * 下スクロールで選択タブ中心のコンパクトピルへ縮小（reanimated UIスレッド）。
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const { tabBarProgress, resetTabBar } = useTabBarScrollContext()
  const pillFullWidth = windowWidth - HORIZONTAL_MARGIN * 2

  const pillFullWidthSv = useSharedValue(pillFullWidth)

  /** 選択インジケーター（コーラルティントのピル）をタブ間で spring スライドさせる */
  const itemLayoutsRef = useRef(new Map<string, { x: number; width: number }>())
  const indicatorX = useSharedValue(0)
  const indicatorOpacity = useSharedValue(0)
  const focusedKey = state.routes[state.index]?.key

  const moveIndicator = useCallback(
    (key: string | undefined, animated: boolean) => {
      if (!key) return
      const l = itemLayoutsRef.current.get(key)
      if (!l) return
      const target = l.x + l.width / 2 - INDICATOR_W / 2
      if (animated) {
        indicatorX.value = withSpring(target, SOFT_SPRING)
      } else {
        indicatorX.value = target
        indicatorOpacity.value = withTiming(1, { duration: 120 })
      }
    },
    [indicatorOpacity, indicatorX]
  )

  const onItemLayout = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout
      itemLayoutsRef.current.set(key, { x, width })
      // 初回計測とスクロール連動の再レイアウトは即時追従（タブ切替時のみ spring）
      if (key === focusedKey) moveIndicator(key, false)
    },
    [focusedKey, moveIndicator]
  )

  useEffect(() => {
    moveIndicator(focusedKey, true)
  }, [focusedKey, moveIndicator])

  const animatedIndicator = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    opacity: indicatorOpacity.value,
  }))

  useEffect(() => {
    pillFullWidthSv.value = pillFullWidth
  }, [pillFullWidth, pillFullWidthSv])

  useEffect(() => {
    resetTabBar()
  }, [resetTabBar, state.index])

  const animatedPillWrap = useAnimatedStyle(() => {
    const p = DISABLE_TABBAR_SCROLL ? 0 : tabBarProgress.value
    const full = pillFullWidthSv.value
    return {
      width: interpolate(p, [0, 1], [full, COLLAPSED_WIDTH], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(p, [0, 1], [1, 0.94], Extrapolation.CLAMP) }],
      alignSelf: 'center',
    }
  })

  const animatedRow = useAnimatedStyle(() => ({
    justifyContent: (DISABLE_TABBAR_SCROLL ? 0 : tabBarProgress.value) > 0.5 ? 'center' : 'space-around',
  }))

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <Animated.View style={[styles.pillShadow, animatedPillWrap]}>
        <View style={styles.pill}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
          ) : null}
          <View
            pointerEvents="none"
            style={[styles.glassTint, Platform.OS === 'android' && styles.glassTintAndroid]}
          />
          <View pointerEvents="none" style={styles.glassHighlight} />

          {/* インジケーターとタブの座標原点を揃えるため padding は外側に分離 */}
          <View style={styles.rowPad}>
          <Animated.View style={[styles.row, animatedRow]}>
            <Animated.View pointerEvents="none" style={[styles.indicator, animatedIndicator]} />
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
                  progress={tabBarProgress}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  onLayout={onItemLayout(route.key)}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
                  icon={icon}
                />
              )
            })}
          </Animated.View>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

function TabBarItem({
  focused,
  progress,
  onPress,
  onLongPress,
  onLayout,
  accessibilityLabel,
  icon,
}: {
  focused: boolean
  progress: SharedValue<number>
  onPress: () => void
  onLongPress: () => void
  onLayout: (e: LayoutChangeEvent) => void
  accessibilityLabel?: string
  icon: ReactNode
}) {
  const animatedTab = useAnimatedStyle(() => {
    const p = progress.value
    if (focused) {
      return {
        opacity: 1,
        maxWidth: interpolate(p, [0, 1], [120, COLLAPSED_WIDTH], Extrapolation.CLAMP),
        flexGrow: interpolate(p, [0, 1], [1, 0], Extrapolation.CLAMP),
        flexShrink: 0,
      }
    }
    return {
      opacity: interpolate(p, [0, 0.45, 1], [1, 0, 0], Extrapolation.CLAMP),
      maxWidth: interpolate(p, [0, 1], [120, 0], Extrapolation.CLAMP),
      flexGrow: interpolate(p, [0, 1], [1, 0], Extrapolation.CLAMP),
      flexShrink: 1,
      overflow: 'hidden' as const,
    }
  })

  return (
    <Animated.View style={[styles.tab, animatedTab]} onLayout={onLayout}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabPressable}
        hitSlop={8}
      >
        <View style={styles.iconWrap}>{icon}</View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: HORIZONTAL_MARGIN,
    paddingTop: 6,
  },
  pillShadow: {
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  pill: {
    flex: 1,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  glassTintAndroid: {
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  glassHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  rowPad: {
    flex: 1,
    paddingHorizontal: 8,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -INDICATOR_H / 2,
    width: INDICATOR_W,
    height: INDICATOR_H,
    borderRadius: 18,
    backgroundColor: colors.tintWeak,
  },
  tab: {
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
  iconWrap: {
    width: 44,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
