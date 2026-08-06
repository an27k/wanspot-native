import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Image as ExpoImage } from 'expo-image'
import { useRouter } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import { DiscoverFeedCard } from '@/components/search/DiscoverFeedCard'
import { ArticleListRow } from '@/components/articles/ArticleListRow'
import { GoogleHomeBackground } from '@/components/search/GoogleHomeBackground'
import { BrandTabHeader } from '@/components/common/BrandTabHeader'
import { ArticleListSkeleton } from '@/components/common/ShimmerSkeleton'
import { ListEnterItem } from '@/components/common/ListEnterItem'
import { PowState } from '@/components/DogStates'
import { ListAdSlot } from '@/components/ads/ListAdSlot'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { type } from '@/constants/typography'
import { useScrollYReport } from '@/hooks/useScrollYReport'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { shouldInjectListAd } from '@/lib/ads/list-injection'
import { isAdsMobileSdkInitialized, prepareSearchTabAdsOnce } from '@/lib/prepare-search-ads'
import { personalizeArticlesFeed } from '@/lib/article-feed-ranking'
import {
  ARTICLE_GENRE_CHIPS,
  eventRoundupMonthKey,
  parseArticleTheme,
  type ArticleGenreKey,
} from '@/lib/articles/article-theme'
import {
  CACHE_TTL,
  fetchWithCache,
  geoBucket,
  invalidateCache,
  isCacheFresh,
  readCache,
} from '@/lib/client-cache'
import { fetchUserWalkAreaTagsByUserId } from '@/lib/fetch-user-walk-area-tags'
import { getCachedPrefectureAndMunicipality } from '@/lib/geo-cache'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'
import { remoteImageAcceptHeaders } from '@/lib/images/remoteImageDefaults'
import { resolveSessionLocation } from '@/lib/location-session'
import { perfAsync } from '@/lib/perf/marks'
import { track } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'
import { wanspotFetch } from '@/lib/wanspot-api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** 旧検索ホームの記事フィードを独立タブ化したもの（キャッシュキーは旧版と共有して移行コストゼロに） */
const ARTICLES_CACHE_KEY = 'search:articles:v5:linked-spot-refs'
const LIST_VISIBLE_STEP = 12
/** 一覧の取得上限。重い JSON 列は取らないため、公開本数に対して余裕を持たせる */
const ARTICLES_FETCH_LIMIT = 200

type ArticleRow = {
  id: string
  title: string
  summary: string
  slug: string
  category: string
  theme?: string | null
  keywords: string[]
  image_url: string | null
  created_at: string
  published_at?: string | null
  target_prefectures?: string[] | null
  target_municipalities?: string[] | null
  target_walk_area_tags?: string[] | null
  dog_size_tags?: string[] | null
  topic_tags?: string[] | null
  segment_level?: 'municipality' | 'walk_area' | 'prefecture' | 'region' | 'national' | null
  linked_spot_refs?: string[] | null
}

