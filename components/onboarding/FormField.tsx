import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { type } from '@/constants/typography'

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

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  fieldLabel: {
    ...type.label,
    color: '#1A1A1A',
  },
  // 入れ子の Text なので太さは親（label の700）を継承させる。ここだけ細いと浮く
  fieldRequired: {
    color: '#FF6B6B',
  },
  fieldHint: {
    ...type.caption,
    color: '#999',
    marginBottom: 8,
  },
})

