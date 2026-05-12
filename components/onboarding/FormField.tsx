import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

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
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  fieldRequired: {
    color: '#FF6B6B',
    fontWeight: '500',
  },
  fieldHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
})

