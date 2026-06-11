import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = '@wanspot/review_tutorial_seen_v1'

export async function hasSeenReviewTutorial(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY)
    return v === '1'
  } catch {
    return false
  }
}

export async function markReviewTutorialSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1')
  } catch {
    // 失敗してもタブは止めない
  }
}
