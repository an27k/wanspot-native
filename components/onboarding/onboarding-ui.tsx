import { Image } from 'react-native'
import { brandLogoSource } from '@/assets/brandLogo'

/** AppHeader と同じ wanspot マーク（PNG）。サイズはヘッダーのロゴに合わせる */
export function OnboardingBrand({ width = 28, height = 28 }: { width?: number; height?: number }) {
  return (
    <Image
      source={brandLogoSource}
      style={{ width, height }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  )
}
