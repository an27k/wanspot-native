import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { AppHeader } from '@/components/AppHeader'
import { supabase } from '@/lib/supabase'

type Block =
  | { type: 'text'; content: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'spot'; spot_id: string; spot_name: string; description: string }

type Article = {
  id: string
  title: string
  summary: string
  image_url: string | null
  blocks: Block[] | null
  category: string
}

export default function ArticleDetailScreen({ articleId }: { articleId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const isUuid = /^[0-9a-f-]{36}$/i.test(articleId)
    const q = supabase.from('articles').select('id,title,summary,image_url,blocks,category').eq('status', 'published')
    const { data } = isUuid ? await q.eq('id', articleId).maybeSingle() : await q.eq('slug', articleId).maybeSingle()
    setArticle(data as Article | null)
    setLoading(false)
  }, [articleId])

  useEffect(() => {
    load()
  }, [load])

  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 32

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="記事" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      </View>
    )
  }

  if (!article) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" title="記事" onBack={() => router.back()} />
        <Text style={styles.empty}>記事が見つかりません</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppHeader variant="back" title="記事" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
        {article.image_url ? (
          <Image source={{ uri: article.image_url }} style={styles.hero} resizeMode="cover" />
        ) : null}
        <View style={styles.pad}>
          <Text style={styles.cat}>{article.category}</Text>
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.sum}>{article.summary}</Text>
          {(article.blocks ?? []).map((b, i) => {
            if (b.type === 'text') {
              return (
                <Text key={i} style={styles.body}>
                  {b.content}
                </Text>
              )
            }
            if (b.type === 'image') {
              return (
                <View key={i} style={{ marginTop: 16 }}>
                  <Image source={{ uri: b.url }} style={styles.blockImg} resizeMode="cover" />
                  {b.caption ? <Text style={styles.cap}>{b.caption}</Text> : null}
                </View>
              )
            }
            return (
              <Pressable
                key={i}
                style={styles.spotBox}
                onPress={() => router.push(`/spots/${b.spot_id}`)}
              >
                <Text style={styles.spotName}>{b.spot_name}</Text>
                <Text style={styles.body}>{b.description}</Text>
                <Text style={styles.spotTap}>スポットを見る</Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  hero: { width: '100%', height: 220 },
  pad: { padding: 16 },
  cat: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8 },
  sum: { fontSize: 15, color: colors.textLight, marginTop: 12, lineHeight: 22 },
  body: { fontSize: 15, color: colors.text, marginTop: 14, lineHeight: 24 },
  blockImg: { width: '100%', height: 200, borderRadius: 12 },
  cap: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  spotBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spotName: { fontWeight: '800', marginBottom: 6, color: colors.text },
  spotTap: { fontSize: 12, fontWeight: '700', color: colors.brandDark, marginTop: 8 },
})
