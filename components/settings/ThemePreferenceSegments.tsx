import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import type { ThemePreference } from '@/lib/theme-pref'

const THEME_OPTIONS = [
  { key: 'system', label: '端末に合わせる', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'ライト', icon: 'sunny-outline' },
  { key: 'dark', label: 'ダーク', icon: 'moon-outline' },
] as const satisfies readonly {
  key: ThemePreference
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[]

export function ThemePreferenceSegments() {
  const { colors, preference, setPreference } = useAppTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {THEME_OPTIONS.map((option) => {
        const selected = preference === option.key

        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityLabel={`テーマ: ${option.label}`}
            accessibilityState={{ selected }}
            onPress={() => setPreference(option.key)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && styles.segmentPressed,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={19}
              color={selected ? colors.primary : colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[styles.label, selected && styles.labelSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    group: {
      flexDirection: 'row',
      gap: 6,
      padding: 5,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      minWidth: 0,
      flex: 1,
      minHeight: 58,
      paddingHorizontal: 6,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    segmentSelected: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    segmentPressed: {
      opacity: 0.72,
    },
    label: {
      ...type.caption,
      maxWidth: '100%',
      color: colors.textSecondary,
      fontWeight: '600',
    },
    labelSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
  })
