import { Platform } from 'react-native'
import { getTrackingPermissionsAsync } from 'expo-tracking-transparency'
import { NativeAd, NativeMediaAspectRatio, type NativeAdRequestOptions } from 'react-native-google-mobile-ads'

/** 連続ロード間の間隔（Hermes/GC・ブリッジ負荷を分散） */
const STAGGER_MS = 350

let chain: Promise<unknown> = Promise.resolve()

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/**
 * iOS: ATT 未許可は NPA。許可済みでも後半リトライでは NPA を試し、在庫が付きやすいパターンに対応する。
 */
export async function buildNativeAdRequestOptions(attemptIndex: number): Promise<NativeAdRequestOptions | undefined> {
  if (Platform.OS !== 'ios') return undefined
  try {
    const { status } = await getTrackingPermissionsAsync()
    const attDenied = status !== 'granted'
    const tryNpaAfterPersonalizedFails = !attDenied && attemptIndex >= 2
    return {
      requestNonPersonalizedAdsOnly: attDenied || tryNpaAfterPersonalizedFails,
      aspectRatio: NativeMediaAspectRatio.ANY,
      startVideoMuted: true,
    }
  } catch {
    return {
      requestNonPersonalizedAdsOnly: true,
      aspectRatio: NativeMediaAspectRatio.ANY,
      startVideoMuted: true,
    }
  }
}

/**
 * アプリ全体で Native 広告のロードを1本化する。
 * 一覧に複数枠があると同時 create が走りやすく、iOS 26 + Hermes で SIGSEGV が出る事例があるため。
 */
export function enqueueNativeAdRequest(unitId: string, requestOptions?: NativeAdRequestOptions): Promise<NativeAd> {
  return new Promise<NativeAd>((resolve, reject) => {
    chain = chain
      .then(async () => {
        await delay(STAGGER_MS)
        try {
          const ad = await NativeAd.createForAdRequest(unitId, requestOptions)
          resolve(ad)
        } catch (e) {
          reject(e)
        }
      })
      .catch(() => {
        /* キューを途切れさせない */
      })
  })
}
