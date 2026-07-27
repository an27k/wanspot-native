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
export function setAnalyticsDogProfile(breed: string | null, size: string | null): void {
  dogBreed = breed?.trim() || null
  dogSize = size?.trim() || null
}

export type AnalyticsContext = {
  lat: number | null
  lng: number | null
  dog_breed: string | null
  dog_size: string | null
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
    platform: Platform.OS,
    app_version: appVersion,
    session_id: sessionId,
  }
}
