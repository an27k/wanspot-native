import { useCallback, useRef } from 'react'
import { runOnJS, useAnimatedScrollHandler } from 'react-native-reanimated'

/**
 * スクロール位置を JS 側へ通知するだけの handler。無限スクロールの追加読み込みに使う。
 *
 * 返り値は必ず `Animated.ScrollView` の `onScroll` に**そのまま渡す**こと。
 * 通常の ScrollView の onScroll から手動で呼ぶと worklet が実行されず、
 * 追加読み込みが無言で止まる（過去に発生済み）。
 */
export function useScrollYReport(onScrollY: (y: number) => void) {
  const onScrollYRef = useRef(onScrollY)
  onScrollYRef.current = onScrollY

  const reportToJs = useCallback((y: number) => {
    onScrollYRef.current(y)
  }, [])

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet'
      runOnJS(reportToJs)(event.contentOffset.y)
    },
  })
}
