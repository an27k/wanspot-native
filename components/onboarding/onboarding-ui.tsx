import { Logo } from '@/components/Logo'

/** AppHeader と同じ wanspot マーク（黄→オレンジグラデ＋犬シルエット）。 */
export function OnboardingBrand({ width = 28, height = 28 }: { width?: number; height?: number }) {
  const size = Math.max(width, height)
  return <Logo size={size} />
}
