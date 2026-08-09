import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Appearance, StyleSheet, useColorScheme, View } from 'react-native'
import {
  darkColors,
  lightColors,
  type AppColors,
} from '@/constants/colors'
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme-pref'

export type ResolvedColorScheme = 'light' | 'dark'

type AppThemeContextValue = {
  preference: ThemePreference
  resolvedScheme: ResolvedColorScheme
  isDark: boolean
  colors: AppColors
  setPreference: (preference: ThemePreference) => void
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null)

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true

    void getThemePreference().then((savedPreference) => {
      if (!active) return
      setPreferenceState(savedPreference)
      setHydrated(true)
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference)
  }, [preference])

  const resolvedScheme: ResolvedColorScheme =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference)
    void setThemePreference(nextPreference)
  }, [])

  const value = useMemo<AppThemeContextValue>(
    () => ({
      preference,
      resolvedScheme,
      isDark: resolvedScheme === 'dark',
      colors: resolvedScheme === 'dark' ? darkColors : lightColors,
      setPreference,
    }),
    [preference, resolvedScheme, setPreference]
  )

  if (!hydrated) {
    return <View style={styles.hydrationScreen} />
  }

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
}

export function useAppTheme(): AppThemeContextValue {
  const value = useContext(AppThemeContext)
  if (!value) {
    throw new Error('useAppTheme must be used inside AppThemeProvider')
  }
  return value
}

const styles = StyleSheet.create({
  hydrationScreen: {
    flex: 1,
    backgroundColor: '#FF7E5F',
  },
})