export function ArticlesTabScreen() {
  const router = useRouter()
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()

  const [articlesRaw, setArticlesRaw] = useState<ArticleRow[]>([])
  const [articlesList, setArticlesList] = useState<ArticleRow[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articlesFetchError, setArticlesFetchError] = useState(false)
  const [articlesListEnter, setArticlesListEnter] = useState(true)
  const [visibleCount, setVisibleCount] = useState(LIST_VISIBLE_STEP)
  /** カテゴリチップの選択（null = すべて）。theme から導出したジャンルで絞る */
  const [selectedGenre, setSelectedGenre] = useState<ArticleGenreKey | null>(null)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [recentArticleIds, setRecentArticleIds] = useState<string[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [userWalkTags, setUserWalkTags] = useState<string[]>([])
  const [adsRuntimeReady, setAdsRuntimeReady] = useState(false)
  const adsPrimedRef = useRef(false)
  /** theme 解析つきの表示リスト（並びはパーソナライズ済みの articlesList を維持） */
  const themedList = useMemo(
    () => articlesList.map((article) => ({ article, info: parseArticleTheme(article.theme) })),
    [articlesList]
  )
  /** 記事が存在するジャンルだけをチップに出す */
  const availableChips = useMemo(() => {
    const present = new Set(themedList.map((t) => t.info.genre).filter(Boolean))
    return ARTICLE_GENRE_CHIPS.filter((c) => present.has(c.key))
  }, [themedList])
  const filteredList = useMemo(() => {
    const list = selectedGenre ? themedList.filter((t) => t.info.genre === selectedGenre) : themedList
    // イベントまとめは位置より「何月分か」。早い月を先に出す
    if (selectedGenre !== 'event') return list
    return [...list].sort((a, b) => {
      const am = eventRoundupMonthKey(a.article) ?? '9999-99'
      const bm = eventRoundupMonthKey(b.article) ?? '9999-99'
      if (am !== bm) return am.localeCompare(bm)
      return a.article.title.localeCompare(b.article.title, 'ja')
    })
  }, [themedList, selectedGenre])

  const listLenRef = useRef(0)
  listLenRef.current = filteredList.length

  /** 表示件数の追加はスクロール位置から判定する。contentSize / viewport は別途保持する */
  const contentHeightRef = useRef(0)
  const viewportHeightRef = useRef(0)

  const handleSelectGenre = useCallback((key: ArticleGenreKey | null) => {
    setSelectedGenre(key)
    setVisibleCount(LIST_VISIBLE_STEP)
  }, [])

  const handleScrollY = useCallback((y: number) => {
    const content = contentHeightRef.current
    const viewport = viewportHeightRef.current
    if (content <= 0 || viewport <= 0) return
    if (y + viewport < content - 600) return
    setVisibleCount((c) => (c >= listLenRef.current ? c : Math.min(c + LIST_VISIBLE_STEP, listLenRef.current)))
  }, [])

  // reanimated のワークレットハンドラ。Animated.ScrollView の onScroll に直接渡すこと
  // （プレーンな ScrollView で手動呼び出しすると動作せず、ページングも止まる）
  const scrollHandler = useScrollYReport(handleScrollY)

  // 位置情報（並べ替え用・許可済みセッション位置のみ。ここでは新規の許可要求はしない）
  useEffect(() => {
    void (async () => {
      const result = await resolveSessionLocation(null)
      if (result.ok) setLocation(result.location)
    })()
  }, [])

  // 散歩エリアタグ（パーソナライズ用）
  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      try {
        const tags = await fetchUserWalkAreaTagsByUserId(supabase, user.id)
        setUserWalkTags(tags)
      } catch {
        /* パーソナライズ無しで表示継続 */
      }
    })()
  }, [])

  // 広告SDKの遅延初期化（旧検索ホームと同じ安全側の流儀）
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        if (!adsEnabledForDevice()) return
        if (isAdsMobileSdkInitialized() || adsPrimedRef.current) {
          adsPrimedRef.current = true
          if (!cancelled) setAdsRuntimeReady(true)
          return
        }
        await new Promise((r) => setTimeout(r, 300))
        if (cancelled) return
        await prepareSearchTabAdsOnce()
        adsPrimedRef.current = true
        if (!cancelled) setAdsRuntimeReady(true)
      } catch (e) {
        console.warn(`prepareArticlesTabAds failed: ${String((e as unknown) ?? '')}`)
        if (!cancelled) setAdsRuntimeReady(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const loadArticles = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true
      if (articlesLoading) return
      if (!force && articlesRaw.length > 0) return

      const cachedRows = readCache<ArticleRow[]>(ARTICLES_CACHE_KEY)
      if (!force && cachedRows && cachedRows.length > 0 && articlesRaw.length === 0) {
        setArticlesRaw(cachedRows)
      }

      const cacheWarm = !force && isCacheFresh(ARTICLES_CACHE_KEY, CACHE_TTL.ARTICLES_MS)
      if (!cacheWarm) setArticlesLoading(true)
      setArticlesFetchError(false)
      try {
        if (force) invalidateCache(ARTICLES_CACHE_KEY)
        const { data: rows, fromCache } = await perfAsync('api:articles', () =>
          fetchWithCache(
            ARTICLES_CACHE_KEY,
            CACHE_TTL.ARTICLES_MS,
            async () => {
              // articles を直読みしていた。anon キーはバンドルに平文で入っており
              // 実質公開情報なので、記事メタ110件が全件取得できる状態だった。
              // blocks / spot_links の重い JSON はAPI側でも返していない
              const res = await wanspotFetch(`/api/articles?limit=${ARTICLES_FETCH_LIMIT}`, { auth: false })
              // error を握り潰すと「取得失敗＝記事0件」が10分キャッシュされ、
              // 圏外で一度開いただけで復帰後も空表示のままになる
              if (!res.ok) throw new Error(`articles ${res.status}`)
              const json = (await res.json()) as { articles?: ArticleRow[] }
              return (json.articles ?? []) as ArticleRow[]
            },
            { force }
          )
        )

        setArticlesRaw(rows)
        if (!fromCache) {
          const urls = rows
            .map((a) => a.image_url)
            .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            .map((u) => resizePlacesImageUrl(u.trim(), 'thumbnail'))
          if (urls.length > 0)
            void ExpoImage.prefetch(urls.slice(0, 8), {
              cachePolicy: 'memory-disk',
              headers: remoteImageAcceptHeaders,
            })
        }
      } catch {
        setArticlesFetchError(true)
      } finally {
        setArticlesLoading(false)
      }
    },
    [articlesLoading, articlesRaw.length]
  )

  useEffect(() => {
    void loadArticles()
  }, [loadArticles])

  /** 取得済み記事を現在地・登録エリア・行動履歴で並べ替え（旧検索ホームと同じ） */
  useEffect(() => {
    if (articlesRaw.length === 0) {
      setArticlesList([])
      return
    }

    // 並べ替え（複数DBクエリ）を待たず、まず公開順で即表示して empty 表示を防ぐ
    setArticlesList((prev) => (prev.length > 0 ? prev : articlesRaw))

    let cancelled = false
    const rankKey = `articleRank:${articlesRaw.map((a) => a.id).join(',')}:${
      location ? geoBucket(location.lat, location.lng, 2) : 'noloc'
    }:${[...userWalkTags].sort().join(',')}:${[...recentArticleIds].sort().join(',')}`
    void (async () => {
      try {
        const { data: sorted } = await fetchWithCache(rankKey, 60_000, async () => {
          const geo =
            location != null
              ? await getCachedPrefectureAndMunicipality(location.lat, location.lng)
              : { prefecture: null as string | null, municipality: null as string | null }

          return personalizeArticlesFeed(supabase, articlesRaw, {
            userLocation: location,
            userPrefecture: geo.prefecture,
            userMunicipality: geo.municipality,
            walkAreaTags: userWalkTags,
            recentArticleIds,
          })
        })

        if (!cancelled) setArticlesList(sorted)
      } catch {
        if (!cancelled) setArticlesList(articlesRaw)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [articlesRaw, location, userWalkTags, recentArticleIds])

  useEffect(() => {
    if (!articlesLoading && articlesList.length > 0 && articlesListEnter) {
      const t = setTimeout(() => setArticlesListEnter(false), 900)
      return () => clearTimeout(t)
    }
  }, [articlesLoading, articlesList.length, articlesListEnter])

  const handleRefresh = useCallback(async () => {
    setPullRefreshing(true)
    try {
      await loadArticles({ force: true })
    } finally {
      setPullRefreshing(false)
    }
  }, [loadArticles])

  return (
    <GoogleHomeBackground>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h
        }}
        onLayout={(e) => {
          viewportHeightRef.current = e.nativeEvent.layout.height
        }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: GOOGLE_HOME.padH,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={() => void handleRefresh()} tintColor="#fff" />
        }
      >
        <BrandTabHeader />

        {articlesLoading && articlesRaw.length === 0 ? (
          <>
            <ArticleListSkeleton variant="dark" />
            <ArticleListSkeleton variant="dark" />
            <ArticleListSkeleton variant="dark" />
          </>
        ) : null}
        {articlesFetchError && !articlesLoading && articlesRaw.length === 0 ? (
          <PowState label="記事の読み込みに失敗しました" />
        ) : null}
        {!articlesLoading && !articlesFetchError && articlesRaw.length === 0 ? (
          <PowState label="公開中の記事がありません" />
        ) : null}

        {availableChips.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              style={[styles.chip, selectedGenre === null && styles.chipOn]}
              onPress={() => handleSelectGenre(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedGenre === null }}
            >
              <Text style={[styles.chipTxt, selectedGenre === null && styles.chipTxtOn]}>すべて</Text>
            </Pressable>
            {availableChips.map((c) => {
              const on = selectedGenre === c.key
              return (
                <Pressable
                  key={c.key}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => handleSelectGenre(on ? null : c.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c.label}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        {!articlesLoading && filteredList.length === 0 && articlesRaw.length > 0 ? (
          <PowState label="このカテゴリの記事はまだありません" />
        ) : null}

        {filteredList.slice(0, visibleCount).map(({ article, info }, index) => {
          const openArticle = () => {
            track('article_clicked', { article_id: article.id })
            setRecentArticleIds((prev) => {
              if (prev.includes(article.id)) return prev
              return [article.id, ...prev].slice(0, 40)
            })
            router.push(`/articles/${article.slug}`)
          }
          return (
            <ListEnterItem key={article.id} index={index} animate={articlesListEnter}>
              <View>
                {index === 0 ? (
                  // 先頭はヒーローカード（ブロック型）。以降はリスト型で一覧性を上げる
                  <DiscoverFeedCard
                    title={article.title}
                    summary={article.summary}
                    imageUrl={article.image_url}
                    keywords={[info.area, info.genreLabel].filter(Boolean) as string[]}
                    recyclingKey={`article-hero-${article.id}`}
                    onPress={openArticle}
                  />
                ) : (
                  <ArticleListRow
                    title={article.title}
                    area={info.area}
                    genreLabel={info.genreLabel}
                    imageUrl={article.image_url}
                    recyclingKey={`article-list-${article.id}`}
                    onPress={openArticle}
                  />
                )}
                {isFocused && shouldInjectListAd(index, filteredList.length) ? (
                  <ListAdSlot adsReady={adsRuntimeReady} />
                ) : null}
              </View>
            </ListEnterItem>
          )
        })}
      </Animated.ScrollView>
    </GoogleHomeBackground>
  )
}

const styles = StyleSheet.create({
  chipScroll: { marginBottom: 14, flexGrow: 0 },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chipOn: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(255,255,255,0.92)' },
  // 絞り込みチップ。地図の MapFilterBar と同じ label で揃える
  chipTxt: { ...type.label, color: GOOGLE_HOME.textSecondary },
  chipTxtOn: { color: '#2A2522', fontWeight: '800' },
})
