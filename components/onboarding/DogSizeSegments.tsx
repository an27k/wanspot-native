import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export const DOG_SIZE_OPTIONS = [
  { key: 'XS' as const, label: 'XS', desc: '〜4kg · 〜25cm' },
  { key: 'S' as const, label: 'S', desc: '4〜10kg · 25〜40cm' },
  { key: 'M' as const, label: 'M', desc: '10〜25kg · 40〜60cm' },
  { key: 'L' as const, label: 'L', desc: '25〜45kg · 60〜75cm' },
  { key: 'XL' as const, label: 'XL', desc: '45kg〜 · 75cm〜' },
]

export type DogSizeKey = (typeof DOG_SIZE_OPTIONS)[number]['key']

type Props = {
  value: DogSizeKey | null
  onChange: (size: DogSizeKey) => void
}

export function DogSizeSegments({ value, onChange }: Props) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.row}>
      {DOG_SIZE_OPTIONS.map(({ key, label, desc }) => {
        const on = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={({ pressed }) => [styles.seg, on && styles.segOn, pressed && styles.segPressed]}
          >
            <Text style={[styles.segLbl, on && styles.segLblOn]}>{label}</Text>
            {on ? <Text style={styles.segDesc}>{desc}</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seg: {
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segOn: { backgroundColor: colors.tintWeak, borderColor: colors.primary, minWidth: '100%' },
  segPressed: { opacity: 0.85 },
  // XS〜XL は必須の選択肢そのもの。バッジではなくボタンの文字として扱う
  segLbl: { ...type.button, color: colors.textSecondary },
  segLblOn: { color: colors.primary },
  segDesc: { ...type.caption, marginTop: 4, color: colors.textSecondary },
})
