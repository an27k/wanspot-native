import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import ArticleDetailScreen from '@/components/articles/ArticleDetailScreen'
import type { AppColors } from '@/constants/colors'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function ArticleDetailRoute() {
  const styles = useThemedStyles(createStyles)
  const { id } = useLocalSearchParams<{ id: string }>()
  const articleId = Array.isArray(id) ? id[0] : id
  if (!articleId) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.err}>無効な記事です</Text>
      </View>
    )
  }
  return <ArticleDetailScreen articleId={articleId} />
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cardBg },
  err: { color: colors.textMuted },
})
