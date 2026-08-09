import { Logo } from '@/components/Logo'
import { StyleSheet, Text, View } from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'

/** AppHeader と同じ wanspot マーク（黄→オレンジグラデ＋犬シルエット）。 */
export function OnboardingBrand({ width = 28, height = 28 }: { width?: number; height?: number }) {
  const size = Math.max(width, height)
  return <Logo size={size} />
}

/** オンボーディングでも共通ヘッダーと同じ比率で見せるブランドロックアップ。 */
export function OnboardingBrandLockup() {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.lockup}>
      <OnboardingBrand width={30} height={30} />
      <Text style={styles.brandText}>Wanspot</Text>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  brandText: { ...type.heading, color: colors.textPrimary },
})
