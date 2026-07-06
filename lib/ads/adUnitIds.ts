import { Platform } from 'react-native'

/** Google 公式テスト枠（react-native-google-mobile-ads の TestIds と同値） */
const TEST_NATIVE = 'ca-app-pub-3940256099942544/2247696110'
const TEST_NATIVE_VIDEO = 'ca-app-pub-3940256099942544/1044960115'

const expoEnv = process.env.EXPO_PUBLIC_ENV
/** 開発、または EAS 等で `EXPO_PUBLIC_ENV` が本番以外に明示されたときはテスト枠。未設定のリリースは本番扱い。 */
const useTestAdUnitIds =
  __DEV__ || (expoEnv != null && typeof expoEnv === 'string' && expoEnv.length > 0 && expoEnv !== 'production')

export const getNativeAdUnitId = (): string => {
  if (useTestAdUnitIds) return TEST_NATIVE
  return (
    Platform.select({
      ios: process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_AD_UNIT_ID ?? TEST_NATIVE,
      android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_AD_UNIT_ID ?? TEST_NATIVE,
    }) ?? TEST_NATIVE
  )
}

export const getVideoNativeAdUnitId = (): string => {
  if (useTestAdUnitIds) return TEST_NATIVE_VIDEO
  return (
    Platform.select({
      ios: process.env.EXPO_PUBLIC_ADMOB_IOS_VIDEO_NATIVE_AD_UNIT_ID ?? TEST_NATIVE_VIDEO,
      android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_VIDEO_NATIVE_AD_UNIT_ID ?? TEST_NATIVE_VIDEO,
    }) ?? TEST_NATIVE_VIDEO
  )
}
