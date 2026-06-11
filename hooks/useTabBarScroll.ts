import { useCallback, useEffect, useRef } from 'react'
import { runOnJS, useAnimatedScrollHandler, useSharedValue, withSpring } from 'react-native-reanimated'
import { TAB_BAR_SPRING, useTabBarScrollContext } from '@/context/TabBarScrollContext'

/** 各タブの主縦スクロールに付ける handler（worklet 内は shared value + runOnJS のみ） */
export function useTabBarScroll(onScrollY?: (y: number) => void) {
  const { tabBarProgress, lastScrollY } = useTabBarScrollContext()
  const reportEnabled = useSharedValue(onScrollY ? 1 : 0)
  const onScrollYRef = useRef(onScrollY)
  onScrollYRef.current = onScrollY

  useEffect(() => {
    reportEnabled.value = onScrollY ? 1 : 0
  }, [onScrollY, reportEnabled])

  const reportToJs = useCallback((y: number) => {
    onScrollYRef.current?.(y)
  }, [])

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet'
      const y = event.contentOffset.y
      const dy = y - lastScrollY.value

      if (y < 12 || dy < -4) {
        tabBarProgress.value = withSpring(0, TAB_BAR_SPRING)
      } else if (dy > 4 && y > 24) {
        tabBarProgress.value = withSpring(1, TAB_BAR_SPRING)
      }

      lastScrollY.value = y

      if (reportEnabled.value) {
        runOnJS(reportToJs)(y)
      }
    },
  })
}
