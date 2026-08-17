import { StyleSheet, View } from 'react-native'
import { OnboardingBrandLockup } from '@/components/onboarding/onboarding-ui'
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding-constants'
import type { AppColors } from '@/constants/colors'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Props = {
  /** 1 始まりの現在ステップ */
  step: number
  /** 位置許可済みなら 2、フォールバックなら 3 */
  totalSteps?: number
}

/** オンボーディング進行ドット + ブランド行 */
export function OnboardingStepHeader({ step, totalSteps = ONBOARDING_TOTAL_STEPS }: Props) {
  const styles = useThemedStyles(createStyles)
  const steps = Math.max(1, totalSteps)
  const activeIndex = Math.max(0, Math.min(steps - 1, step - 1))
  return (
    <View style={styles.header}>
      <OnboardingBrandLockup />
      <View style={styles.dots}>
        {Array.from({ length: steps }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i <= activeIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: { alignItems: 'center', gap: 14, marginBottom: 8 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 36, height: 4, borderRadius: 2 },
  dotActive: { backgroundColor: colors.primary },
  dotInactive: { backgroundColor: colors.border },
})
