import { adsEnabledForDevice } from '@/lib/ads-policy'

/** 5件毎のリスト広告注入間隔（ADS_ENABLED=true 時のみ有効） */
export const LIST_AD_ROW_EVERY = 5

/** リストへの広告注入が有効か（マスターフラグ + 端末ポリシー） */
export function listAdsInjectionEnabled(): boolean {
  return adsEnabledForDevice()
}

/**
 * index 番目のアイテムの直後に広告行を差し込むか。
 * ADS_ENABLED=false 時は常に false（空枠・プレースホルダも出さない）。
 */
export function shouldInjectListAd(index: number, total: number): boolean {
  if (!listAdsInjectionEnabled()) return false
  return (
    (index + 1) % LIST_AD_ROW_EVERY === 0 ||
    (index + 1 === total && total < LIST_AD_ROW_EVERY)
  )
}
