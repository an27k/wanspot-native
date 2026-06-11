import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { SOFT_SPRING } from '@/lib/motion/constants'
import { colors } from '@/constants/colors'

export type DiscoverTabDef<K extends string> = {
  key: K
  label: string
  /** 色を受け取ってアイコンを描く（#fff = 選択中レイヤー） */
  renderIcon: (color: string) => ReactNode
}

const TEXT_FADE_MS = 200
const TRACK_PADDING = 3

function TabItem({
  label,
  renderIcon,
  selected,
  onPress,
  onLayout,
}: {
  label: string
  renderIcon: (color: string) => ReactNode
  selected: boolean
  onPress: () => void
  onLayout: (e: LayoutChangeEvent) => void
}) {
  const sel = useSharedValue(selected ? 1 : 0)

  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, { duration: TEXT_FADE_MS })
  }, [selected, sel])

  const txtStyle = useAnimatedStyle(() => ({
    color: interpolateColor(sel.value, [0, 1], ['#888888', '#ffffff']),
  }))
  const iconOffStyle = useAnimatedStyle(() => ({ opacity: 1 - sel.value }))
  const iconOnStyle = useAnimatedStyle(() => ({ opacity: sel.value }))

  return (
    <Pressable onPress={onPress} onLayout={onLayout} style={styles.tab} accessibilityRole="button" accessibilityState={{ selected }}>
      <View style={styles.iconStack}>
        <Animated.View style={iconOffStyle}>{renderIcon('#888')}</Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconOverlay, iconOnStyle]}>
          {renderIcon('#fff')}
        </Animated.View>
      </View>
      <Animated.Text style={[styles.txt, txtStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </Pressable>
  )
}

/**
 * ディスカバリーモード切替タブ。
 * 単一トラック内をコーラルのピルが spring でスライド移動し、
 * ラベル/アイコンは同じタイミングでクロスフェードする。
 */
export function DiscoverModeTabs<K extends string>({
  tabs,
  selectedKey,
  onSelect,
}: {
  tabs: DiscoverTabDef<K>[]
  selectedKey: K
  onSelect: (key: K) => void
}) {
  const layoutsRef = useRef(new Map<string, { x: number; width: number }>())
  const [measured, setMeasured] = useState(false)
  const pillX = useSharedValue(0)
  const pillW = useSharedValue(0)
  const pillOpacity = useSharedValue(0)

  const movePill = useCallback(
    (key: string, animated: boolean) => {
      const l = layoutsRef.current.get(key)
      if (!l) return
      if (animated) {
        pillX.value = withSpring(l.x, SOFT_SPRING)
        pillW.value = withSpring(l.width, SOFT_SPRING)
      } else {
        pillX.value = l.x
        pillW.value = l.width
        pillOpacity.value = withTiming(1, { duration: 120 })
      }
    },
    [pillOpacity, pillW, pillX]
  )

  useEffect(() => {
    if (measured) movePill(selectedKey, true)
  }, [measured, movePill, selectedKey])

  const handleTabLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    layoutsRef.current.set(key, { x, width })
    if (!measured) {
      if (layoutsRef.current.size === tabs.length) {
        movePill(selectedKey, false)
        setMeasured(true)
      }
    } else if (key === selectedKey) {
      // 回転・フォント変更などの再レイアウトには即時追従
      movePill(key, false)
    }
  }

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
    opacity: pillOpacity.value,
  }))

  return (
    <View style={styles.track}>
      {/* タブと同一原点で計測するためのインナー（track の padding の影響を受けない） */}
      <View style={styles.inner}>
        <Animated.View style={[styles.pill, pillStyle]} />
        {tabs.map((t) => (
          <TabItem
            key={t.key}
            label={t.label}
            renderIcon={t.renderIcon}
            selected={t.key === selectedKey}
            onLayout={handleTabLayout(t.key)}
            onPress={() => {
              if (t.key === selectedKey) return
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onSelect(t.key)
            }}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f3f2ef',
    borderRadius: 14,
    padding: TRACK_PADDING,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 11,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  iconStack: {
    position: 'relative',
  },
  iconOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
})
