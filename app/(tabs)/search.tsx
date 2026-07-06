import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as ExpoImage } from 'expo-image'
import {
  InteractionManager,
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
import Animated from 'react-native-reanimated'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { DiscoverFeedCard } from '@/components/search/DiscoverFeedCard'
import { GoogleHomeBackground } from '@/components/search/GoogleHomeBackground'
import { SearchHomeHeader } from '@/components/search/SearchHomeHeader'
import { IconAiPlan } from '@/components/common/IconAiPlan'
import { ListEnterItem } from '@/components/common/ListEnterItem'
import { ArticleListSkeleton, SearchResultSkeleton } from '@/components/common/ShimmerSkeleton'
import { PressableScale } from '@/components/common/PressableScale'
import { AdNativeCard } from '@/components/AdNativeCard'
import { AiPlanTab } from '@/components/ai-plan/AiPlanTab'
import { GlassSearchShell } from '@/components/search/GlassSearchShell'
import { LikesShortcutCard } from '@/components/search/LikesShortcutCard'
import { WalkAlertCard } from '@/components/search/WalkAlertCard'
import { SearchDiscoverResultCard } from '@/components/search/SearchDiscoverResultCard'
import { PowState, RunningDog } from '@/components/DogStates'
import { PostOnboardingTutorialModal } from '@/components/onboarding/PostOnboardingTutorialModal'
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary'
import { colors } from '@/constants/colors'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { useTabBarScroll } from '@/hooks/useTabBarScroll'
import { supabase } from '@/lib/supabase'
import { rankSpotsByWalkContext } from '@/lib/discover-spot-ranking'
import { personalizeArticlesFeed } from '@/lib/article-feed-ranking'
import { CACHE_TTL, fetchWithCache, geoBucket, invalidateCache, isCacheFresh, readCache } from '@/lib/client-cache'
import { getCachedPrefecture, getCachedPrefectureAndMunicipality } from '@/lib/geo-cache'
import { fetchUserWalkAreaTagsByUserId } from '@/lib/fetch-user-walk-area-tags'
import type { DogProfile } from '@/lib/dog-display'
import { resolveSessionLocation } from '@/lib/location-session'
import { filterDiscoverRecommendSpots } from '@/lib/hot-exclusions'
import { track } from '@/lib/analytics'
import { openSpotDetailFromPlace } from '@/lib/open-spot-detail'
import { POST_ONBOARDING_TUTORIAL_KEY } from '@/lib/onboarding-constants'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { shouldInjectListAd } from '@/lib/ads/list-injection'
import { isAdsMobileSdkInitialized, prepareSearchTabAdsOnce } from '@/lib/prepare-search-ads'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'
import { perfAsync, perfMark } from '@/lib/perf/marks'
import { wanspotFetch, wanspotFetchJson } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

const SEARCH_STORAGE_KEY = 'search_state_v1'
const SEARCH_RESTORE_FLAG = 'search_pending_restore'

type SortKey = 'default' | 'rating' | 'distance'
type DiscoverMode = 'ai' | 'articles' | 'ai_plan'

const DEFAULT_SUGGESTIONS = [
  '大型犬可',
  'ドッグラン',
  'ドッグキャンプ',
  '代々木公園',
  '犬と温泉',
  'ドッグビーチ',
  '犬と泊まれる',
  '吉祥寺',
  'しつけ教室',
]

function normalizeSuggestionTag(tag: string): string {
  return tag.trim().replace(/ドッグ園/g, 'ドッグラン')
}

/**
 * サイズ条件の候補は犬種によって必要度が違う（大型犬は入店可否の絞り込みが必須級だが、
 * 小型犬は逆にほぼ全施設に入れるため「小型犬可」の絞り込みニーズが強い。中型犬はどちらも
 * ほぼ通るため強制表示しない）。全ユーザーに同じタグを出すと無関係な人には邪魔な情報になる。
 */
function sizeFacilityTag(dogSize: DogProfile['size'] | null | undefined): string | null {
  if (dogSize === 'L' || dogSize === 'XL') return '大型犬可'
  if (dogSize === 'XS' || dogSize === 'S') return '小型犬可'
  return null
}

function mergeSuggestionTags(tags: string[], dogSize: DogProfile['size'] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const forced = sizeFacilityTag(dogSize)
  for (const raw of forced ? [forced, ...tags] : tags) {
    const tag = normalizeSuggestionTag(raw)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out.length > 0 ? out : DEFAULT_SUGGESTIONS
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: '近い順' },
  { key: 'rating', label: '評価順' },
  { key: 'distance', label: '距離順' },
]

const AI_LIKES_MIN = 5

/** 単一 ScrollView 構成のため、リストは初期件数のみマウントし、下端に近づくたび段階的に増やす（簡易ウィンドウイング） */
const LIST_INITIAL_VISIBLE = 8
const LIST_VISIBLE_STEP = 8
const LIST_LOAD_MORE_THRESHOLD_PX = 700

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const ARTICLES_CACHE_KEY = 'search:articles:v5:linked-spot-refs'

const IconSearch = ({ color = GOOGLE_HOME.textMuted }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
    <Circle cx={11} cy={11} r={8} />
    <Line x1={21} y1={21} x2={16.65} y2={16.65} />
  </Svg>
)
const IconClose = ({ color = GOOGLE_HOME.textMuted }: { color?: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
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
/** フック型の戻る矢印（AIモード解除） */
const IconBackHook = ({ color = GOOGLE_HOME.textPrimary }: { color?: string }) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 14 4 9l5-5" />
    <Path d="M20 20v-7a4 4 0 0 0-4-4H4" />
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

function SearchTab() {
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
  const [articlesRaw, setArticlesRaw] = useState<ArticleRow[]>([])
  const [articlesList, setArticlesList] = useState<ArticleRow[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [spotLikesCount, setSpotLikesCount] = useState<number | null>(null)
  const restoredRef = useRef(false)
  const scrollYRef = useRef(0)
  const contentHeightRef = useRef(0)
  const viewportHeightRef = useRef(0)
  const sortedResultsLenRef = useRef(0)
  const articlesListLenRef = useRef(0)
  const discoverResultsLenRef = useRef(0)
  const [searchVisibleCount, setSearchVisibleCount] = useState(LIST_INITIAL_VISIBLE)
  const [articlesVisibleCount, setArticlesVisibleCount] = useState(LIST_INITIAL_VISIBLE)
  const [discoverVisibleCount, setDiscoverVisibleCount] = useState(LIST_INITIAL_VISIBLE)
  /** スクロールが下端に近い、またはコンテンツが画面に対して短い場合に各リストの表示件数を伸ばす */
  const checkAndGrowVisibleLists = useCallback(() => {
    const remaining = contentHeightRef.current - viewportHeightRef.current - scrollYRef.current
    if (remaining > LIST_LOAD_MORE_THRESHOLD_PX) return
    setSearchVisibleCount((c) => Math.min(c + LIST_VISIBLE_STEP, sortedResultsLenRef.current))
    setArticlesVisibleCount((c) => Math.min(c + LIST_VISIBLE_STEP, articlesListLenRef.current))
    setDiscoverVisibleCount((c) => Math.min(c + LIST_VISIBLE_STEP, discoverResultsLenRef.current))
  }, [])
  const updateScrollY = useCallback((y: number) => {
    scrollYRef.current = y
    checkAndGrowVisibleLists()
  }, [checkAndGrowVisibleLists])
  const tabBarScrollHandler = useTabBarScroll(updateScrollY)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [userWalkTags, setUserWalkTags] = useState<string[]>([])
  const [dogSize, setDogSize] = useState<DogProfile['size'] | null>(null)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [recentArticleIds, setRecentArticleIds] = useState<string[]>([])
  const [adsRuntimeReady, setAdsRuntimeReady] = useState(false)
  const adsPrimedRef = useRef(false)
  /** AIプラン表示時、検索ヘッダーの高さぶん下げてオーバーレイ配置する */
  const [headerH, setHeaderH] = useState(0)
  const [showObTutorial, setShowObTutorial] = useState(false)
  const [obTutorialDogName, setObTutorialDogName] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [articlesListEnter, setArticlesListEnter] = useState(true)
  const [searchListEnter, setSearchListEnter] = useState(true)
  const [discoverListEnter, setDiscoverListEnter] = useState(true)
  const [articlesFetchError, setArticlesFetchError] = useState(false)
  const [nonCriticalReady, setNonCriticalReady] = useState(false)

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
      perfMark('tab:search:focus')
      return () => perfMark('tab:search:blur')
    }, [])
  )

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setNonCriticalReady(true), 1200)
    })
    return () => {
      task.cancel()
      if (timer) clearTimeout(timer)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!nonCriticalReady) return () => {}
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
    }, [nonCriticalReady])
  )

  useEffect(() => {
    if (!nonCriticalReady) return
    let cancelled = false
    void (async () => {
      try {
        const result = await resolveSessionLocation(null)
        if (!cancelled && result.ok) setLocation(result.location)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nonCriticalReady])

  useFocusEffect(
    useCallback(() => {
      if (!nonCriticalReady) return
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setUserWalkTags([])
          setDogSize(null)
          return
        }
        const { data: tags } = await fetchWithCache(
          `user:walk-tags:${user.id}`,
          CACHE_TTL.WALK_TAGS_MS,
          () => fetchUserWalkAreaTagsByUserId(supabase, user.id)
        )
        setUserWalkTags(tags)

        const { data: size } = await fetchWithCache(
          `profile:dog-size:${user.id}`,
          CACHE_TTL.DOG_PROFILE_MS,
          async () => {
            const { data: dog } = await supabase
              .from('dogs')
              .select('size')
              .eq('user_id', user.id)
              .maybeSingle()
            return (dog?.size as DogProfile['size'] | undefined) ?? null
          }
        )
        setDogSize(size)
      })()
    }, [nonCriticalReady])
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
    if (!nonCriticalReady) return
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
  }, [nonCriticalReady])

  useEffect(() => {
    if (!searched) return
    void AsyncStorage.setItem(
      SEARCH_STORAGE_KEY,
      JSON.stringify({ query, results, sortKey, scroll: scrollYRef.current })
    )
  }, [query, results, sortKey, searched])

  useEffect(() => {
    if (!nonCriticalReady) return
    let cancelled = false
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const geoKey = location ? geoBucket(location.lat, location.lng) : 'none'
        const walkTagsKey = userWalkTags.length > 0 ? [...userWalkTags].sort().join(',') : 'none'
        const cacheKey = `search:suggest-tags:${user?.id ?? 'anon'}:${geoKey}:${dogSize ?? 'none'}:${walkTagsKey}`
        const { data: tags } = await fetchWithCache(cacheKey, CACHE_TTL.SUGGEST_TAGS_MS, async () => {
          const prefecture = location ? await getCachedPrefecture(location.lat, location.lng) : undefined
          const res = await wanspotFetch('/api/spots/suggest-tags', {
            method: 'POST',
            json: {
              userId: user?.id ?? null,
              lat: location?.lat,
              lng: location?.lng,
              prefecture,
              walkAreaTags: userWalkTags,
              dogSize: dogSize ?? null,
            },
          })
          if (!res.ok) return null
          const data = (await res.json()) as { tags?: string[] }
          return Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : null
        })
        if (!cancelled && tags) {
          setSuggestions(mergeSuggestionTags(tags, dogSize))
          setSuggestionsReady(true)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location, nonCriticalReady, userWalkTags, dogSize])

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
      const { data: result } = await perfAsync('api:recommend', () =>
        fetchWithCache(
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
              const { data } = await supabase
                .from('articles')
                .select(
                  // blocks/spot_links の重い JSON は一覧では取得しない。並べ替え用のスポット参照は
                  // DB トリガーで事前計算された軽量カラム linked_spot_refs を使う
                  'id, title, summary, slug, category, theme, keywords, image_url, created_at, published_at, target_prefectures, target_municipalities, target_walk_area_tags, dog_size_tags, topic_tags, segment_level, linked_spot_refs'
                )
                .eq('status', 'published')
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(40)
              return (data ?? []) as ArticleRow[]
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
          if (urls.length > 0) void ExpoImage.prefetch(urls.slice(0, 8), 'memory-disk')
        }
      } catch {
        setArticlesFetchError(true)
      } finally {
        setArticlesLoading(false)
      }
    },
    [articlesLoading, articlesRaw.length]
  )

  /** 取得済み記事を現在地・登録エリア・行動履歴で並べ替え（AIレコメンドと同様、シグナル更新に追従） */
  useEffect(() => {
    if (articlesRaw.length === 0) {
      setArticlesList([])
      return
    }

    // 並べ替え（複数DBクエリ）を待たず、まず公開順で即表示して empty 表示を防ぐ
    setArticlesList((prev) => (prev.length > 0 ? prev : articlesRaw))
    if (!nonCriticalReady) return

    let cancelled = false
    // 内容が同じなら（タブ再フォーカス等での effect 再実行時に）DB 再クエリを避ける
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
  }, [articlesRaw, location, userWalkTags, recentArticleIds, nonCriticalReady])

  useEffect(() => {
    if (!nonCriticalReady) return
    if (searched) return
    if (discoverMode === 'articles') void handleArticles()
  }, [discoverMode, searched, handleArticles, nonCriticalReady])

  useEffect(() => {
    if (!nonCriticalReady) return
    if (searched || spotLikesCount === null || spotLikesCount < AI_LIKES_MIN) return
    if (discoverMode !== 'ai') return
    void handleAiRecommend()
  }, [discoverMode, spotLikesCount, searched, handleAiRecommend, nonCriticalReady])

  useEffect(() => {
    if (!nonCriticalReady) return
    if (searched || !location || spotLikesCount === null || spotLikesCount < AI_LIKES_MIN) return
    if (discoverMode !== 'ai') return
    void handleAiRecommend()
  }, [location, searched, spotLikesCount, discoverMode, handleAiRecommend, nonCriticalReady])

  const handleSearch = useCallback(async (q: string, opts?: { silent?: boolean }) => {
    Keyboard.dismiss()
    const trimmed = q.trim()
    if (!trimmed) return
    const silent = opts?.silent === true
    setQuery(trimmed)
    if (!silent) setLoading(true)
    setSearched(true)
    try {
      let loc = location
      const locResult = await resolveSessionLocation(location)
      if (locResult.ok) {
        loc = locResult.location
        if (locResult.changed) setLocation(loc)
      }
      const locationParam = loc ? `&lat=${loc.lat}&lng=${loc.lng}` : ''
      const res = await perfAsync('api:search', () =>
        wanspotFetch(`/api/spots/search?q=${encodeURIComponent(trimmed)}${locationParam}`)
      )
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
    let copy = [...results]
    if (location) {
      const maxM = 50_000
      copy = copy.filter((s) => {
        if (s.lat == null || s.lng == null) return true
        return calcDistance(location.lat, location.lng, s.lat, s.lng) <= maxM
      })
      copy = rankSpotsByWalkContext(copy, location, userWalkTags)
    }
    copy.sort((a, b) => {
      if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (location && a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
        if (sortKey === 'distance' || sortKey === 'default') {
          return (
            calcDistance(location.lat, location.lng, a.lat, a.lng) -
            calcDistance(location.lat, location.lng, b.lat, b.lng)
          )
        }
      }
      return 0
    })
    return copy
  }, [results, sortKey, location, userWalkTags])

  const currentSort = SORT_OPTIONS.find((o) => o.key === sortKey)!
  /** 取得済み結果に対し、タグ・現在地で再ランク（fetch 内でも適用済みだが、タブ復帰後のタグ更新に追従） */
  const discoverResults = useMemo(() => {
    const raw = aiResults
    return rankSpotsByWalkContext(raw, location, userWalkTags)
  }, [aiResults, location, userWalkTags])
  const discoverLoading = discoverMode === 'ai' ? aiLoading : articlesLoading

  sortedResultsLenRef.current = sortedResults.length
  articlesListLenRef.current = articlesList.length
  discoverResultsLenRef.current = discoverResults.length

  // 元データ（再取得）が変わった時のみ表示件数を初期値に戻す。並べ替えのみの更新（location/tags 変化）ではリセットしない
  useEffect(() => {
    setSearchVisibleCount(LIST_INITIAL_VISIBLE)
  }, [results])
  useEffect(() => {
    setArticlesVisibleCount(LIST_INITIAL_VISIBLE)
  }, [articlesRaw])
  useEffect(() => {
    setDiscoverVisibleCount(LIST_INITIAL_VISIBLE)
  }, [aiResults])

  // 表示件数の変化やコンテンツ再取得の直後は、画面がまだ埋まっていなければ追加で伸ばす（スクロール不要なケースの取りこぼし対策）
  useEffect(() => {
    checkAndGrowVisibleLists()
  }, [searchVisibleCount, articlesVisibleCount, discoverVisibleCount, sortedResults.length, articlesList.length, discoverResults.length, checkAndGrowVisibleLists])

  useEffect(() => {
    if (!articlesLoading && articlesList.length > 0 && articlesListEnter) {
      const t = setTimeout(() => setArticlesListEnter(false), 700)
      return () => clearTimeout(t)
    }
  }, [articlesLoading, articlesList.length, articlesListEnter])

  useEffect(() => {
    if (!loading && sortedResults.length > 0 && searchListEnter) {
      const t = setTimeout(() => setSearchListEnter(false), 700)
      return () => clearTimeout(t)
    }
  }, [loading, searchListEnter, sortedResults.length])

  useEffect(() => {
    if (!discoverLoading && discoverResults.length > 0 && discoverListEnter) {
      const t = setTimeout(() => setDiscoverListEnter(false), 700)
      return () => clearTimeout(t)
    }
  }, [discoverLoading, discoverListEnter, discoverResults.length])

  const openSpot = (_id: string, place: PlaceResult) => {
    openSpotDetailFromPlace(router, place)
  }

  const beforeNavSearch = async () => {
    await AsyncStorage.setMany({
      [SEARCH_STORAGE_KEY]: JSON.stringify({ query, results, sortKey, scroll: scrollYRef.current }),
      [SEARCH_RESTORE_FLAG]: '1',
    })
  }

  /** 「AIプラン」チップ選択時は AiPlanTab を全画面オーバーレイで表示（挙動は従来のまま） */
  const showAiPlan = !searched && discoverMode === 'ai_plan'

  const exitDiscoverMode = useCallback(() => {
    Keyboard.dismiss()
    setDiscoverMode('articles')
  }, [])

  const iconMuted = GOOGLE_HOME.textMuted
  const iconActive = GOOGLE_HOME.textPrimary
  const aiIconOff = 'rgba(255,255,255,0.62)'
  const aiIconOn = '#FFFFFF'

  return (
    <GoogleHomeBackground>
    <View style={styles.root}>
      <Animated.ScrollView
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
        onScroll={tabBarScrollHandler}
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h
          checkAndGrowVisibleLists()
        }}
        onLayout={(e) => {
          viewportHeightRef.current = e.nativeEvent.layout.height
          checkAndGrowVisibleLists()
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
          {!searched ? <SearchHomeHeader /> : <View style={{ paddingTop: insets.top + 8 }} />}
          <View style={[styles.searchHeader, searched && styles.searchHeaderCompact]}>
            <View style={styles.searchRow}>
            <GlassSearchShell focused={searchFocused} variant="google">
              <IconSearch color={iconMuted} />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="スポット・エリア・キーワード"
                placeholderTextColor={GOOGLE_HOME.searchPlaceholder}
                onSubmitEditing={() => void handleSearch(query)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
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
                  <IconClose color={iconMuted} />
                </Pressable>
              ) : null}
              <PressableScale style={styles.searchGo} onPress={() => void handleSearch(query)}>
                <Text style={styles.searchGoTxt}>検索</Text>
              </PressableScale>
            </GlassSearchShell>
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
                style={{ marginTop: 12, opacity: suggestionsReady ? 1 : 0.6 }}
                contentContainerStyle={{ paddingRight: GOOGLE_HOME.padH }}
              >
                <View style={styles.sugRow}>
                  {suggestions.map((s) => (
                    <Pressable key={s} style={styles.sug} onPress={() => void handleSearch(s)}>
                      <Text style={styles.sugTxt}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              {/* Google アプリ風: 2モードピル — 選択中のみピル右端に Back */}
              <View style={styles.aiPillRow}>
                <View style={styles.aiPillSlot}>
                  {discoverMode === 'ai_plan' ? (
                    <View style={[styles.aiPill, styles.aiPillOn]}>
                      <View style={styles.aiPillMain}>
                        <IconAiPlan fill={aiIconOn} />
                        <Text style={[styles.aiPillTxt, styles.aiPillTxtOn]}>AIプラン</Text>
                      </View>
                      <PressableScale
                        style={styles.aiPillBack}
                        onPress={exitDiscoverMode}
                        accessibilityLabel="まとめ記事に戻る"
                      >
                        <IconBackHook />
                      </PressableScale>
                    </View>
                  ) : (
                    <PressableScale
                      style={styles.aiPill}
                      onPress={() => {
                        Keyboard.dismiss()
                        setDiscoverMode('ai_plan')
                      }}
                      accessibilityLabel="AIプラン"
                    >
                      <IconAiPlan fill={aiIconOff} />
                      <Text style={styles.aiPillTxt}>AIプラン</Text>
                    </PressableScale>
                  )}
                </View>
                <View style={styles.aiPillSlot}>
                  {discoverMode === 'ai' ? (
                    <View style={[styles.aiPill, styles.aiPillOn]}>
                      <View style={styles.aiPillMain}>
                        <IconThumbUp fill={aiIconOn} />
                        <Text style={[styles.aiPillTxt, styles.aiPillTxtOn]} numberOfLines={1}>
                          AIレコメンド
                        </Text>
                      </View>
                      <PressableScale
                        style={styles.aiPillBack}
                        onPress={exitDiscoverMode}
                        accessibilityLabel="まとめ記事に戻る"
                      >
                        <IconBackHook />
                      </PressableScale>
                    </View>
                  ) : (
                    <PressableScale
                      style={styles.aiPill}
                      onPress={() => {
                        Keyboard.dismiss()
                        setDiscoverMode('ai')
                      }}
                      accessibilityLabel="AIレコメンド"
                    >
                      <IconThumbUp fill={aiIconOff} />
                      <Text style={styles.aiPillTxt} numberOfLines={1}>
                        AIレコメンド
                      </Text>
                    </PressableScale>
                  )}
                </View>
              </View>
            </>
          ) : null}
          </View>
        </View>

        {!showAiPlan ? (
        <View style={styles.results}>
          {loading ? (
            <>
              <SearchResultSkeleton variant="dark" />
              <SearchResultSkeleton variant="dark" />
              <SearchResultSkeleton variant="dark" />
            </>
          ) : null}
          {!loading && searched && results.length === 0 ? <PowState label="見つかりませんでした" /> : null}
          {!loading &&
            searched &&
            sortedResults.slice(0, searchVisibleCount).map((spot, index) => (
              <ListEnterItem key={spot.place_id} index={index} animate={searchListEnter}>
                <View>
                  <SearchDiscoverResultCard
                    spot={spot}
                    userLocation={location}
                    userWalkTags={userWalkTags}
                    onOpen={openSpot}
                    onLikesChange={refreshSpotLikesCount}
                    onBeforeNavigate={beforeNavSearch}
                    chrome="google"
                  />
                  {isFocused && shouldInjectListAd(index, sortedResults.length) ? (
                    <AdNativeCard adsReady={adsRuntimeReady} />
                  ) : null}
                </View>
              </ListEnterItem>
            ))}

          {!searched ? (
            <>
              {discoverMode === 'articles' ? (
                <>
                  {/* Google アプリ風の中段カード: お散歩アラート（デフォ表示）+ いいねショートカット */}
                  {nonCriticalReady ? (
                    <View style={styles.middleCards}>
                      <WalkAlertCard
                        location={location}
                        onRequestLocation={() => {
                          void (async () => {
                            const result = await resolveSessionLocation(null)
                            if (result.ok) setLocation(result.location)
                          })()
                        }}
                      />
                      <LikesShortcutCard />
                    </View>
                  ) : null}

                  <View style={styles.feedHeader}>
                    <IconBulb fill={iconActive} />
                    <Text style={styles.feedHeaderTxt}>ワンスポまとめ</Text>
                  </View>

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
                  {articlesList.slice(0, articlesVisibleCount).map((article, index) => (
                      <ListEnterItem key={article.id} index={index} animate={articlesListEnter}>
                        <View>
                          <DiscoverFeedCard
                            title={article.title}
                            summary={article.summary}
                            imageUrl={article.image_url}
                            keywords={article.keywords ?? []}
                            recyclingKey={`article-list-${article.id}`}
                            onPress={() => {
                              track('article_clicked', { article_id: article.id })
                              setRecentArticleIds((prev) => {
                                if (prev.includes(article.id)) return prev
                                return [article.id, ...prev].slice(0, 40)
                              })
                              router.push(`/articles/${article.slug}`)
                            }}
                          />
                          {isFocused && shouldInjectListAd(index, articlesList.length) ? (
                            <AdNativeCard adsReady={adsRuntimeReady} />
                          ) : null}
                        </View>
                      </ListEnterItem>
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
                  {discoverLoading && discoverResults.length === 0 && discoverMode === 'ai' ? (
                    <>
                      <SearchResultSkeleton variant="dark" />
                      <SearchResultSkeleton variant="dark" />
                    </>
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
                    discoverResults.slice(0, discoverVisibleCount).map((spot, index) => (
                      <ListEnterItem key={spot.place_id} index={index} animate={discoverListEnter}>
                        <View>
                          <SearchDiscoverResultCard
                            spot={spot}
                            userLocation={location}
                            userWalkTags={userWalkTags}
                            onOpen={openSpot}
                            onLikesChange={refreshSpotLikesCount}
                            onBeforeNavigate={async () => {
                              await AsyncStorage.setItem(SEARCH_RESTORE_FLAG, '1')
                            }}
                            chrome="google"
                          />
                          {isFocused && shouldInjectListAd(index, discoverResults.length) ? (
                            <AdNativeCard adsReady={adsRuntimeReady} />
                          ) : null}
                        </View>
                      </ListEnterItem>
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
      </Animated.ScrollView>

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
    </GoogleHomeBackground>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingBottom: 24 },
  aiPlanOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
  },
  searchHeader: {
    paddingHorizontal: GOOGLE_HOME.padH,
    paddingTop: 4,
    paddingBottom: 0,
    backgroundColor: 'transparent',
  },
  searchHeaderCompact: {
    paddingTop: 0,
    paddingBottom: 10,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.2,
    color: GOOGLE_HOME.searchText,
    paddingVertical: 2,
  },
  searchGo: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: GOOGLE_HOME.searchActionBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.searchActionBorder,
  },
  searchGoTxt: { fontSize: 13, fontWeight: '600', color: GOOGLE_HOME.textPrimary },
  kbDismissBar: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  kbDismissTxt: { fontSize: 13, fontWeight: '600', color: GOOGLE_HOME.textSecondary },
  sortWrap: { position: 'relative' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: GOOGLE_HOME.radiusSearch,
    backgroundColor: GOOGLE_HOME.pillBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.pillBorder,
  },
  sortBtnTxt: { fontSize: 12, fontWeight: '600', color: GOOGLE_HOME.textPrimary },
  aiPillRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'center',
    width: '100%',
    gap: 8,
    marginTop: 12,
    marginBottom: 0,
    paddingBottom: 10,
  },
  /** PressableScale は外側 Pressable に flex が効かないためスロットで等幅化 */
  aiPillSlot: {
    flex: 1,
    minWidth: 0,
  },
  aiPill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: GOOGLE_HOME.radiusPill,
    backgroundColor: GOOGLE_HOME.pillBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.pillBorder,
  },
  aiPillMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 0,
  },
  aiPillBack: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    marginLeft: 4,
    borderRadius: 17,
    backgroundColor: GOOGLE_HOME.searchActionBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.searchActionBorder,
  },
  aiPillOn: {
    backgroundColor: GOOGLE_HOME.pillActiveBg,
    borderColor: GOOGLE_HOME.pillActiveBorder,
  },
  aiPillTxt: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: GOOGLE_HOME.textSecondary,
    flexShrink: 1,
  },
  aiPillTxtOn: { color: GOOGLE_HOME.textPrimary, fontWeight: '600' },
  middleCards: { gap: GOOGLE_HOME.gapCard, marginBottom: GOOGLE_HOME.gapSection },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  feedHeaderTxt: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: GOOGLE_HOME.textPrimary,
  },
  sugRow: { flexDirection: 'row', gap: 8, paddingVertical: 2, paddingLeft: 2 },
  sug: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: GOOGLE_HOME.radiusPill,
    backgroundColor: GOOGLE_HOME.searchActionBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.searchActionBorder,
    marginRight: 8,
  },
  sugTxt: { fontSize: 13, fontWeight: '600', color: GOOGLE_HOME.textPrimary },
  results: { paddingHorizontal: GOOGLE_HOME.padH, paddingTop: 8, gap: GOOGLE_HOME.gapCard },
  discLabel: { fontSize: 13, fontWeight: '600', color: GOOGLE_HOME.textSecondary, marginBottom: 6 },
  discSub: { fontSize: 12, fontWeight: '400', color: GOOGLE_HOME.textMuted, marginTop: 2, marginBottom: 4 },
  aiGate: { alignItems: 'center', paddingVertical: 36 },
  aiGateTxt: { fontSize: 14, fontWeight: '500', color: GOOGLE_HOME.textSecondary },
  aiGateSub: { fontSize: 13, color: GOOGLE_HOME.textMuted, marginTop: 8 },
  sortModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'flex-end', paddingTop: 100, paddingRight: 16 },
  sortMenu: {
    borderRadius: 18,
    backgroundColor: 'rgba(28,26,24,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.panelBorder,
    minWidth: 148,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  sortItem: { paddingHorizontal: 16, paddingVertical: 13 },
  sortItemOn: { backgroundColor: 'rgba(255,255,255,0.10)' },
  sortItemTxt: { fontSize: 13, fontWeight: '500', color: GOOGLE_HOME.textMuted },
  sortItemTxtOn: { color: GOOGLE_HOME.textPrimary, fontWeight: '600' },
})

export default function SearchTabScreen() {
  return (
    <ScreenErrorBoundary label="search">
      <SearchTab />
    </ScreenErrorBoundary>
  )
}
