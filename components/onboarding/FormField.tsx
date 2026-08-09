import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>
          {label}
          {required && <Text style={styles.fieldRequired}> *</Text>}
        </Text>
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {children}
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  fieldGroup: {
    marginBottom: 22,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  fieldLabel: {
    ...type.label,
    color: colors.textPrimary,
  },
  // 入れ子の Text なので太さは親（label の700）を継承させる。ここだけ細いと浮く
  fieldRequired: {
    color: colors.primary,
  },
  fieldHint: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: 8,
  },
})

