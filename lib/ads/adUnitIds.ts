import { Platform } from 'react-native'
import { TestIds } from 'react-native-google-mobile-ads'

const expoEnv = process.env.EXPO_PUBLIC_ENV
/** 開発、または EAS 等で `EXPO_PUBLIC_ENV` が本番以外に明示されたときはテスト枠。未設定のリリースは本番扱い。 */
const useTestAdUnitIds =
  __DEV__ || (expoEnv != null && typeof expoEnv === 'string' && expoEnv.length > 0 && expoEnv !== 'production')

export const getNativeAdUnitId = (): string => {
  if (useTestAdUnitIds) return TestIds.NATIVE
  return (
    Platform.select({
      ios: process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_AD_UNIT_ID ?? TestIds.NATIVE,
      android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_AD_UNIT_ID ?? TestIds.NATIVE,
    }) ?? TestIds.NATIVE
  )
}

export const getVideoNativeAdUnitId = (): string => {
  if (useTestAdUnitIds) return TestIds.NATIVE_VIDEO
  return (
    Platform.select({
      ios: process.env.EXPO_PUBLIC_ADMOB_IOS_VIDEO_NATIVE_AD_UNIT_ID ?? TestIds.NATIVE_VIDEO,
      android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_VIDEO_NATIVE_AD_UNIT_ID ?? TestIds.NATIVE_VIDEO,
    }) ?? TestIds.NATIVE_VIDEO
  )
}
