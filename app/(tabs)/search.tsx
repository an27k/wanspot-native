import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/AppHeader'
import { SearchResultCard } from '@/components/search/SearchResultCard'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { ensureSpotId } from '@/lib/ensureSpot'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetch } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

type Discover = 'articles' | 'ai' | 'hot'

type ArticleRow = {
  id: string
  title: string
  summary: string
  slug: string
  category: string
  image_url: string | null
}

const DEFAULT_TAGS = ['ドッグキャンプ', '代々木公園', '犬と温泉', 'ドッグビーチ', '吉祥寺']

export default function SearchTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [discover, setDiscover] = useState<Discover>('articles')
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [artLoading, setArtLoading] = useState(false)
  const [aiResults, setAiResults] = useState<PlaceResult[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [hotResults, setHotResults] = useState<PlaceResult[]>([])
  const [hotLoading, setHotLoading] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS)

  useEffect(() => {
    Location.getCurrentPositionAsync({}).then((p) =>
      setLocation({ lat: p.coords.latitude, lng: p.coords.longitude })
    ).catch(() => {})
  }, [])

  const runSearch = async (q: string) => {
    const t = q.trim()
    if (!t) return
    setLoading(true)
    try {
      const loc = location ? `&lat=${location.lat}&lng=${location.lng}` : ''
      const res = await wanspotFetch(`/api/spots/search?q=${encodeURIComponent(t)}${loc}`)
      const json = (await res.json()) as { spots?: PlaceResult[] }
      setResults(json.spots ?? [])
    } finally {
      setLoading(false)
    }
  }

  const loadArticles = useCallback(async () => {
    if (articles.length > 0) return
    setArtLoading(true)
    const { data } = await supabase
      .from('articles')
      .select('id, title, summary, slug, category, image_url')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20)
    setArticles((data ?? []) as ArticleRow[])
    setArtLoading(false)
  }, [articles.length])

  const runAi = async () => {
    if (aiLoading || aiResults.length > 0) return
    setAiLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAiLoading(false)
        return
      }
      const res = await wanspotFetch('/api/spots/recommend', {
        method: 'POST',
        json: { userId: user.id, lat: location?.lat, lng: location?.lng },
      })
      const json = (await res.json()) as { query?: string }
      const q = json.query ?? 'ドッグラン'
      const loc = location ? `&lat=${location.lat}&lng=${location.lng}` : ''
      const sres = await wanspotFetch(`/api/spots/search?q=${encodeURIComponent(q)}${loc}`)
      const sjson = (await sres.json()) as { spots?: PlaceResult[] }
      setAiResults(sjson.spots ?? [])
    } catch {
      setAiResults([])
    } finally {
      setAiLoading(false)
    }
  }

  const runHot = async () => {
    if (hotLoading || hotResults.length > 0) return
    setHotLoading(true)
    try {
      const res = await wanspotFetch('/api/spots/hot', {
        method: 'POST',
        json: { lat: location?.lat, lng: location?.lng, prefecture: '東京' },
      })
      const json = (await res.json()) as { queries?: string[] }
      const queries = json.queries ?? ['犬カフェ 東京']
      const loc = location ? `&lat=${location.lat}&lng=${location.lng}` : ''
      const merged: PlaceResult[] = []
      const seen = new Set<string>()
      for (const q of queries) {
        const sres = await wanspotFetch(`/api/spots/search?q=${encodeURIComponent(q)}${loc}`)
        const sjson = (await sres.json()) as { spots?: PlaceResult[] }
        for (const s of sjson.spots ?? []) {
          if (!seen.has(s.place_id)) {
            seen.add(s.place_id)
            merged.push(s)
          }
        }
      }
      setHotResults(merged)
    } catch {
      setHotResults([])
    } finally {
      setHotLoading(false)
    }
  }

  useEffect(() => {
    if (discover === 'articles') loadArticles()
    if (discover === 'ai') runAi()
    if (discover === 'hot') runHot()
  }, [discover, loadArticles])

  const openSpot = async (spot: PlaceResult) => {
    const id = await ensureSpotId(spot)
    if (id) router.push(`/spots/${id}`)
  }

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  const seg = useMemo(
    () =>
      (['articles', 'ai', 'hot'] as const).map((k) => ({
        key: k,
        label: k === 'articles' ? 'まとめ記事' : k === 'ai' ? 'AIレコメンド' : 'ホット',
      })),
    []
  )

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingBottom: padBottom }}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            placeholder="スポット・エリア・キーワード"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            returnKeyType="search"
          />
          <Pressable style={styles.go} onPress={() => runSearch(query)}>
            <Text style={styles.goTxt}>検索</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
        <View style={styles.list}>
          {results.map((s) => (
            <SearchResultCard
              key={s.place_id}
              spot={s}
              photoUri={spotPhotoUrl(s.photo_ref, 400)}
              onPress={() => openSpot(s)}
            />
          ))}
        </View>

        <View style={styles.segRow}>
          {seg.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.seg, discover === s.key && styles.segOn]}
              onPress={() => setDiscover(s.key)}
            >
              <Text style={[styles.segTxt, discover === s.key && styles.segTxtOn]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tags}>
          {tags.map((t) => (
            <Pressable key={t} style={styles.tag} onPress={() => { setQuery(t); runSearch(t) }}>
              <Text style={styles.tagTxt}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {discover === 'articles' ? (
          artLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.list}>
              {articles.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.artCard}
                  onPress={() => router.push(`/articles/${a.id}`)}
                >
                  <Text style={styles.artCat}>{a.category}</Text>
                  <Text style={styles.artTitle}>{a.title}</Text>
                  <Text style={styles.artSum} numberOfLines={2}>{a.summary}</Text>
                </Pressable>
              ))}
            </View>
          )
        ) : null}

        {discover === 'ai' ? (
          aiLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.list}>
              {aiResults.map((s) => (
                <SearchResultCard
                  key={s.place_id}
                  spot={s}
                  photoUri={spotPhotoUrl(s.photo_ref, 400)}
                  onPress={() => openSpot(s)}
                />
              ))}
            </View>
          )
        ) : null}

        {discover === 'hot' ? (
          hotLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.list}>
              {hotResults.map((s) => (
                <SearchResultCard
                  key={s.place_id}
                  spot={s}
                  photoUri={spotPhotoUrl(s.photo_ref, 400)}
                  onPress={() => openSpot(s)}
                />
              ))}
            </View>
          )
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cardBg },
  searchBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    color: colors.text,
  },
  go: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.brand,
  },
  goTxt: { fontWeight: '800', color: colors.text },
  list: { padding: 12, gap: 10 },
  segRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 16, gap: 8 },
  seg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  segTxt: { fontSize: 11, fontWeight: '700', color: colors.textLight },
  segTxtOn: { color: colors.text },
  tags: { paddingHorizontal: 12, marginTop: 12, maxHeight: 40 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  tagTxt: { fontSize: 12, color: colors.text },
  artCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  artCat: { fontSize: 11, fontWeight: '700', color: colors.textLight },
  artTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4 },
  artSum: { fontSize: 13, color: colors.textLight, marginTop: 6 },
})
