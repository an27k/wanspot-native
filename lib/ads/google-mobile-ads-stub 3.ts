/**
 * ADS_ENABLED=false 時の Metro エイリアス先。
 * ネイティブ SDK をリンクしないビルドでも import 評価で落ちないよう no-op を提供する。
 */
import type { ComponentType, ReactNode } from 'react'

export const TestIds = {
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
  BANNER: 'ca-app-pub-3940256099942544/2934735716',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/4411468910',
  REWARDED: 'ca-app-pub-3940256099942544/1712485313',
  REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/6978759866',
  NATIVE: 'ca-app-pub-3940256099942544/2247696110',
  NATIVE_VIDEO: 'ca-app-pub-3940256099942544/1044960115',
  GAM_APP_OPEN: '/21775744923/example/ad-unit',
  GAM_BANNER: '/6499/example/banner',
  GAM_INTERSTITIAL: '/6499/example/interstitial',
  GAM_REWARDED: '/6499/example/rewarded',
  GAM_NATIVE: '/6499/example/native',
  GAM_NATIVE_VIDEO: '/6499/example/nativevideo',
} as const

export const NativeMediaAspectRatio = {
  ANY: 1,
  LANDSCAPE: 2,
  PORTRAIT: 3,
  SQUARE: 4,
} as const

export const BannerAdSize = {
  BANNER: 'BANNER',
  ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
  FULL_BANNER: 'FULL_BANNER',
  LARGE_BANNER: 'LARGE_BANNER',
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
  LEADERBOARD: 'LEADERBOARD',
  WIDE_SKYSCRAPER: 'WIDE_SKYSCRAPER',
} as const

export type NativeAd = {
  destroy: () => void
}

export type NativeAdRequestOptions = Record<string, unknown>

export const NativeAd = {
  createForAdRequest: async (_unitId: string, _opts?: NativeAdRequestOptions): Promise<NativeAd> => ({
    destroy: () => {},
  }),
}

export function BannerAd(_props: { unitId: string; size?: string; children?: ReactNode }) {
  return null
}

export function NativeAdView({ children }: { nativeAd?: NativeAd; children?: ReactNode; style?: unknown; collapsable?: boolean }) {
  return children ?? null
}

export function NativeMediaView(_props: Record<string, unknown>) {
  return null
}

export const NativeAssetType = {
  ADVERTISER: 'advertiser',
  BODY: 'body',
  CALL_TO_ACTION: 'callToAction',
  HEADLINE: 'headline',
  ICON: 'icon',
  PRICE: 'price',
  STAR_RATING: 'starRating',
  STORE: 'store',
} as const

export function NativeAsset({ children }: { assetType?: string; children?: ReactNode }) {
  return children ?? null
}

export default function mobileAds() {
  return {
    initialize: async () => {},
    setRequestConfiguration: async () => {},
  }
}
