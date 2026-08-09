import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { BrandLoader } from '@/components/common/BrandLoader'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export const RunningDog = ({ label = '読み込み中...', size = 96 }: { label?: string; size?: number }) => {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.runWrap}>
      <BrandLoader size={size} />
      <Text style={styles.runLabel}>{label}</Text>
    </View>
  )
}

export const PowState = ({
  label = '見つかりませんでした',
  onRetry,
}: {
  label?: string
  onRetry?: () => void
}) => {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.runWrap}>
      <Text style={styles.powLabel}>{label}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.retryTxt}>もう一度検索する</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  runWrap: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  runLabel: { ...type.caption, color: colors.textSecondary },
  powLabel: { ...type.caption, fontSize: 14.5, lineHeight: 23, color: colors.textSecondary, textAlign: 'center' as const },
  retryBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  retryTxt: { ...type.button, fontSize: 15, color: colors.textSecondary },
})
