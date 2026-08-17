import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'

/**
 * 「登録しないで使う」を選んだ端末。
 *
 * 覚えておかないと、起動のたびに入口画面が挟まる。一度断った人に毎回同じ壁を
 * 見せるのは、登録の動機にはならず離脱の理由にしかならない。登録への導線は
 * 設定タブと、アカウントが要る操作を押したときに出す。
 */
const GUEST_CHOSEN_KEY = 'auth:continue_as_guest'

let cachedChoice: boolean | null = null

/** 起動時のゲート判定に使う。未選択なら false */
export async function hasChosenGuest(): Promise<boolean> {
  if (cachedChoice !== null) return cachedChoice
  const stored = await AsyncStorage.getItem(GUEST_CHOSEN_KEY)
  cachedChoice = stored === '1'
  return cachedChoice
}

/** ログイン・新規登録が済んだら消す。次にサインアウトしたときは入口から始める */
export async function clearGuestChoice(): Promise<void> {
  cachedChoice = false
  await AsyncStorage.removeItem(GUEST_CHOSEN_KEY)
}

/**
 * アカウントなしで地図・イベント一覧へ進む。
 * Apple Guideline 5.1.1(v): アカウント不要の機能をログイン壁の奥に置かない。
 */
export function continueAsGuest(): void {
  cachedChoice = true
  // 保存を待たずに進める。書き込みに失敗しても、その回の閲覧は妨げない
  void AsyncStorage.setItem(GUEST_CHOSEN_KEY, '1')
  router.replace('/(tabs)')
}
