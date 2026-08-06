import { Platform } from 'react-native'
import Constants from 'expo-constants'

/**
 * 行動分析イベントに自動で添える文脈（位置・犬属性・端末・セッション）。
 *
 * 位置は「アプリがすでに許可を得て取得済みのセッション位置」だけを使う。
 * 分析のためにバックグラウンド常時追跡はしない — うちの子との時間を見守るアプリが
 * 飼い主を追跡する作りにならないようにするため。
 */

type Coords = { lat: number; lng: number }

let sessionLocation: Coords | null = null
let dogBreed: string | null = null
let dogSize: string | null = null
let dogId: string | null = null
let dogBirthday: string | null = null

/** アプリ起動ごとに変わる導線分析用ID（端末・個人の識別子ではない） */
const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const appVersion =
  (Constants.expoConfig?.version as string | undefined) ??
  (Constants.expoConfig?.ios?.buildNumber as string | undefined) ??
  null

/** 位置が確定・更新されるたびに呼ぶ（未許可のままなら何も記録されない） */
export function setAnalyticsLocation(loc: Coords | null): void {
  sessionLocation = loc
}

/** 犬プロフィール取得時に呼ぶ。イベント時点のスナップショットとして記録される */
export function setAnalyticsDogProfile(
  breed: string | null,
  size: string | null,
  id: string | null = null,
  birthday: string | null = null
): void {
  dogBreed = breed?.trim() || null
  dogSize = size?.trim() || null
  dogId = id?.trim() || null
  dogBirthday = birthday?.trim() || null
}

/**
 * 誕生日から、いまの月齢を出す。
 *
 * 誕生日そのものではなく月齢を記録するのは、これが**あとから復元できない**値だから。
 * dogs テーブルには updated_at も履歴テーブルも無く、誕生日を直したり消したりすると
 * 前の値は完全に消える。誕生日は審査対応で任意入力になったので、空のまま使う人も出る。
 * イベント時点の月齢を焼き付けておけば、あとで誕生日が変わっても当時の分析が保てる。
 */
export function dogAgeMonths(birthday: string | null, now = new Date()): number | null {
  if (!birthday) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim())
  if (!m) return null
  const [, y, mo, d] = m.map(Number)
  const months = (now.getFullYear() - y!) * 12 + (now.getMonth() + 1 - mo!)
  // 誕生日前なら1か月引く
  const adjusted = now.getDate() < d! ? months - 1 : months
  // 未来日・壊れた値は捨てる。30歳(360か月)を超える犬はいない
  return adjusted >= 0 && adjusted <= 360 ? adjusted : null
}

export type AnalyticsContext = {
  lat: number | null
  lng: number | null
  dog_breed: string | null
  dog_size: string | null
  dog_id: string | null
  /** イベント時点の月齢。誕生日は変更・削除されうるので、その場で焼き付ける */
  dog_age_months: number | null
  platform: string
  app_version: string | null
  session_id: string
}

export function getAnalyticsContext(): AnalyticsContext {
  return {
    lat: sessionLocation?.lat ?? null,
    lng: sessionLocation?.lng ?? null,
    dog_breed: dogBreed,
    dog_size: dogSize,
    dog_id: dogId,
    dog_age_months: dogAgeMonths(dogBirthday),
    platform: Platform.OS,
    app_version: appVersion,
    session_id: sessionId,
  }
}
