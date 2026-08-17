import { ADS_ENABLED } from '@/constants/ads'

type Props = {
  adsReady: boolean
}

/**
 * リスト挿入用広告スロット。ADS_ENABLED=false では AdNativeCard 自体を import しない。
 */
export function ListAdSlot({ adsReady }: Props) {
  if (!ADS_ENABLED) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AdNativeCard } = require('@/components/AdNativeCard') as typeof import('@/components/AdNativeCard')
  return <AdNativeCard adsReady={adsReady} />
}
