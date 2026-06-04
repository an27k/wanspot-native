import Constants from 'expo-constants'
import { Platform } from 'react-native'

/** Google Cloud Console → iOS クライアント ID */
export const GOOGLE_IOS_CLIENT_ID =
  '573139399424-cgqe3u58m724rpjsm5uu0u1t69qor80m.apps.googleusercontent.com'

/** iOS OAuth クライアントの reversed URL scheme（Info.plist の CFBundleURLSchemes に必須） */
export const GOOGLE_IOS_URL_SCHEME =
  'com.googleusercontent.apps.573139399424-cgqe3u58m724rpjsm5uu0u1t69qor80m'

function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = typeof v === 'string' ? v.trim() : ''
    if (t) return t
  }
  return ''
}

/** Google Cloud Console → Web クライアント ID（Supabase Auth の Google 設定と同じ値） */
export function getGoogleWebClientId(): string {
  const extra = Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined
  return firstNonEmpty(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, extra?.googleWebClientId)
}

/** `false` / `0` で UI から Google を強制非表示（実機未確認時の安全弁） */
export function isGoogleSignInUiEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN?.trim().toLowerCase()
  if (flag === 'false' || flag === '0') return false
  return true
}

/** ネイティブ Google Sign-In を実行可能か（iOS + Web Client ID 設定済み） */
export function isGoogleSignInConfigured(): boolean {
  if (Platform.OS !== 'ios') return false
  if (!isGoogleSignInUiEnabled()) return false
  return GOOGLE_IOS_CLIENT_ID.trim().length > 0 && getGoogleWebClientId().length > 0
}
