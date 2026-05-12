import { Platform } from 'react-native'
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency'
import mobileAds from 'react-native-google-mobile-ads'
import { iosNativeAdUnitIdLooksLikeAppIdSuffix, isUsingIosDemoNativeAdUnit } from '@/constants/admob'
import { adsEnabledForDevice } from '@/lib/ads-policy'

let preparePromise: Promise<void> | null = null
/** `mobileAds().initialize()` まで成功したか（タブ切替で adsReady を落とさない判断に使う） */
let sdkInitialized = false

export function isAdsMobileSdkInitialized(): boolean {
  return sdkInitialized
}

/**
 * Run once before showing ads on the search tab (ATT + mobileAds init).
 * Deferred from app root to reduce startup contention.
 */
export function prepareSearchTabAdsOnce(): Promise<void> {
  if (!adsEnabledForDevice()) {
    return Promise.resolve()
  }
  if (preparePromise == null) {
    preparePromise = (async () => {
      if (Platform.OS === 'ios' && isUsingIosDemoNativeAdUnit()) {
        console.warn(
          'AdMob: iOS release is using Google demo native ad unit. Set EXPO_PUBLIC_ADMOB_IOS_NATIVE_AD_UNIT_ID in .env for real monetization.'
        )
      }
      if (Platform.OS === 'ios' && iosNativeAdUnitIdLooksLikeAppIdSuffix()) {
        console.warn(
          'AdMob: Native unit id suffix matches app id (~) suffix — invalid. Use the Native ad unit id from AdMob console.'
        )
      }
      await requestTrackingPermissionsAsync()
      await mobileAds().initialize()
      sdkInitialized = true
    })().catch((err) => {
      preparePromise = null
      sdkInitialized = false
      return Promise.reject(err)
    })
  }
  return preparePromise
}
