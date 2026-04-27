import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

type Option = { label: string; value: string; icon?: string; disabled?: boolean }

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Option[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const selected = value === opt.value
        const disabled = !!opt.disabled
        return (
          <Pressable
            key={opt.value}
            disabled={disabled}
            onPress={() => {
              if (!disabled) onChange(opt.value)
            }}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              !disabled && pressed && styles.optionPressed,
              disabled && styles.optionDisabled,
            ]}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon as never}
                size={18}
                color={disabled ? '#ccc' : selected ? '#1A1A1A' : '#999'}
              />
            ) : null}
            <Text
              style={[
                styles.optionText,
                selected && styles.optionTextSelected,
                disabled && styles.optionTextDisabled,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F5F4F0',
  },
  optionSelected: {
    backgroundColor: '#FFD84D',
  },
  optionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  optionDisabled: {
    opacity: 0.45,
  },
  optionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  optionTextDisabled: {
    color: '#999',
  },
})

