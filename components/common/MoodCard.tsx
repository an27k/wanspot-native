import { Pressable, StyleSheet, Text } from 'react-native'

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
    backgroundColor: '#FFD84D',
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
    color: '#1A1A1A',
  },
  moodSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  moodSubtitleSelected: {
    color: '#444',
  },
})

