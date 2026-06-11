import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type Props = {
  label: string
  value: string
  placeholder?: string
  onPress: () => void
  subdued?: boolean
}

/** タップで展開する選択行（ホイール常時表示の代替） */
export function TapSelectRow({ label, value, placeholder = 'タップして選ぶ', onPress, subdued }: Props) {
  const filled = value.trim().length > 0
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        subdued && styles.rowSubdued,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.textCol}>
        <Text style={[styles.lbl, subdued && styles.lblSubdued]}>{label}</Text>
        <Text style={[styles.val, !filled && styles.placeholder]} numberOfLines={1}>
          {filled ? value : placeholder}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={subdued ? '#bbb' : '#888'} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowSubdued: { backgroundColor: '#FAFAF8', borderColor: '#EEE' },
  rowPressed: { opacity: 0.85 },
  textCol: { flex: 1 },
  lbl: { fontSize: 11, fontWeight: '700', color: '#999', marginBottom: 2 },
  lblSubdued: { color: '#bbb' },
  val: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  placeholder: { color: '#BBB', fontWeight: '500' },
})
