import { StyleSheet, Text, View } from 'react-native'
import { OnboardingBrand } from '@/components/onboarding/onboarding-ui'
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding-constants'
import { colors } from '@/constants/colors'

type Props = {
  /** 1 始まりの現在ステップ */
  step: number
}

/** 3ステップ統一の進行ドット + ブランド行 */
export function OnboardingStepHeader({ step }: Props) {
  const activeIndex = Math.max(0, Math.min(ONBOARDING_TOTAL_STEPS - 1, step - 1))
  return (
    <View style={styles.headRow}>
      <View style={styles.brandRow}>
        <OnboardingBrand />
        <Text style={styles.brandTxt}>wanspot</Text>
      </View>
      <View style={styles.dots}>
        {Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: i <= activeIndex ? colors.primary : '#e0e0e0' }]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontWeight: '800', fontSize: 14, color: colors.textPrimary },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
})
