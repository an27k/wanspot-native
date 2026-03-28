import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { AppHeader } from '@/components/AppHeader'
import { SearchDiscoverResultCard } from '@/components/search/SearchDiscoverResultCard'
import { PowState, RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'
import { filterHotSpotResults } from '@/lib/hot-exclusions'
import { wanspotFetch, wanspotFetchJson } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

const SEARCH_STORAGE_KEY = 'search_state_v1'
const SEARCH_RESTORE_FLAG = 'search_pending_restore'

type SortKey = 'default' | 'rating' | 'distance'

const DEFAULT_SUGGESTIONS = [
  'ドッグキャンプ',
  '代々木公園',
  '犬と温泉',
  'ドッグビーチ',
  '犬と泊まれる',
  '吉祥寺',
  'しつけ教室',
]

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: '関連順' },
  { key: 'rating', label: '評価順' },
  { key: 'distance', label: '距離順' },
]

const AI_LIKES_MIN = 5

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getPrefecture(lat: number, lng: number): Promise<string> {
  try {
    const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    const r0 = rows[0]
    if (r0?.region) return r0.region
    if (r0?.subregion) return r0.subregion
  } catch {
    /* ignore */
  }
  return '東京'
}

const IconSearch = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth={2.5} strokeLinecap="round">
    <Circle cx={11} cy={11} r={8} />
    <Line x1={21} y1={21} x2={16.65} y2={16.65} />
  </Svg>
)
const IconClose = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth={2.5} strokeLinecap="round">
    <Line x1={18} y1={6} x2={6} y2={18} />
    <Line x1={6} y1={6} x2={18} y2={18} />
  </Svg>
)
const IconSort = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
    <Line x1={3} y1={6} x2={21} y2={6} />
    <Line x1={3} y1={12} x2={15} y2={12} />
    <Line x1={3} y1={18} x2={9} y2={18} />
  </Svg>
)
/** 豆電球：光線＋球＋口金で判別しやすく */
const IconBulb = ({ fill }: { fill: string }) => {
  const filament = fill === '#fff' ? 'rgba(26,26,26,0.35)' : 'rgba(255,255,255,0.85)'
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Line x1="12" y1="0.8" x2="12" y2="3.2" stroke={fill} strokeWidth="2" strokeLinecap="round" />
      <Line x1="3.8" y1="5.5" x2="5.6" y2="6.8" stroke={fill} strokeWidth="1.7" strokeLinecap="round" />
      <Line x1="20.2" y1="5.5" x2="18.4" y2="6.8" stroke={fill} strokeWidth="1.7" strokeLinecap="round" />
      <Circle cx="12" cy="11.5" r="5.2" fill={fill} />
      <Path
        d="M10 9.5c.6 1.2 1.1 1.2 2 0 .9 1.2 1.4 1.2 2 0"
        stroke={filament}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      <Rect x="9" y="16.2" width="6" height="2.2" rx="0.9" fill={fill} />
      <Rect x="9.4" y="18.6" width="5.2" height="1.8" rx="0.5" fill={fill} opacity={0.92} />
    </Svg>
  )
}
const IconThumbUp = ({ fill }: { fill: string }) => (
  <Svg width={13} height={13} viewBox="0 0 512 512" fill={fill}>
    <Path d="M512,216.906c-0.031-29.313-23.781-53.078-53.094-53.094h-75.891c-3.531,0-43.578,0-47.219,0c-6.953,0.063-13.328,1.094-17.969,1.031c-1.859,0-3.328-0.156-4.188-0.344L313,164.313l-0.156-0.469c-0.141-0.609-0.281-1.625-0.281-3.094c0-0.906,0.141-2.188,0.25-3.438l30.281-74.875c2.906-7.188,4.281-14.656,4.281-21.969c0.031-23.188-13.844-45.156-36.656-54.406c-7.156-2.891-14.641-4.281-21.984-4.281c-23.203-0.016-45.141,13.875-54.391,36.672l-0.047,0.078l-51.359,129.313h0.031c-3.438,8.063-6.203,15.625-8.906,22.156c-4.078,10.031-8.063,17.25-12.766,21.438c-2.359,2.125-4.922,3.719-8.484,4.969c-3.531,1.219-8.172,2.047-14.391,2.047c-3.781-0.016-7.375,0.422-10.891,1.078H44.5c-24.594,0-44.5,19.922-44.5,44.5v201.703c0,24.578,19.906,44.484,44.5,44.484h61.578c13.641,0,24.719-11.063,24.719-24.719v-20.484c4.328,2.531,8.891,4.828,13.797,6.672c17.156,6.5,37.531,9.219,62.063,9.219h191.25c29.313,0,53.094-23.719,53.094-53.047c0-6.891-1.406-13.453-3.828-19.453c21.156-7,36.453-26.875,36.453-50.375c0.016-9.594-2.688-18.547-7.141-26.25c6.422-5.25,10.781-12.156,13.266-19.375c2.719-7.75,3.656-15.906,3.656-24.203c0-5.141-1.094-10.141-2.969-15.016c-1.375-3.469-3.172-6.891-5.375-10.125C501.125,253.938,511.984,236.703,512,216.906z" />
  </Svg>
)
/** 炎は絵文字と同じくらいの視認性のシルエット。絵文字は端末により多色のままになり `color` が効かないため、他タブと同じ #fff / #888 を SVG で統一 */
const IconHot = ({ fill }: { fill: string }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill={fill}>
    <Path d="M12 22a7 7 0 007-7c0-2.8-1.8-5.2-3.5-7-.2 1.6-1.1 2.8-2.2 3.4C12.8 10 12 8.2 12 6c0-1.1.3-2.1.8-3-3.5 2.5-5.8 5.6-5.8 9a7 7 0 007 10z" />
  </Svg>
)

