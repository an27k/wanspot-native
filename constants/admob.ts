/**
 * AdMob identifiers（審査・在庫）
 *
 * - App ID: `app.json` → `react-native-google-mobile-ads.iosAppId` / `androidAppId`
 * - ネイティブ枠: `lib/ads/adUnitIds.ts` + `.env` の `EXPO_PUBLIC_ADMOB_*`
 */
import { Platform } from 'react-native'
import { getNativeAdUnitId, getVideoNativeAdUnitId } from '@/lib/ads/adUnitIds'

export { getNativeAdUnitId, getVideoNativeAdUnitId } from '@/lib/ads/adUnitIds'

/** Google 提供の iOS 向けデモ・ネイティブ枠（`getNativeAdUnitId()` がこれのとき審問） */
export const GOOGLE_DEMO_IOS_NATIVE_AD_UNIT_ID = 'ca-app-pub-3940256099942544/3986624511'

/** `iosAppId` の `~` 以降。本番のネイティブ枠IDを混同したときの検出に使う */
export const IOS_ADMOB_APP_ID_SUFFIX = '3258937977'

/** 旧コード互換: 現在は常に `getNativeAdUnitId()` と同じ */
export function getIosReleaseNativeAdUnitId(): string {
  return getNativeAdUnitId()
}

export function isUsingIosDemoNativeAdUnit(): boolean {
  if (__DEV__ || Platform.OS !== 'ios') return false
  return getNativeAdUnitId() === GOOGLE_DEMO_IOS_NATIVE_AD_UNIT_ID
}

export function iosNativeAdUnitIdLooksLikeAppIdSuffix(): boolean {
  if (Platform.OS !== 'ios') return false
  const id = getNativeAdUnitId().trim()
  if (id.length === 0) return false
  const m = id.match(/\/(\d+)\s*$/)
  return m != null && m[1] === IOS_ADMOB_APP_ID_SUFFIX
}

export function resolveAiPlanResultNativeAdUnitId(): string {
  return getNativeAdUnitId()
}

export function resolveAiPlanVideoNativeAdUnitId(): string {
  return getVideoNativeAdUnitId()
}
