import { Pressable, StyleSheet, Text } from 'react-native'
import { colors } from '@/constants/colors'

export function MoodCard({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string
  subtitle: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.moodCard,
        selected && styles.moodCardSelected,
        pressed && styles.moodCardPressed,
      ]}
    >
      <Text style={[styles.moodTitle, selected && styles.moodTitleSelected]}>{title}</Text>
      <Text style={[styles.moodSubtitle, selected && styles.moodSubtitleSelected]}>{subtitle}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  moodCard: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F4F0',
    alignItems: 'center',
    gap: 4,
  },
  moodCardSelected: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  moodCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  moodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#666',
  },
  moodTitleSelected: {
    color: '#FFFFFF',
  },
  moodSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  moodSubtitleSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
})

