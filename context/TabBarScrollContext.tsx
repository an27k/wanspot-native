import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { withSpring, type SharedValue, useSharedValue } from 'react-native-reanimated'

export const TAB_BAR_SPRING = { damping: 18, stiffness: 160, mass: 0.9 } as const

type TabBarScrollContextValue = {
  tabBarProgress: SharedValue<number>
  lastScrollY: SharedValue<number>
  resetTabBar: () => void
}

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(null)

export function TabBarScrollProvider({ children }: { children: ReactNode }) {
  const tabBarProgress = useSharedValue(0)
  const lastScrollY = useSharedValue(0)

  const resetTabBar = useCallback(() => {
    tabBarProgress.value = withSpring(0, TAB_BAR_SPRING)
    lastScrollY.value = 0
  }, [lastScrollY, tabBarProgress])

  const value = useMemo(
    () => ({ tabBarProgress, lastScrollY, resetTabBar }),
    [lastScrollY, resetTabBar, tabBarProgress]
  )

  return <TabBarScrollContext.Provider value={value}>{children}</TabBarScrollContext.Provider>
}

export function useTabBarScrollContext() {
  const ctx = useContext(TabBarScrollContext)
  if (!ctx) {
    throw new Error('useTabBarScrollContext must be used within TabBarScrollProvider')
  }
  return ctx
}
