import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as ExpoImage } from 'expo-image'
import {
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { ArticleRemoteImage } from '@/components/articles/ArticleRemoteImage'
import { AppHeader } from '@/components/AppHeader'
import { IconAiPlan } from '@/components/common/IconAiPlan'
import { AdNativeCard } from '@/components/AdNativeCard'
import { AiPlanTab } from '@/components/ai-plan/AiPlanTab'
import { SearchDiscoverResultCard } from '@/components/search/SearchDiscoverResultCard'
import { PowState, RunningDog } from '@/components/DogStates'
import { PostOnboardingTutorialModal } from '@/components/onboarding/PostOnboardingTutorialModal'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'
import { rankSpotsByWalkContext } from '@/lib/discover-spot-ranking'
import { sortArticlesByScore } from '@/lib/articles/scoring'
import { CACHE_TTL, fetchWithCache, geoBucket, invalidateCache, isCacheFresh } from '@/lib/client-cache'
import { getCachedPrefecture, getCachedPrefectureAndMunicipality } from '@/lib/geo-cache'
import { fetchUserWalkAreaTagsByUserId } from '@/lib/fetch-user-walk-area-tags'
import { resolveSessionLocation } from '@/lib/location-session'
import { filterDiscoverRecommendSpots } from '@/lib/hot-exclusions'
import { track } from '@/lib/analytics'
import { POST_ONBOARDING_TUTORIAL_KEY } from '@/lib/onboarding-constants'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { isAdsMobileSdkInitialized, prepareSearchTabAdsOnce } from '@/lib/prepare-search-ads'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'
import { wanspotFetch, wanspotFetchJson } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

const SEARCH_STORAGE_KEY = 'search_state_v1'
const SEARCH_RESTORE_FLAG = 'search_pending_restore'

type SortKey = 'default' | 'rating' | 'distance'
type DiscoverMode = 'ai' | 'articles' | 'ai_plan'

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

const ARTICLES_CACHE_KEY = 'search:articles:v1'

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
// (trend feature removed)

type ArticleRow = {
  id: string
  title: string
  summary: string
  slug: string
  category: string
  keywords: string[]
  image_url: string | null
  created_at: string
  published_at?: string | null
}

export default function SearchTab() {
  const router = useRouter()
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>('articles')
  /** AIプランの結果表示中は検索ヘッダー/タブを隠して全画面に */
  const [aiPlanChromeVisible, setAiPlanChromeVisible] = useState(true)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('default')
  const [showSort, setShowSort] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS)
  const [suggestionsReady, setSuggestionsReady] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiLabel, setAiLabel] = useState<string | null>(null)
  const [aiReason, setAiReason] = useState<string | null>(null)
  const [aiResults, setAiResults] = useState<PlaceResult[]>([])
  const [articlesList, setArticlesList] = useState<ArticleRow[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [spotLikesCount, setSpotLikesCount] = useState<number | null>(null)
  const restoredRef = useRef(false)
  const scrollYRef = useRef(0)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [userWalkTags, setUserWalkTags] = useState<string[]>([])
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [recentArticleIds, setRecentArticleIds] = useState<string[]>([])
  const [adsRuntimeReady, setAdsRuntimeReady] = useState(false)
  const adsPrimedRef = useRef(false)
  /** AIプラン表示時、検索ヘッダーの高さぶん下げてオーバーレイ配置する */
  const [headerH, setHeaderH] = useState(0)
  const [showObTutorial, setShowObTutorial] = useState(false)
  const [obTutorialDogName, setObTutorialDogName] = useState('')

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const v = await AsyncStorage.getItem(POST_ONBOARDING_TUTORIAL_KEY)
          if (v !== '1') return
          setShowObTutorial(true)
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user) {
            setObTutorialDogName('')
            return
          }
          const { data: dogRow } = await supabase
            .from('dogs')
            .select('name')
            .eq('user_id', user.id)
            .maybeSingle()
          const n = typeof dogRow?.name === 'string' ? dogRow.name.trim() : ''
          setObTutorialDogName(n)
        } catch {
          /* ignore */
        }
      })()
    }, [])
  )

  const dismissObTutorial = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(POST_ONBOARDING_TUTORIAL_KEY)
    } catch {
      /* ignore */
    }
    setShowObTutorial(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      const run = async () => {
        try {
          if (!adsEnabledForDevice()) {
            if (!cancelled) setAdsRuntimeReady(false)
            return
          }
          // 他タブで既に初期化済みなら待たずに ready（クリーンアップで false にしない）
          if (isAdsMobileSdkInitialized()) {
            adsPrimedRef.current = true
            if (!cancelled) setAdsRuntimeReady(true)
            return
          }
          if (adsPrimedRef.current) {
            if (!cancelled) setAdsRuntimeReady(true)
            return
          }
          await new Promise((r) => setTimeout(r, 300))
          if (cancelled) return
          await prepareSearchTabAdsOnce()
          adsPrimedRef.current = true
          if (!cancelled) setAdsRuntimeReady(true)
        } catch (e) {
          console.warn(`prepareSearchTabAds failed: ${String((e as unknown) ?? '')}`)
          // 初期化失敗時に Banner をマウントすると Hermes/ブリッジの不安定要因になり得るため、
          // 失敗時は adsReady=false のままにして安全側に倒す。
          if (!cancelled) setAdsRuntimeReady(false)
        }
      }

      void run()

      return () => {
        cancelled = true
      }
    }, [])
  )

  useEffect(() => {
    void (async () => {
      const result = await resolveSessionLocation(null)
      if (result.ok) setLocation(result.location)
    })()
  }, [])

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setUserWalkTags([])
          return
        }
        const { data: tags } = await fetchWithCache(
          `user:walk-tags:${user.id}`,
          CACHE_TTL.WALK_TAGS_MS,
          () => fetchUserWalkAreaTagsByUserId(supabase, user.id)
        )
        setUserWalkTags(tags)
      })()
    }, [])
  )

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false))
    return () => {
      show.remove()
      hide.remove()
    }
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
      const { data: count } = await fetchWithCache(
        `user:spot-likes-count:${user.id}`,
        CACHE_TTL.SPOT_LIKES_MS,
        async () => {
          const { count: n, error } = await supabase
            .from('spot_likes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
          return error ? 0 : (n ?? 0)
        }
      )
      if (!cancelled) setSpotLikesCount(count)
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
        const geoKey = location ? geoBucket(location.lat, location.lng) : 'none'
        const cacheKey = `search:suggest-tags:${user?.id ?? 'anon'}:${geoKey}`
        const { data: tags } = await fetchWithCache(cacheKey, CACHE_TTL.SUGGEST_TAGS_MS, async () => {
          const prefecture = location ? await getCachedPrefecture(location.lat, location.lng) : undefined
          const res = await wanspotFetch('/api/spots/suggest-tags', {
            method: 'POST',
            json: {
              userId: user?.id ?? null,
              lat: location?.lat,
              lng: location?.lng,
              prefecture,
            },
          })
          if (!res.ok) return null
          const data = (await res.json()) as { tags?: string[] }
          return Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : null
        })
        if (!cancelled && tags) {
          setSuggestions(tags)
          setSuggestionsReady(true)
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
    invalidateCache(`user:spot-likes-count:${user.id}`)
    const { data: count } = await fetchWithCache(
      `user:spot-likes-count:${user.id}`,
      CACHE_TTL.SPOT_LIKES_MS,
      async () => {
        const { count: n, error } = await supabase
          .from('spot_likes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        return error ? 0 : (n ?? 0)
      },
      { force: true }
    )
    setSpotLikesCount(count)
  }, [])

  const handleAiRecommend = useCallback(async (opts?: { force?: boolean; locationOverride?: { lat: number; lng: number } | null }) => {
    const force = opts?.force === true
    const loc = opts?.locationOverride !== undefined ? opts.locationOverride : location
    if (aiLoading) return
    if (!force && aiResults.length > 0) return
    setAiLoading(true)
    if (force) {
      setAiResults([])
      setAiLabel(null)
      setAiReason(null)
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAiLoading(false)
        return
      }
      const n = spotLikesCount ?? 0
      if (n < AI_LIKES_MIN) {
        setAiLoading(false)
        return
      }
      const geoKey = loc ? geoBucket(loc.lat, loc.lng) : 'none'
      const cacheKey = `search:recommend:${user.id}:${geoKey}`
      if (force) invalidateCache(cacheKey)
      const { data: result } = await fetchWithCache(
        cacheKey,
        CACHE_TTL.RECOMMEND_MS,
        async () => {
          const prefecture = loc ? await getCachedPrefecture(loc.lat, loc.lng) : undefined
          return wanspotFetchJson<{
            spots?: PlaceResult[]
            label?: string
            reason?: string
          }>('/api/spots/recommend', {
            method: 'POST',
            json: {
              userId: user.id,
              lat: loc?.lat,
              lng: loc?.lng,
              walkAreaTags: userWalkTags,
              prefecture,
            },
          })
        },
        { force }
      )
      setAiLabel(result.label ?? null)
      setAiReason(result.reason ?? null)
      setAiResults(filterDiscoverRecommendSpots(result.spots ?? []))
    } catch {
      setAiResults([])
      setAiLabel(null)
      setAiReason(null)
    } finally {
      setAiLoading(false)
    }
  }, [aiLoading, aiResults.length, location, spotLikesCount, userWalkTags])

  const handleArticles = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true
      if (articlesLoading) return
      if (!force && articlesList.length > 0) return
      const cacheWarm = !force && isCacheFresh(ARTICLES_CACHE_KEY, CACHE_TTL.ARTICLES_MS)
      if (!cacheWarm) setArticlesLoading(true)
      try {
        if (force) invalidateCache(ARTICLES_CACHE_KEY)
        const { data: rows, fromCache } = await fetchWithCache(
          ARTICLES_CACHE_KEY,
          CACHE_TTL.ARTICLES_MS,
          async () => {
            const { data } = await supabase
              .from('articles')
              .select('id, title, summary, slug, category, keywords, image_url, created_at, published_at')
              .eq('status', 'published')
              .order('published_at', { ascending: false, nullsFirst: false })
            return (data ?? []) as ArticleRow[]
          },
          { force }
        )

        const geo =
          location != null
            ? await getCachedPrefectureAndMunicipality(location.lat, location.lng)
            : { prefecture: null as string | null, municipality: null as string | null }

        const sorted = sortArticlesByScore(
          rows.map((r) => ({
            ...r,
            title: r.title ?? null,
            keywords: r.keywords ?? null,
            theme: null,
            category: r.category ?? null,
            summary: r.summary ?? null,
            published_at: r.published_at ?? null,
          })),
          {
            userPrefecture: geo.prefecture,
            userMunicipality: geo.municipality,
            userId: null,
            likedArticleIds: [],
            readArticleIds: recentArticleIds,
          }
        )

        setArticlesList(sorted)
        if (!fromCache) {
          const urls = sorted
            .map((a) => a.image_url)
            .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            .map((u) => resizePlacesImageUrl(u.trim(), 'card'))
          if (urls.length > 0) void ExpoImage.prefetch(urls.slice(0, 12), 'memory-disk')
        }
      } catch {
        setArticlesList([])
      } finally {
        setArticlesLoading(false)
      }
    },
    [articlesLoading, articlesList.length, location, recentArticleIds]
  )

  useEffect(() => {
    if (searched) return
    if (discoverMode === 'articles') void handleArticles()
  }, [discoverMode, searched, handleArticles])

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

  const handleSearch = useCallback(async (q: string, opts?: { silent?: boolean }) => {
    Keyboard.dismiss()
    const trimmed = q.trim()
    if (!trimmed) return
    const silent = opts?.silent === true
    setQuery(trimmed)
    if (!silent) setLoading(true)
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
      if (!silent) setLoading(false)
    }
  }, [location])

  const onPullRefreshSearch = useCallback(async () => {
    setPullRefreshing(true)
    try {
      await refreshSpotLikesCount()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        invalidateCache(`user:walk-tags:${user.id}`)
        const { data: tags } = await fetchWithCache(
          `user:walk-tags:${user.id}`,
          CACHE_TTL.WALK_TAGS_MS,
          () => fetchUserWalkAreaTagsByUserId(supabase, user.id),
          { force: true }
        )
        setUserWalkTags(tags)
      }
      let locFresh: { lat: number; lng: number } | null = location
      const locResult = await resolveSessionLocation(location)
      if (locResult.ok) {
        locFresh = locResult.location
        if (locResult.changed) setLocation(locFresh)
      }
      if (searched && query.trim()) {
        await handleSearch(query, { silent: true })
      } else if (discoverMode === 'articles') {
        await handleArticles({ force: true })
      } else {
        await handleAiRecommend({ force: true, locationOverride: locFresh })
      }
    } finally {
      setPullRefreshing(false)
    }
  }, [
    searched,
    query,
    discoverMode,
    location,
    refreshSpotLikesCount,
    handleSearch,
    handleArticles,
    handleAiRecommend,
  ])

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
  /** 取得済み結果に対し、タグ・現在地で再ランク（fetch 内でも適用済みだが、タブ復帰後のタグ更新に追従） */
  const discoverResults = useMemo(() => {
    const raw = aiResults
    return rankSpotsByWalkContext(raw, location, userWalkTags)
  }, [aiResults, location, userWalkTags])
  const discoverLoading = discoverMode === 'ai' ? aiLoading : articlesLoading

  const AD_ROW_EVERY = 5
  const shouldShowAdAfter = (index: number, total: number) =>
    (index + 1) % AD_ROW_EVERY === 0 || (index + 1 === total && total < AD_ROW_EVERY)

  const openSpot = (id: string) => {
    router.push(`/spots/${id}`)
  }

  const beforeNavSearch = async () => {
    await AsyncStorage.setMany({
      [SEARCH_STORAGE_KEY]: JSON.stringify({ query, results, sortKey, scroll: scrollYRef.current }),
      [SEARCH_RESTORE_FLAG]: '1',
    })
  }

  /** 「AIプラン」チップ選択時は AiPlanTab を全画面オーバーレイで表示（挙動は従来のまま） */
  const showAiPlan = !searched && discoverMode === 'ai_plan'

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        scrollEnabled={!showAiPlan}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y
        }}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={onPullRefreshSearch}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* ヘッダーはコンテンツと一緒に上へ流れる（固定しない） */}
        <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        <AppHeader />
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
                blurOnSubmit
              />
              {query ? (
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss()
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
                <Pressable
                  style={styles.sortBtn}
                  onPress={() => {
                    Keyboard.dismiss()
                    setShowSort(true)
                  }}
                >
                  <IconSort />
                  <Text style={styles.sortBtnTxt}>{currentSort.label}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {keyboardOpen ? (
            <Pressable style={styles.kbDismissBar} onPress={() => Keyboard.dismiss()} hitSlop={8}>
              <Text style={styles.kbDismissTxt}>キーボードを閉じる</Text>
            </Pressable>
          ) : null}

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
                  onPress={() => {
                    Keyboard.dismiss()
                    setDiscoverMode('articles')
                  }}
                >
                  <IconBulb fill={discoverMode === 'articles' ? '#fff' : '#888'} />
                  <Text style={[styles.discTabTxt, discoverMode === 'articles' && styles.discTabTxtOn]}>ワンスポまとめ</Text>
                </Pressable>
                <Pressable
                  style={[styles.discTab, discoverMode === 'ai_plan' && styles.discTabOn]}
                  onPress={() => {
                    Keyboard.dismiss()
                    setDiscoverMode('ai_plan')
                  }}
                >
                  <IconAiPlan fill={discoverMode === 'ai_plan' ? '#fff' : '#888'} />
                  <Text style={[styles.discTabTxt, discoverMode === 'ai_plan' && styles.discTabTxtOn]}>AIプラン</Text>
                </Pressable>
                <Pressable
                  style={[styles.discTab, discoverMode === 'ai' && styles.discTabOn]}
                  onPress={() => {
                    Keyboard.dismiss()
                    setDiscoverMode('ai')
                  }}
                >
                  <IconThumbUp fill={discoverMode === 'ai' ? '#fff' : '#888'} />
                  <Text style={[styles.discTabTxt, discoverMode === 'ai' && styles.discTabTxtOn]}>AIレコメンド</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
        </View>

        {!showAiPlan ? (
        <View style={styles.results}>
          {loading ? <RunningDog label="検索中..." /> : null}
          {!loading && searched && results.length === 0 ? <PowState label="見つかりませんでした" /> : null}
          {!loading &&
            searched &&
            sortedResults.map((spot, index) => (
              <View key={spot.place_id}>
                <SearchDiscoverResultCard
                  spot={spot}
                  userLocation={location}
                  userWalkTags={userWalkTags}
                  onOpen={openSpot}
                  onLikesChange={refreshSpotLikesCount}
                  onBeforeNavigate={beforeNavSearch}
                />
                {isFocused && shouldShowAdAfter(index, sortedResults.length) ? (
                  <AdNativeCard adsReady={adsRuntimeReady} />
                ) : null}
              </View>
            ))}

          {!searched ? (
            <>
              {discoverMode === 'articles' ? (
                <>
                  {articlesLoading ? <RunningDog label="記事を読み込み中..." /> : null}
                  {!articlesLoading && articlesList.length === 0 ? <PowState label="公開中の記事がありません" /> : null}
                  {!articlesLoading &&
                    articlesList.map((article, index) => (
                      <View key={article.id}>
                        <Pressable
                          style={styles.artCard}
                          onPress={() => {
                            track('article_clicked', { article_id: article.id })
                            setRecentArticleIds((prev) => {
                              if (prev.includes(article.id)) return prev
                              return [article.id, ...prev].slice(0, 40)
                            })
                            router.push(`/articles/${article.slug}`)
                          }}
                        >
                          {article.image_url ? (
                            <ArticleRemoteImage
                              uri={resizePlacesImageUrl(article.image_url, 'card')}
                              style={styles.artImg}
                              recyclingKey={`article-list-${article.id}`}
                              priority="normal"
                            />
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
                        {isFocused && shouldShowAdAfter(index, articlesList.length) ? (
                          <AdNativeCard adsReady={adsRuntimeReady} />
                        ) : null}
                      </View>
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
                    <View style={{ marginBottom: 4 }}>
                      <Text style={styles.discLabel}>
                        {discoverMode === 'ai' ? aiLabel ?? aiReason ?? 'あなたへのおすすめ' : ''}
                      </Text>
                      {discoverMode === 'ai' && aiLabel && aiReason && aiReason.trim() !== aiLabel.trim() ? (
                        <Text style={styles.discSub}>{aiReason}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  {discoverLoading ? (
                    <RunningDog label={discoverMode === 'ai' ? 'おすすめを読み込み中...' : '読み込み中...'} />
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
                    discoverResults.map((spot, index) => (
                      <View key={spot.place_id}>
                        <SearchDiscoverResultCard
                          spot={spot}
                          userLocation={location}
                          userWalkTags={userWalkTags}
                          onOpen={openSpot}
                          onLikesChange={refreshSpotLikesCount}
                          onBeforeNavigate={async () => {
                            await AsyncStorage.setItem(SEARCH_RESTORE_FLAG, '1')
                          }}
                        />
                        {isFocused && shouldShowAdAfter(index, discoverResults.length) ? (
                          <AdNativeCard adsReady={adsRuntimeReady} />
                        ) : null}
                      </View>
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
        ) : null}
      </ScrollView>

      {showAiPlan ? (
        <View style={[styles.aiPlanOverlay, { top: aiPlanChromeVisible ? headerH : 0 }]}>
          <AiPlanTab onEmbeddedChromeVisibility={setAiPlanChromeVisible} />
        </View>
      ) : null}

      <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
        <Pressable
          style={styles.sortModalRoot}
          onPress={() => {
            Keyboard.dismiss()
            setShowSort(false)
          }}
        >
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.sortItem, sortKey === opt.key && styles.sortItemOn]}
                onPress={() => {
                  Keyboard.dismiss()
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

      <PostOnboardingTutorialModal
        visible={showObTutorial}
        dogName={obTutorialDogName}
        onDismiss={() => void dismissObTutorial()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  scrollContent: { paddingBottom: 24 },
  aiPlanOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f7f6f3',
  },
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
  input: { flex: 1, fontSize: 12, color: '#2b2a28', paddingVertical: 4 },
  searchGo: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FF8A1F' },
  searchGoTxt: { fontSize: 12, fontWeight: '800', color: '#2b2a28' },
  kbDismissBar: {
    alignSelf: 'center',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  kbDismissTxt: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  sortWrap: { position: 'relative' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#2b2a28' },
  sortBtnTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  /** キーワードタグ行と（まとめ記事／AI）の間の区切り */
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
  discTabOn: { backgroundColor: '#2b2a28' },
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
  kwPill: { backgroundColor: '#FFF1E3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  kwPillTxt: { fontSize: 12, fontWeight: '800', color: '#2b2a28' },
  artTitle: { fontSize: 16, fontWeight: '800', color: '#2b2a28', marginBottom: 8 },
  artSum: { fontSize: 12, color: '#888', lineHeight: 18 },
  discLabel: { fontSize: 12, fontWeight: '800', color: '#aaa', marginBottom: 4 },
  discSub: { fontSize: 11, fontWeight: '500', color: '#888', marginTop: 2, marginBottom: 2 },
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
  sortItemOn: { backgroundColor: '#FFF1E3' },
  sortItemTxt: { fontSize: 12, fontWeight: '800', color: '#888' },
  sortItemTxtOn: { color: '#2b2a28' },
})
