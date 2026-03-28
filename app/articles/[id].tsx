import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import ArticleDetailScreen from '@/components/articles/ArticleDetailScreen'
import { colors } from '@/constants/colors'

export default function ArticleDetailRoute() {
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

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cardBg },
  err: { color: colors.textMuted },
})