type ArticleRow = {
  id: string
  title: string
  summary: string
  slug: string
  category: string
  keywords: string[]
  image_url: string | null
  created_at: string
}

export default function SearchTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [discoverMode, setDiscoverMode] = useState<'ai' | 'hot' | 'articles'>('articles')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('default')
  const [showSort, setShowSort] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS)
  const [suggestionsReady, setSuggestionsReady] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReason, setAiReason] = useState<string | null>(null)
  const [aiResults, setAiResults] = useState<PlaceResult[]>([])
  const [hotLoading, setHotLoading] = useState(false)
  const [hotResults, setHotResults] = useState<PlaceResult[]>([])
  const [hotLabel, setHotLabel] = useState<string | null>(null)
  const [articlesList, setArticlesList] = useState<ArticleRow[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [spotLikesCount, setSpotLikesCount] = useState<number | null>(null)
  const restoredRef = useRef(false)
  const scrollYRef = useRef(0)

  useEffect(() => {
    Location.getCurrentPositionAsync({}).then((p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude })).catch(() => {})
  }, [])

  useFocusEffect(
    useCallback(() => {
      let active = true
      void (async () => {
        const shouldRestore = (await AsyncStorage.getItem(SEARCH_RESTORE_FLAG)) === '1'
        if (shouldRestore) {
          await AsyncStorage.removeItem(SEARCH_RESTORE_FLAG)
          try {
            const saved = await AsyncStorage.getItem(SEARCH_STORAGE_KEY)
            if (saved && active) {
              const { query: q, results: r, sortKey: sk, scroll } = JSON.parse(saved) as {
                query: string
                results: PlaceResult[]
                sortKey: SortKey
                scroll: number
              }
              setQuery(q ?? '')
              setResults(r ?? [])
              setSortKey(sk ?? 'default')
              setSearched((r?.length ?? 0) > 0 || (q?.length ?? 0) > 0)
              if (scroll && !restoredRef.current) {
                restoredRef.current = true
                requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: scroll, animated: false }))
              }
            }
          } catch {
            /* ignore */
          }
        } else if (!shouldRestore) {
          await AsyncStorage.removeItem(SEARCH_STORAGE_KEY)
        }
      })()
      return () => {
        active = false
      }
    }, [])
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setSpotLikesCount(0)
        return
      }
      const { count, error } = await supabase
        .from('spot_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (!cancelled) setSpotLikesCount(error ? 0 : (count ?? 0))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!searched) return
    void AsyncStorage.setItem(
      SEARCH_STORAGE_KEY,
      JSON.stringify({ query, results, sortKey, scroll: scrollYRef.current })
    )
  }, [query, results, sortKey, searched])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const prefecture = location ? await getPrefecture(location.lat, location.lng) : undefined
        const res = await wanspotFetch('/api/spots/suggest-tags', {
          method: 'POST',
          json: {
            userId: user?.id ?? null,
            lat: location?.lat,
            lng: location?.lng,
            prefecture,
          },
        })
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { tags?: string[] }
          if (Array.isArray(data.tags) && data.tags.length > 0) {
            setSuggestions(data.tags)
            setSuggestionsReady(true)
          }
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location])

  const refreshSpotLikesCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSpotLikesCount(0)
      return
    }
    const { count, error } = await supabase
      .from('spot_likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    setSpotLikesCount(error ? 0 : (count ?? 0))
  }, [])

  const handleAiRecommend = useCallback(async () => {
    if (aiLoading || aiResults.length > 0) return
    setAiLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAiLoading(false)
        return
      }
      const { count, error: cntErr } = await supabase
        .from('spot_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      const n = cntErr ? 0 : (count ?? 0)
      if (n < AI_LIKES_MIN) {
        setSpotLikesCount(n)
        setAiLoading(false)
        return
      }
      const [result] = await Promise.all([
        wanspotFetchJson<{ query?: string; reason?: string }>('/api/spots/recommend', {
          method: 'POST',
          json: { userId: user.id, lat: location?.lat, lng: location?.lng },
        }),
        new Promise((r) => setTimeout(r, 1500)),
      ])
      const aiQuery = result.query ?? 'ドッグラン'
      setAiReason(result.reason ?? null)
      const locationParam = location ? `&lat=${location.lat}&lng=${location.lng}` : ''
      const searchRes = await wanspotFetch(`/api/spots/search?q=${encodeURIComponent(aiQuery)}${locationParam}`)
      const data = (await searchRes.json()) as { spots?: PlaceResult[] }
      setAiResults(data.spots ?? [])
    } catch {
      setAiResults([])
    } finally {
      setAiLoading(false)
    }
  }, [aiLoading, aiResults.length, location])

  const handleHot = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true
      if (hotLoading) return
      if (!force && hotResults.length > 0) return
      setHotLoading(true)
      try {
        const prefecture = location ? await getPrefecture(location.lat, location.lng) : '東京'
        const [result] = await Promise.all([
          wanspotFetchJson<{ queries?: string[]; label?: string }>('/api/spots/hot', {
            method: 'POST',
            json: { lat: location?.lat, lng: location?.lng, prefecture },
          }),
          new Promise((r) => setTimeout(r, force ? 0 : 1500)),
        ])
        const queries = result.queries ?? []
        setHotLabel(result.label ?? null)
        const locationParam = location ? `&lat=${location.lat}&lng=${location.lng}` : ''
        const allResults = await Promise.all(
          queries.map((q) =>
            wanspotFetch(`/api/spots/search?q=${encodeURIComponent(q)}${locationParam}`)
              .then((r) => r.json())
              .then((d) => (d as { spots?: PlaceResult[] }).spots ?? [])
              .catch(() => [] as PlaceResult[])
          )
        )
        const seen = new Set<string>()
        const merged: PlaceResult[] = []
        for (const spots of allResults) {
          for (const spot of spots) {
            if (!seen.has(spot.place_id)) {
              seen.add(spot.place_id)
              merged.push(spot)
            }
          }
        }
        setHotResults(filterHotSpotResults(merged))
      } catch {
        setHotResults([])
      } finally {
        setHotLoading(false)
      }
    },
    [hotLoading, hotResults.length, location]
  )

  const handleArticles = useCallback(async () => {
    if (articlesLoading || articlesList.length > 0) return
    setArticlesLoading(true)
    try {
      const { data } = await supabase
        .from('articles')
        .select('id, title, summary, slug, category, keywords, image_url, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20)
      setArticlesList((data ?? []) as ArticleRow[])
    } catch {
      setArticlesList([])
    } finally {
      setArticlesLoading(false)
    }
  }, [articlesLoading, articlesList.length])

  useEffect(() => {
    if (searched) return
    if (discoverMode === 'hot') void handleHot()
    if (discoverMode === 'articles') void handleArticles()
  }, [discoverMode, searched, handleHot, handleArticles])

  useEffect(() => {
    if (searched || spotLikesCount === null || spotLikesCount < AI_LIKES_MIN) return
    if (discoverMode !== 'ai') return
    void handleAiRecommend()
  }, [discoverMode, spotLikesCount, searched, handleAiRecommend])

  useEffect(() => {
    if (searched || !location || spotLikesCount === null || spotLikesCount < AI_LIKES_MIN) return
    if (discoverMode !== 'ai') return
    void handleAiRecommend()
  }, [location, searched, spotLikesCount, discoverMode, handleAiRecommend])

  const handleSearch = async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setQuery(trimmed)
    setLoading(true)
    setSearched(true)
    try {
      const locationParam = location ? `&lat=${location.lat}&lng=${location.lng}` : ''
      const res = await wanspotFetch(`/api/spots/search?q=${encodeURIComponent(trimmed)}${locationParam}`)
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        void wanspotFetch('/api/search/history', {
          method: 'POST',
          json: { userId: user.id, keyword: trimmed },
        }).catch(() => {})
      })
      const data = (await res.json()) as { spots?: PlaceResult[] }
      setResults(data.spots ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const sortedResults = useMemo(() => {
    const copy = [...results]
    copy.sort((a, b) => {
      if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortKey === 'distance' && location) {
        return (
          calcDistance(location.lat, location.lng, a.lat, a.lng) -
          calcDistance(location.lat, location.lng, b.lat, b.lng)
        )
      }
      return 0
    })
    return copy
  }, [results, sortKey, location])

  const currentSort = SORT_OPTIONS.find((o) => o.key === sortKey)!
  const discoverResults = discoverMode === 'ai' ? aiResults : hotResults
  const discoverLoading = discoverMode === 'ai' ? aiLoading : discoverMode === 'hot' ? hotLoading : articlesLoading

  const openSpot = (id: string) => {
    router.push(`/spots/${id}`)
  }

  const beforeNavSearch = async () => {
    await AsyncStorage.multiSet([
      [SEARCH_STORAGE_KEY, JSON.stringify({ query, results, sortKey, scroll: scrollYRef.current })],
      [SEARCH_RESTORE_FLAG, '1'],
    ])
  }

  const padBottom = TAB_BAR_HEIGHT + insets.bottom + 24

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: padBottom }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        refreshControl={
          !searched && discoverMode === 'hot' ? (
            <RefreshControl
              refreshing={hotLoading}
              onRefresh={() => void handleHot({ force: true })}
              tintColor={colors.textMuted}
              colors={[colors.text]}
            />
          ) : undefined
        }
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y
        }}
      >
        <View style={styles.searchHeader}>
          <View style={styles.searchRow}>
            <View style={styles.searchInner}>
              <IconSearch />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="スポット・エリア・キーワード"
                placeholderTextColor="#aaa"
                onSubmitEditing={() => void handleSearch(query)}
                returnKeyType="search"
              />
              {query ? (
                <Pressable
                  onPress={() => {
                    setQuery('')
                    setResults([])
                    setSearched(false)
                  }}
                >
                  <IconClose />
                </Pressable>
              ) : null}
              <Pressable style={styles.searchGo} onPress={() => void handleSearch(query)}>
                <Text style={styles.searchGoTxt}>検索</Text>
              </Pressable>
            </View>
            {searched ? (
              <View style={styles.sortWrap}>
                <Pressable style={styles.sortBtn} onPress={() => setShowSort(true)}>
                  <IconSort />
                  <Text style={styles.sortBtnTxt}>{currentSort.label}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {!searched ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8, opacity: suggestionsReady ? 1 : 0.6 }}
              >
                <View style={styles.sugRow}>
                  {suggestions.map((s) => (
                    <Pressable key={s} style={styles.sug} onPress={() => void handleSearch(s)}>
                      <Text style={styles.sugTxt}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.discoverTabs}>
                <Pressable
                  style={[styles.discTab, discoverMode === 'articles' && styles.discTabOn]}
                  onPress={() => setDiscoverMode('articles')}
                >
                  <IconBulb fill={discoverMode === 'articles' ? '#fff' : '#888'} />
                  <Text style={[styles.discTabTxt, discoverMode === 'articles' && styles.discTabTxtOn]}>まとめ記事</Text>
                </Pressable>
                <Pressable
                  style={[styles.discTab, discoverMode === 'ai' && styles.discTabOn]}
                  onPress={() => setDiscoverMode('ai')}
                >
                  <IconThumbUp fill={discoverMode === 'ai' ? '#fff' : '#888'} />
                  <Text style={[styles.discTabTxt, discoverMode === 'ai' && styles.discTabTxtOn]}>AIレコメンド</Text>
                </Pressable>
                <Pressable
                  style={[styles.discTab, discoverMode === 'hot' && styles.discTabOn]}
                  onPress={() => setDiscoverMode('hot')}
                >
                  <IconHot fill={discoverMode === 'hot' ? '#fff' : '#888'} />
                  <Text style={[styles.discTabTxt, discoverMode === 'hot' && styles.discTabTxtOn]}>トレンド</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.results}>
          {loading ? <RunningDog label="検索中..." /> : null}
          {!loading && searched && results.length === 0 ? <PowState label="見つかりませんでした" /> : null}
          {!loading &&
            searched &&
            sortedResults.map((spot) => (
              <SearchDiscoverResultCard
                key={spot.place_id}
                spot={spot}
                userLocation={location}
                onOpen={openSpot}
                onLikesChange={refreshSpotLikesCount}
                onBeforeNavigate={beforeNavSearch}
              />
            ))}

          {!searched ? (
            <>
              {discoverMode === 'articles' ? (
                <>
                  {articlesLoading ? <RunningDog label="記事を読み込み中..." /> : null}
                  {!articlesLoading && articlesList.length === 0 ? <PowState label="公開中の記事がありません" /> : null}
                  {!articlesLoading &&
                    articlesList.map((article) => (
                      <Pressable
                        key={article.id}
                        style={styles.artCard}
                        onPress={() => router.push(`/articles/${article.slug}`)}
                      >
                        {article.image_url ? (
                          <Image source={{ uri: article.image_url }} style={styles.artImg} resizeMode="cover" />
                        ) : (
                          <View style={[styles.artImg, styles.artImgPh]} />
                        )}
                        <View style={styles.artBody}>
                          {article.keywords?.length > 0 ? (
                            <View style={styles.kwRow}>
                              {article.keywords.slice(0, 3).map((k) => (
                                <View key={k} style={styles.kwPill}>
                                  <Text style={styles.kwPillTxt}>{k}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                          <Text style={styles.artTitle}>{article.title}</Text>
                          <Text style={styles.artSum} numberOfLines={3}>
                            {article.summary}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                </>
              ) : null}

              {discoverMode !== 'articles' ? (
                <>
                  {!discoverLoading && discoverMode === 'ai' && spotLikesCount === null ? (
                    <RunningDog label="読み込み中..." />
                  ) : null}
                  {!discoverLoading &&
                    !(discoverMode === 'ai' && spotLikesCount === null) &&
                    !(discoverMode === 'ai' && spotLikesCount !== null && spotLikesCount < AI_LIKES_MIN) ? (
                    <Text style={styles.discLabel}>
                      {discoverMode === 'ai' ? aiReason ?? 'あなたへのおすすめ' : hotLabel ?? '今話題のスポット'}
                    </Text>
                  ) : null}
                  {discoverLoading ? (
                    <RunningDog label={discoverMode === 'ai' ? 'AIが好みを分析中...' : 'トレンドを調査中...'} />
                  ) : null}
                  {!discoverLoading &&
                  discoverMode === 'ai' &&
                  spotLikesCount !== null &&
                  spotLikesCount < AI_LIKES_MIN ? (
                    <View style={styles.aiGate}>
                      <Text style={styles.aiGateTxt}>AIレコメンドはいいね5件以上で利用できます</Text>
                      <Text style={styles.aiGateSub}>気になるスポットにいいねしてみましょう</Text>
                    </View>
                  ) : null}
                  {!discoverLoading &&
                    !(discoverMode === 'ai' && spotLikesCount !== null && spotLikesCount < AI_LIKES_MIN) &&
                    discoverResults.map((spot) => (
                      <SearchDiscoverResultCard
                        key={spot.place_id}
                        spot={spot}
                        userLocation={location}
                        onOpen={openSpot}
                        onLikesChange={refreshSpotLikesCount}
                        onBeforeNavigate={async () => {
                          await AsyncStorage.setItem(SEARCH_RESTORE_FLAG, '1')
                        }}
                      />
                    ))}
                  {!loading &&
                    !searched &&
                    discoverResults.length === 0 &&
                    !discoverLoading &&
                    !(discoverMode === 'ai' && spotLikesCount === null) &&
                    !(discoverMode === 'ai' && spotLikesCount !== null && spotLikesCount < AI_LIKES_MIN) ? (
                      <PowState label="スポットを検索する" />
                    ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
        <Pressable style={styles.sortModalRoot} onPress={() => setShowSort(false)}>
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.sortItem, sortKey === opt.key && styles.sortItemOn]}
                onPress={() => {
                  setSortKey(opt.key)
                  setShowSort(false)
                }}
              >
                <Text style={[styles.sortItemTxt, sortKey === opt.key && styles.sortItemTxtOn]}>
                  {opt.label}
                  {sortKey === opt.key ? ' ✓' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  searchHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ebebeb', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  input: { flex: 1, fontSize: 12, color: '#1a1a1a', paddingVertical: 4 },
  searchGo: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFD84D' },
  searchGoTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  sortWrap: { position: 'relative' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#1a1a1a' },
  sortBtnTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  /** キーワードタグ行と（まとめ記事／AI／トレンド）の間の区切り */
  discoverTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  discTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  discTabOn: { backgroundColor: '#1a1a1a' },
  discTabTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  discTabTxtOn: { color: '#fff' },
  sugRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  sug: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8', marginRight: 8 },
  sugTxt: { fontSize: 12, color: '#888' },
  results: { padding: 16, gap: 12 },
  artCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', marginBottom: 12 },
  artImg: { width: '100%', aspectRatio: 16 / 9 },
  artImgPh: { backgroundColor: '#f5f5f5' },
  artBody: { padding: 16 },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kwPill: { backgroundColor: '#FFF9E0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  kwPillTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  artTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  artSum: { fontSize: 12, color: '#888', lineHeight: 18 },
  discLabel: { fontSize: 12, fontWeight: '800', color: '#aaa', marginBottom: 4 },
  aiGate: { alignItems: 'center', paddingVertical: 32 },
  aiGateTxt: { fontSize: 14, color: '#888' },
  aiGateSub: { fontSize: 12, color: '#aaa', marginTop: 8 },
  sortModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'flex-end', paddingTop: 100, paddingRight: 16 },
  sortMenu: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebebeb',
    minWidth: 140,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  sortItem: { paddingHorizontal: 16, paddingVertical: 12 },
  sortItemOn: { backgroundColor: '#FFF9E0' },
  sortItemTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  sortItemTxtOn: { color: '#1a1a1a' },
})
