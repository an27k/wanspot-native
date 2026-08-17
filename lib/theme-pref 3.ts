import AsyncStorage from '@react-native-async-storage/async-storage'

export const THEME_PREFERENCE_KEY = 'theme_preference_v1'

export type ThemePreference = 'system' | 'light' | 'dark'

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const value = await AsyncStorage.getItem(THEME_PREFERENCE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference)
  } catch {
    /* 端末設定はベストエフォート。画面上の選択状態はその場で反映する。 */
  }
}
