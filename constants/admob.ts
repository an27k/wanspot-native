/**
 * AdMob identifiers
 *
 * - App ID: ca-app-pub-...~... in app.json (iosAppId)
 * - Ad unit: ca-app-pub-.../... must be a Native ad unit from AdMob console
 * - Do NOT reuse the same numeric suffix as after ~ in the slash unit (invalid)
 *
 * Release / TestFlight iOS:
 * - If IOS_NATIVE_AD_UNIT_ID and extra.admobIosNativeAdUnitId are both empty,
 *   we use Google's official iOS native DEMO unit (fill works for QA).
 * - Before App Store / monetization, set your real native unit ID.
 */
import Constants from 'expo-constants'

/** Google sample native ad unit (iOS). Used only when no production ID is set. */
export const GOOGLE_DEMO_IOS_NATIVE_AD_UNIT_ID = 'ca-app-pub-3940256099942544/3986624511'

/** Your AdMob Native ad unit ID (paste from console). Empty => demo unit on iOS release. */
export const IOS_NATIVE_AD_UNIT_ID = ''

/** Suffix after ~ in iosAppId; used to detect mistaken copy-paste of app id as unit id */
export const IOS_ADMOB_APP_ID_SUFFIX = '3258937977'

const extra = Constants.expoConfig?.extra as { admobIosNativeAdUnitId?: string } | undefined

function iosNativeIdFromExtra(): string {
  const v = extra?.admobIosNativeAdUnitId
  return typeof v === 'string' ? v.trim() : ''
}

/** iOS release: always returns a non-empty unit id string */
export function getIosReleaseNativeAdUnitId(): string {
  const fromExtra = iosNativeIdFromExtra()
  if (fromExtra.length > 0) return fromExtra
  const fromConst = IOS_NATIVE_AD_UNIT_ID.trim()
  if (fromConst.length > 0) return fromConst
  return GOOGLE_DEMO_IOS_NATIVE_AD_UNIT_ID
}

export function isUsingIosDemoNativeAdUnit(): boolean {
  if (iosNativeIdFromExtra().length > 0) return false
  return IOS_NATIVE_AD_UNIT_ID.trim().length === 0
}

export function iosNativeAdUnitIdLooksLikeAppIdSuffix(): boolean {
  const id = iosNativeIdFromExtra().length > 0 ? iosNativeIdFromExtra() : IOS_NATIVE_AD_UNIT_ID.trim()
  if (id.length === 0) return false
  const m = id.match(/\/(\d+)\s*$/)
  return m != null && m[1] === IOS_ADMOB_APP_ID_SUFFIX
}

export const ANDROID_NATIVE_AD_UNIT_ID = ''
