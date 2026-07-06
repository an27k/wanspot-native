import { useEffect, useMemo, useRef, useState } from 'react'
import { Image } from 'expo-image'
import {
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { TOKENS } from '@/constants/color-tokens'
import { RunningDog, PowState } from '@/components/DogStates'
import { IconInstagram } from '@/components/IconInstagram'
import { IconPaw } from '@/components/IconPaw'
import { HEART_ICON } from '@/lib/constants'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
import { fetchUserWalkAreaTagsByUserId } from '@/lib/fetch-user-walk-area-tags'
import { CACHE_TTL, fetchWithCache } from '@/lib/client-cache'
import { track } from '@/lib/analytics'
import { remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetch, wanspotFetchJson, wanspotPublicUrl } from '@/lib/wanspot-api'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import {
  bootstrapSpotForDetail,
  ensureSpotUuidForPlace,
  isSpotUuid,
  resolveSpotForDetail,
  type SpotDetailRow,
} from '@/lib/spot-detail-load'
import { formatVisitRecordError, fetchTodaySpotVisit, fetchVisitPlates, recordSpotVisit, updateVisit } from '@/lib/visits-memories'
import { REVIEW_ALBUM_TAB_ENABLED, VLOG_ENABLED } from '@/lib/feature-flags'
import { pickSpotReviewMemoPlaceholder } from '@/lib/spot-review-memo'
import { logUserEvent } from '@/lib/user-events'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { fetchAiSummary } from '@/lib/ai-summary'
import { withTimeout } from '@/lib/promise-timeout'
import { calcDistanceMeters, formatDistanceLabel } from '@/lib/nearby/geo'
import { formatPriceDisplay, getSpotOpenStatus } from '@/lib/business-hours'
import { getGoogleMapsIosApiKey } from '@/lib/google-maps-config'
import { computeVlogProgressFromPlates } from '@/lib/album/vlog-progress'
import type { PlaceResult } from '@/types/places'

const { width: WIN_W } = Dimensions.get('window')
const HERO_H = 290
const FIXED_ACTION_H = 56

type IgStatus = 'unprocessed' | 'registered' | 'verified' | 'fetching' | 'not_found'

type Spot = SpotDetailRow

type AISummary = {
  keywords: string[]
  summary: string
  wanspotRating?: { avg: number; count: number }
}

type DetailJson = {
  photos?: { photo_reference?: string }[]
  rating?: number
  user_ratings_total?: number | null
  formatted_address?: string
  price_level?: number | null
  price_label?: string | null
  vicinity?: string
  opening_hours?: { weekday_text?: string[]; open_now?: boolean }
  reviews?: { text?: string }[]
}

function buildSpotMapMiniUrl(lat: number, lng: number): string {
  const apiKey = getGoogleMapsIosApiKey()
  if (!apiKey) return ''
  const marker = encodeURIComponent(`color:0xFB6B53|${lat},${lng}`)
  return `https://maps.googleapis.com/maps/api/staticmap?size=640x240&scale=2&maptype=roadmap&markers=${marker}&key=${encodeURIComponent(apiKey)}`
}

function normalizePriceLevel(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(4, Math.round(n)))
}

/** Places Detail の JSON（フラット or { result } / エラーオブジェクト）を正規化 */
function parsePlaceDetailResponse(json: unknown): DetailJson | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (typeof o.error === 'string' && o.error.length > 0) return null
  if (o.result && typeof o.result === 'object') {
    return o.result as DetailJson
  }
  return o as DetailJson
}

function priceLevelFromDetail(d: DetailJson | null): number | null {
  if (!d) return null
  const o = d as Record<string, unknown>
  return normalizePriceLevel(o.price_level ?? o.priceLevel)
}

function priceLabelFromDetail(d: DetailJson | null): string | null {
  if (!d) return null
  const o = d as Record<string, unknown>
  const label = o.price_label ?? o.priceLabel
  return typeof label === 'string' && label.trim().length > 0 ? label.trim() : null
}

const IconChevronLeft = ({ color = colors.textPrimary }: { color?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
)

const IconShare = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TOKENS.text.primary} strokeWidth={2} strokeLinecap="round">
    <Circle cx={18} cy={5} r={3} />
    <Circle cx={6} cy={12} r={3} />
    <Circle cx={18} cy={19} r={3} />
    <Path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" />
  </Svg>
)

const IconHeart = ({ filled }: { filled: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill={filled ? HEART_ICON.filled : 'none'} stroke={filled ? HEART_ICON.filled : HEART_ICON.strokeEmpty} strokeWidth={2}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

const IconGoogle = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
)

const IconX = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
    <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </Svg>
)

const IconCopy = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round">
    <Path d="M9 9h10v10H9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
)

function StarRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={22} color={colors.gold} />
        </Pressable>
      ))}
    </View>
  )
}

export default function SpotDetailScreen({
  spotId,
  pendingPlace = null,
}: {
  spotId: string
  pendingPlace?: PlaceResult | null
}) {
  const router = useRouter()
  const requireAuth = useRequireAuth()
  const { dog, loading: dogLoading } = useDogProfile()
  const insets = useSafeAreaInsets()
  const likeScale = useRef(new Animated.Value(1)).current
  const instagramAutoFetchSent = useRef<string | null>(null)
  const visitRecordInFlight = useRef(false)
  const memoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const photoListRef = useRef<FlatList<string>>(null)
  const aiRequestKeyRef = useRef<string | null>(null)

  const initialBootstrap = bootstrapSpotForDetail(spotId, pendingPlace ?? null)

  const [spot, setSpot] = useState<Spot | null>(initialBootstrap)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [photoRefs, setPhotoRefs] = useState<string[]>([])
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [reviewsForAi, setReviewsForAi] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialBootstrap)
  const [googleRating, setGoogleRating] = useState<number | null>(null)
  const [googleReviewCount, setGoogleReviewCount] = useState<number | null>(null)
  const [googlePriceLevel, setGooglePriceLevel] = useState<number | null>(null)
  const [googlePriceLabel, setGooglePriceLabel] = useState<string | null>(null)
  const [googleAddress, setGoogleAddress] = useState<string | null>(null)
  const [openingHours, setOpeningHours] = useState<string[] | null>(null)
  const [openNow, setOpenNow] = useState<boolean | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [visitId, setVisitId] = useState<string | null>(null)
  const [userRating, setUserRating] = useState(0)
  const [userMemo, setUserMemo] = useState('')
  const [visitRecording, setVisitRecording] = useState(false)
  const [showVisitSheet, setShowVisitSheet] = useState(false)
  const [vlogRemaining, setVlogRemaining] = useState<number | null>(null)
  const [aiExpanded, setAiExpanded] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [visitToast, setVisitToast] = useState<{
    message: string
    tone: 'success' | 'error'
    retry?: boolean
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const pendingPlaceKey = pendingPlace
    ? `${pendingPlace.place_id}|${pendingPlace.name}|${pendingPlace.lat}|${pendingPlace.lng}`
    : ''

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      setLoadError(null)

      let spotData = bootstrapSpotForDetail(spotId, pendingPlace ?? null)
      if (spotData) {
        setSpot(spotData)
        setLoading(false)
      } else {
        setLoading(true)
        const resolved = await resolveSpotForDetail(spotId, pendingPlace ?? null)
        if (cancelled) return
        if (!resolved.ok) {
          setLoadError(resolved.message)
          setLoading(false)
          return
        }
        spotData = resolved.spot
        setSpot(spotData)
        setLoading(false)
      }

      if (!spotData || cancelled) return
      const resolvedSpotId = spotData.id
      if (!isSpotUuid(resolvedSpotId)) {
        void ensureSpotUuidForPlace(
          {
            place_id: spotData.place_id,
            name: spotData.name,
            category: spotData.category,
            address: spotData.address ?? '',
            lat: spotData.lat ?? 0,
            lng: spotData.lng ?? 0,
            photo_ref: null,
            rating: spotData.rating,
            price_level: spotData.price_level ?? null,
            price_label: spotData.price_label ?? null,
            user_ratings_total: null,
          },
          resolvedSpotId
        ).then((uuid) => {
          if (cancelled || !uuid || uuid === resolvedSpotId) return
          setSpot((prev) => (prev ? { ...prev, id: uuid } : prev))
        })
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      const user = session?.user ?? null
      if (user) setUserId(user.id)

      // Places Detail と いいね/チェックイン状態は互いに依存しないため並列化してラウンドトリップを1回減らす
      const [detailHttp, [{ count: likeC }, myLikeResult]] = await Promise.all([
        wanspotFetch(`/api/spots/detail?place_id=${encodeURIComponent(spotData.place_id)}`).catch(() => null),
        Promise.all([
          supabase.from('spot_likes').select('*', { count: 'exact', head: true }).eq('spot_id', resolvedSpotId),
          user
            ? supabase
                .from('spot_likes')
                .select('id')
                .eq('spot_id', resolvedSpotId)
                .eq('user_id', user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]),
      ])
      let detailRes: DetailJson | null = null
      if (detailHttp?.ok) {
        try {
          detailRes = parsePlaceDetailResponse(await detailHttp.json())
        } catch {
          detailRes = null
        }
      }

      setLikeCount(likeC ?? 0)
      setLiked(!!myLikeResult.data)
      if (user) {
        const todayVisit = await fetchTodaySpotVisit(user.id, resolvedSpotId)
        if (cancelled) return
        if (todayVisit) {
          setVisitId(todayVisit.id)
          setCheckedIn(true)
          setUserRating(todayVisit.rating ?? 0)
          setUserMemo(todayVisit.comment ?? '')
        } else {
          setVisitId(null)
          setCheckedIn(false)
          setUserRating(0)
          setUserMemo('')
        }
        logUserEvent({ eventType: 'spot_view', spotId: resolvedSpotId, userId: user.id })
      } else {
        setVisitId(null)
        setCheckedIn(false)
        setUserRating(0)
        setUserMemo('')
      }

      if (detailRes?.photos?.length) {
        setPhotoRefs(detailRes.photos.slice(0, 8).map((p) => p.photo_reference).filter(Boolean) as string[])
      }
      const dr = detailRes?.rating
      if (typeof dr === 'number' && Number.isFinite(dr)) setGoogleRating(dr)
      const reviewCount =
        typeof detailRes?.user_ratings_total === 'number' && Number.isFinite(detailRes.user_ratings_total)
          ? detailRes.user_ratings_total
          : null
      if (reviewCount != null) setGoogleReviewCount(reviewCount)
      let priceLvl = priceLevelFromDetail(detailRes) ?? normalizePriceLevel((spotData as Spot).price_level)
      let priceLbl = priceLabelFromDetail(detailRes) ?? ((spotData as Spot).price_label ?? null)
      if (priceLvl === null && spotData.place_id && (!detailHttp || !detailHttp.ok)) {
        try {
          const br = await wanspotFetch('/api/spots/batch-details', {
            method: 'POST',
            json: { place_ids: [spotData.place_id] },
          })
          if (br.ok) {
            const bj = (await br.json()) as { details?: Record<string, { price_level?: unknown; price_label?: unknown; user_ratings_total?: unknown }> }
            const batchDetail = bj.details?.[spotData.place_id]
            priceLvl = normalizePriceLevel(batchDetail?.price_level) ?? priceLvl
            priceLbl =
              typeof batchDetail?.price_label === 'string' && batchDetail.price_label.trim().length > 0
                ? batchDetail.price_label.trim()
                : priceLbl
            const batchReviewCount = typeof batchDetail?.user_ratings_total === 'number' ? batchDetail.user_ratings_total : null
            if (batchReviewCount != null) setGoogleReviewCount(batchReviewCount)
          }
        } catch {
          /* ignore */
        }
      }
      setGooglePriceLevel(priceLvl)
      setGooglePriceLabel(priceLbl)
      setGoogleAddress(detailRes?.formatted_address ?? detailRes?.vicinity ?? null)
      setOpeningHours(detailRes?.opening_hours?.weekday_text ?? null)
      setOpenNow(typeof detailRes?.opening_hours?.open_now === 'boolean' ? detailRes.opening_hours.open_now : null)
      setReviewsForAi(detailRes?.reviews?.slice(0, 5).map((r) => r.text).filter(Boolean) as string[] ?? [])
      if (!cancelled) setLoadError(null)
    }
    void init()
    return () => {
      cancelled = true
    }
    // dog は別 effect で扱う（変化時に spots/detail/likes を含む init 全体を再実行しないようにするため）
  }, [spotId, pendingPlaceKey, reloadNonce])

  useEffect(() => {
    void Location.getCurrentPositionAsync({})
      .then((p) => setUserCoords({ lat: p.coords.latitude, lng: p.coords.longitude }))
      .catch(() => setUserCoords(null))
  }, [])

  useEffect(() => {
    if (loading || !spot || dogLoading) return
    const dogKey = `${dog?.size ?? 'none'}:${dog?.breed ?? 'none'}`
    const requestKey = `${spot.id}:${dogKey}:${reviewsForAi.length > 0 ? 'r1' : 'r0'}`
    if (aiRequestKeyRef.current === requestKey) return
    aiRequestKeyRef.current = requestKey

    let cancelled = false
    setAiLoading(true)
    ;(async () => {
      const [walkTags, posCtx] = await Promise.all([
        userId
          ? fetchWithCache(`user:walk-tags:${userId}`, CACHE_TTL.WALK_TAGS_MS, () =>
              fetchUserWalkAreaTagsByUserId(supabase, userId)
            ).then((r) => r.data)
          : Promise.resolve([] as string[]),
        withTimeout(
          Location.getCurrentPositionAsync({})
            .then((p) => ({ lat: p.coords.latitude, lng: p.coords.longitude }))
            .catch((): null => null),
          2500,
          null
        ),
      ])

      const result = await fetchAiSummary({
        place_id: spot.place_id,
        spot_id: spot.id,
        name: spot.name,
        category: spot.category,
        rating: spot.rating,
        address: spot.address,
        reviews: reviewsForAi,
        dogSize: dog?.size ?? undefined,
        dogBreed: dog?.breed ?? undefined,
        userContext: {
          walkAreaTags: walkTags,
          lat: posCtx?.lat ?? null,
          lng: posCtx?.lng ?? null,
        },
      })
      if (!cancelled && result) setAiSummary(result)
    })().finally(() => {
      if (!cancelled) setAiLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [spot, loading, dogLoading, dog?.size, dog?.breed, userId, reviewsForAi])

  useEffect(() => {
    if (photoRefs.length === 0) return
    const urls = photoRefs
      .map((r) => spotPhotoUrl(r, 'hero'))
      .filter((u): u is string => u != null && u.length > 0)
    if (urls.length === 0) return
    void Image.prefetch(urls, 'memory-disk')
  }, [photoRefs])

  useEffect(() => {
    instagramAutoFetchSent.current = null
  }, [spotId])

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

  useEffect(() => {
    if (loading || !spot) return
    const placeId = spot.place_id
    if (instagramAutoFetchSent.current === placeId) return

    const st = (spot.ig_status ?? 'unprocessed') as string
    const checkedAt = spot.ig_last_checked ? new Date(spot.ig_last_checked).getTime() : NaN
    const over30 =
      !spot.ig_last_checked || !Number.isFinite(checkedAt) || Date.now() - checkedAt >= THIRTY_DAYS_MS
    const shouldRun = st === 'unprocessed' || (st === 'not_found' && over30)
    if (!shouldRun) return

    instagramAutoFetchSent.current = placeId
    wanspotFetchJson<{
      ok?: boolean
      instagram_id?: string | null
      ig_status?: string
      ig_last_checked?: string | null
    }>('/api/spots/instagram', {
      method: 'POST',
      json: {
        place_id: spot.place_id,
        spot_name: spot.name,
        address: spot.address,
      },
    })
      .then((json) => {
        if (!json?.ok) return
        setSpot((prev) =>
          prev
            ? {
                ...prev,
                instagram_id:
                  json.instagram_id !== undefined && json.instagram_id !== null ? json.instagram_id : prev.instagram_id,
                ig_status: json.ig_status ?? prev.ig_status,
                ig_last_checked: json.ig_last_checked ?? prev.ig_last_checked,
              }
            : null
        )
      })
      .catch(() => {
        instagramAutoFetchSent.current = null
      })
  }, [loading, spot])

  useEffect(() => {
    if (!visitToast) return
    const ms = visitToast.tone === 'error' ? 5000 : 2000
    const t = setTimeout(() => setVisitToast(null), ms)
    return () => clearTimeout(t)
  }, [visitToast])

  useEffect(() => {
    return () => {
      if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current)
    }
  }, [])

  const memoPlaceholder = useMemo(
    () => pickSpotReviewMemoPlaceholder(dog?.name, spot?.id ?? spotId),
    [dog?.name, spot?.id, spotId]
  )

  const ensureVisitId = async (): Promise<string | null> => {
    if (visitId) return visitId
    if (!spot || !userId) return null
    const result = await recordSpotVisit(userId, spot.id, 'review')
    if (!result.ok || !result.visitId) return null
    setVisitId(result.visitId)
    setCheckedIn(true)
    return result.visitId
  }

  const saveUserRating = async (rating: number) => {
    if (!spot) return
    if (!requireAuth('評価を残すにはログインしてください。')) return
    if (!userId) return
    const id = await ensureVisitId()
    if (!id) return
    setUserRating(rating)
    await updateVisit(id, { rating })
  }

  const saveUserMemo = (comment: string) => {
    if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current)
    memoDebounceRef.current = setTimeout(() => {
      void (async () => {
        if (!spot || !userId) return
        if (!requireAuth('メモを残すにはログインしてください。')) return
        const id = await ensureVisitId()
        if (!id) return
        await updateVisit(id, { comment: comment.trim() || null })
      })()
    }, 800)
  }

  const toggleLike = async () => {
    if (!spot || likeLoading) return
    if (!requireAuth('いいねするにはログインしてください。')) return
    if (!userId) return
    setLikeLoading(true)
    playLikeHeartAnimation(likeScale)
    try {
      if (liked) {
        await supabase.from('spot_likes').delete().eq('spot_id', spot.id).eq('user_id', userId)
        setLiked(false)
        setLikeCount((c) => c - 1)
        logUserEvent({ eventType: 'unlike', spotId: spot.id, userId })
      } else {
        await supabase.from('spot_likes').insert({ spot_id: spot.id, user_id: userId })
        setLiked(true)
        setLikeCount((c) => c + 1)
        track('spot_liked', { spot_id: spot.id })
        logUserEvent({ eventType: 'like', spotId: spot.id, userId })
      }
    } finally {
      setLikeLoading(false)
    }
  }

  const loadVlogRemaining = async () => {
    if (!VLOG_ENABLED || !userId) {
      setVlogRemaining(null)
      return
    }
    try {
      const plates = await fetchVisitPlates(userId)
      setVlogRemaining(computeVlogProgressFromPlates(plates).remaining)
    } catch {
      setVlogRemaining(null)
    }
  }

  const openVisitSheet = () => {
    if (!REVIEW_ALBUM_TAB_ENABLED) return
    setShowVisitSheet(true)
    if (VLOG_ENABLED) void loadVlogRemaining()
  }

  const recordVisitTap = async () => {
    if (!spot || visitRecording || visitRecordInFlight.current) return
    if (!requireAuth('チェックインするにはログインしてください。')) return
    if (!userId) return
    visitRecordInFlight.current = true
    setVisitRecording(true)
    try {
      const result = await recordSpotVisit(userId, spot.id, 'detail_button')
      if (!result.ok) {
        const detail = result.error ? formatVisitRecordError(result.error) : '記録に失敗しました'
        console.warn('[recordVisitTap]', detail)
        setVisitToast({ message: detail, tone: 'error', retry: true })
        return
      }
      setCheckedIn(true)
      if (result.visitId) setVisitId(result.visitId)
      if (result.created) track('spot_checked_in', { spot_id: spot.id })
      if (REVIEW_ALBUM_TAB_ENABLED) {
        openVisitSheet()
      } else {
        setVisitToast({ message: '行ったを記録しました', tone: 'success' })
      }
    } finally {
      visitRecordInFlight.current = false
      setVisitRecording(false)
    }
  }

  const openReviewAlbum = () => {
    if (!REVIEW_ALBUM_TAB_ENABLED || !spot) return
    setShowVisitSheet(false)
    track('visited_button_review_flow_tapped', { spot_id: spot.id })
    router.push('/(tabs)/camera')
  }

  const share = async (platform: string) => {
    if (!spot) return
    const shareId = isSpotUuid(spot.id) ? spot.id : isSpotUuid(spotId) ? spotId : spot.id
    const url = wanspotPublicUrl(`/spots/${encodeURIComponent(shareId)}`)
    const text = `${spot.name}｜ワンちゃんと行けるスポット見つけた🐾 #wanspot`
    if (platform === 'x') {
      const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
      await Linking.openURL(u)
    } else if (platform === 'line') {
      await Linking.openURL(`https://line.me/R/msg/text/?${encodeURIComponent(`${text}\n${url}`)}`)
    } else if (platform === 'copy') {
      await Share.share({ message: `${text}\n${url}` })
    }
    setShowShareSheet(false)
  }

  const displayRating = googleRating ?? spot?.rating ?? null
  const reviewCountLabel = googleReviewCount != null ? `${googleReviewCount}件` : null
  const distanceLabel =
    userCoords && spot?.lat != null && spot?.lng != null
      ? formatDistanceLabel(calcDistanceMeters(userCoords.lat, userCoords.lng, spot.lat, spot.lng))
      : null
  const mapMiniUrl =
    spot?.lat != null && spot?.lng != null ? buildSpotMapMiniUrl(spot.lat, spot.lng) : ''
  const openStatus = getSpotOpenStatus(openingHours, openNow)
  const displayPrice = formatPriceDisplay(googlePriceLabel ?? spot?.price_label, googlePriceLevel ?? spot?.price_level)
  const igUrl = spot?.instagram_id?.trim()
    ? `https://www.instagram.com/${spot.instagram_id.replace(/^@/, '')}/`
    : `https://www.google.com/search?q=${encodeURIComponent(spot?.name ? `${spot.name} Instagram` : 'Instagram')}`
  const displayAddress = spot?.address ?? googleAddress
  const fixedBottomPad = FIXED_ACTION_H + 16 + insets.bottom

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x
    const i = Math.round(x / WIN_W)
    setCurrentPhoto(Math.max(0, Math.min(i, Math.max(0, photoRefs.length - 1))))
  }

  const placeIdTrimmed = spot?.place_id?.trim() ?? ''
  const mapsUrl =
    placeIdTrimmed.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot!.name)}&query_place_id=${encodeURIComponent(placeIdTrimmed)}`
      : spot?.lat != null && spot?.lng != null && Number.isFinite(spot.lat) && Number.isFinite(spot.lng)
        ? `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`
        : `https://www.google.com/maps/search/${encodeURIComponent(spot?.name ?? '')}`

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <RunningDog label="スポット詳細を読み込み中..." />
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={[styles.screen, { paddingTop: Math.max(12, insets.top) }]}>
        <Pressable style={styles.loadErrBack} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="戻る">
          <IconChevronLeft />
        </Pressable>
        <View style={styles.loadErrBody}>
          <PowState label={loadError} />
          <Pressable style={styles.loadErrRetry} onPress={() => setReloadNonce((n) => n + 1)}>
            <Text style={styles.loadErrRetryTxt}>再試行</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  if (!spot) return null

  const photoUris = photoRefs.map((r) => spotPhotoUrl(r, 'hero')).filter(Boolean) as string[]
  const heroThumb = photoUris[0] ?? null
  const aiKeywords = aiSummary?.keywords.slice(0, 3) ?? []

  return (
    <View style={styles.screen}>
      {visitToast ? (
        <Pressable
          style={[styles.toast, { bottom: fixedBottomPad + 8 }, visitToast.tone === 'error' && styles.toastErr]}
          onPress={visitToast.retry ? () => void recordVisitTap() : undefined}
          disabled={!visitToast.retry}
        >
          <Text style={[styles.toastTxt, visitToast.tone === 'error' && styles.toastTxtErr]}>
            {visitToast.message}
            {visitToast.retry ? '（タップで再試行）' : ''}
          </Text>
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: fixedBottomPad + 16 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.photoWrap, { height: HERO_H }]}>
          {photoUris.length > 0 ? (
            <>
              <FlatList
                ref={photoListRef}
                horizontal
                pagingEnabled
                data={photoUris}
                keyExtractor={(u) => u}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onPhotoScroll}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={{ width: WIN_W, height: HERO_H }} contentFit="cover" {...remoteImageExpoProps} />
                )}
                getItemLayout={(_, index) => ({ length: WIN_W, offset: WIN_W * index, index })}
              />
              <View style={[styles.heroOverlayTop, { top: Math.max(12, insets.top) }]}>
                <Pressable style={styles.heroFab} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="戻る">
                  <IconChevronLeft />
                </Pressable>
                <Pressable style={styles.heroFab} onPress={() => setShowShareSheet(true)} accessibilityLabel="シェア">
                  <IconShare />
                </Pressable>
              </View>
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeTxt}>
                  {currentPhoto + 1} / {photoUris.length}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noPhoto}>
              <View style={[styles.heroOverlayTop, { top: Math.max(12, insets.top) }]}>
                <Pressable style={styles.heroFab} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="戻る">
                  <IconChevronLeft />
                </Pressable>
                <Pressable style={styles.heroFab} onPress={() => setShowShareSheet(true)} accessibilityLabel="シェア">
                  <IconShare />
                </Pressable>
              </View>
              <IconPaw size={40} color={TOKENS.text.hint} />
              <Text style={styles.noPhotoTxt}>写真なし</Text>
            </View>
          )}
        </View>

        <View style={styles.pad}>
          <Text style={styles.h1}>{spot.name}</Text>

          <View style={styles.ratingRow}>
            <View style={styles.ratingLeft}>
              <View style={styles.gBadge}>
                <IconGoogle />
              </View>
              {displayRating != null && Number.isFinite(displayRating) ? (
                <Text style={styles.ratingStar}>★{displayRating.toFixed(1)}</Text>
              ) : null}
              {reviewCountLabel ? <Text style={styles.ratingMeta}>· {reviewCountLabel}</Text> : null}
              <Text style={styles.ratingMeta}>· {spot.category}</Text>
              {distanceLabel ? <Text style={styles.ratingMeta}>· {distanceLabel}</Text> : null}
              {openStatus !== 'unknown' ? (
                <Text
                  style={[
                    styles.openInline,
                    openStatus === 'open' ? styles.openInlineOpen : styles.openInlineClosed,
                  ]}
                >
                  · {openStatus === 'open' ? 'Open' : 'Close'}
                </Text>
              ) : null}
            </View>
            <View style={styles.linkRow}>
              <Pressable style={styles.igBtn} onPress={() => Linking.openURL(igUrl)} accessibilityLabel="Instagram">
                <IconInstagram size={18} style={{ opacity: 1 }} />
              </Pressable>
              <Pressable style={styles.mapsBtn} onPress={() => Linking.openURL(mapsUrl)} accessibilityLabel="Google Maps">
                <Image source={require('@/assets/icon-google-maps.png')} style={{ width: 20, height: 20 }} contentFit="contain" cachePolicy="memory-disk" />
              </Pressable>
            </View>
          </View>

          <View style={styles.userReviewCard}>
            <Text style={styles.userReviewTitle}>わんこの評価</Text>
            <StarRow value={userRating} onChange={(n) => void saveUserRating(n)} />
            <TextInput
              style={styles.userReviewInput}
              value={userMemo}
              onChangeText={(text) => {
                setUserMemo(text)
                saveUserMemo(text)
              }}
              placeholder={memoPlaceholder}
              placeholderTextColor={TOKENS.text.secondary}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.aiCard}>
            {aiLoading ? (
              <RunningDog label="ワンスポAIレビューを生成中..." />
            ) : aiSummary ? (
              <Pressable onPress={() => setAiExpanded((v) => !v)}>
                <Text style={styles.aiHead}>🐾 ワンスポAIレビュー</Text>
                <View style={styles.kwRow}>
                  {aiKeywords.map((tag) => (
                    <View key={tag} style={styles.kwPill}>
                      <Text style={styles.kwTxt} numberOfLines={1}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.aiBody} numberOfLines={aiExpanded ? undefined : 2}>
                  {aiSummary.summary}
                </Text>
                {!aiExpanded ? <Text style={styles.aiExpandHint}>タップで続きを読む</Text> : null}
              </Pressable>
            ) : (
              <PowState label="ワンスポAIレビューを生成できませんでした" />
            )}
          </View>

          <Pressable style={styles.mapMini} onPress={() => Linking.openURL(mapsUrl)} accessibilityLabel="Google Mapsで開く">
            {mapMiniUrl ? (
              <Image source={{ uri: mapMiniUrl }} style={styles.mapMiniImg} contentFit="cover" {...remoteImageExpoProps} />
            ) : (
              <View style={styles.mapMiniPh}>
                <Ionicons name="map-outline" size={22} color={TOKENS.text.secondary} />
              </View>
            )}
          </Pressable>

          <Pressable style={styles.detailsRow} onPress={() => setDetailsExpanded((v) => !v)}>
            <Text style={styles.detailsRowTxt}>住所・営業時間・料金</Text>
            <Text style={styles.detailsChevron}>{detailsExpanded ? '⌄' : '›'}</Text>
          </Pressable>
          {detailsExpanded ? (
            <View style={styles.detailsBody}>
              {displayAddress ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLbl}>住所</Text>
                  <Text style={styles.detailVal}>{displayAddress}</Text>
                </View>
              ) : null}
              <View style={styles.detailBlock}>
                <Text style={styles.detailLbl}>営業時間</Text>
                {openingHours?.length ? (
                  openingHours.map((line) => (
                    <Text key={line} style={styles.detailVal}>
                      {line}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.detailValMuted}>Google Mapsで確認</Text>
                )}
              </View>
              <View style={styles.detailBlock}>
                <Text style={styles.detailLbl}>料金</Text>
                {displayPrice ? (
                  <Text style={styles.detailVal}>{displayPrice}</Text>
                ) : (
                  <Text style={styles.detailValMuted}>—</Text>
                )}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.fixedActions, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.likePill, liked && styles.likePillOn]}
          onPress={() => void toggleLike()}
          disabled={likeLoading}
          accessibilityLabel="いいね"
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <IconHeart filled={liked} />
          </Animated.View>
          <Text style={styles.likePillTxt}>いいね{likeCount > 0 ? ` ${likeCount}` : ''}</Text>
        </Pressable>
        <Pressable
          style={[styles.visitPill, checkedIn && styles.visitPillDone]}
          onPress={() => {
            if (checkedIn) {
              if (REVIEW_ALBUM_TAB_ENABLED) openVisitSheet()
              return
            }
            void recordVisitTap()
          }}
          disabled={visitRecording}
          accessibilityLabel="行った"
        >
          <Text style={styles.visitPillTxt}>🐾 行った{checkedIn ? ' ✓' : ''}</Text>
        </Pressable>
      </View>

      <Modal visible={showShareSheet} transparent animationType="fade" onRequestClose={() => setShowShareSheet(false)}>
        <Pressable style={styles.shareOverlay} onPress={() => setShowShareSheet(false)}>
          <Pressable style={styles.shareBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.shareTitle}>シェアする</Text>
            <View style={styles.shareGrid}>
              <Pressable style={styles.shareX} onPress={() => void share('x')}>
                <IconX />
                <Text style={styles.shareLblW}>X</Text>
              </Pressable>
              <Pressable style={styles.shareLine} onPress={() => void share('line')}>
                <FontAwesome5 name="line" size={22} color="#fff" brand />
                <Text style={styles.shareLblW}>LINE</Text>
              </Pressable>
              <Pressable style={styles.shareCopy} onPress={() => void share('copy')}>
                <IconCopy />
                <Text style={styles.shareLbl}>コピー</Text>
              </Pressable>
            </View>
            <Pressable style={styles.cancelShare} onPress={() => setShowShareSheet(false)}>
              <Text style={styles.cancelShareTxt}>キャンセル</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {REVIEW_ALBUM_TAB_ENABLED ? (
        <Modal visible={showVisitSheet} transparent animationType="slide" onRequestClose={() => setShowVisitSheet(false)}>
          <Pressable style={styles.visitSheetOverlay} onPress={() => setShowVisitSheet(false)}>
            <Pressable style={styles.visitSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.visitSheetHandle} />
              {heroThumb ? (
                <Image source={{ uri: heroThumb }} style={styles.visitSheetThumb} contentFit="cover" {...remoteImageExpoProps} />
              ) : (
                <View style={[styles.visitSheetThumb, styles.visitSheetThumbPh]}>
                  <IconPaw size={28} color={TOKENS.text.hint} />
                </View>
              )}
              <Text style={styles.visitSheetTitle}>{spot.name}</Text>
              {VLOG_ENABLED ? (
                <Text style={styles.visitSheetSub}>
                  Vlogまで あと{vlogRemaining != null ? Math.ceil(vlogRemaining) : '—'}スポット
                </Text>
              ) : null}
              <Pressable style={styles.visitSheetPrimary} onPress={openReviewAlbum}>
                <Text style={styles.visitSheetPrimaryTxt}>★とメモをのこす</Text>
              </Pressable>
              <Pressable style={styles.visitSheetSecondary} onPress={() => setShowVisitSheet(false)}>
                <Text style={styles.visitSheetSecondaryTxt}>あとで</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TOKENS.surface.paper },
  loadErrBack: {
    marginLeft: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  loadErrBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  loadErrRetry: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: TOKENS.brand.primary,
  },
  loadErrRetryTxt: { fontSize: 15, fontWeight: '800', color: TOKENS.surface.primary },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 55,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.74)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  toastErr: { backgroundColor: '#3a2a28', borderColor: colors.error },
  toastTxt: { color: colors.textPrimary, fontWeight: '800', textAlign: 'center', fontSize: 14 },
  toastTxtErr: { color: '#fff' },
  photoWrap: { backgroundColor: TOKENS.surface.mapMuted, width: '100%', position: 'relative' },
  heroOverlayTop: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  heroFab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noPhotoTxt: { fontSize: 12, color: TOKENS.text.meta },
  pad: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  h1: { fontSize: 20, fontWeight: '800', color: TOKENS.text.primary, lineHeight: 26 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ratingLeft: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  gBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TOKENS.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingStar: { fontSize: 14, fontWeight: '800', color: TOKENS.brand.primary },
  ratingMeta: { fontSize: 12, fontWeight: '600', color: TOKENS.text.secondary },
  openInline: { fontSize: 12, fontWeight: '800' },
  openInlineOpen: { color: '#2E7D32' },
  openInlineClosed: { color: '#C62828' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  igBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  mapsBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: TOKENS.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  userReviewCard: {
    backgroundColor: TOKENS.surface.primary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    gap: 10,
  },
  userReviewTitle: { fontSize: 12, fontWeight: '800', color: TOKENS.text.secondary },
  starRow: { flexDirection: 'row', gap: 4 },
  userReviewInput: {
    minHeight: 72,
    fontSize: 13,
    lineHeight: 19,
    color: TOKENS.text.primary,
    padding: 0,
  },
  aiCard: {
    backgroundColor: 'rgba(251,107,83,0.07)',
    borderRadius: 16,
    padding: 14,
  },
  aiHead: { fontSize: 11, fontWeight: '800', color: '#C24B36', marginBottom: 8 },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kwPill: {
    backgroundColor: TOKENS.surface.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '100%',
  },
  kwTxt: { fontSize: 11, fontWeight: '700', color: '#C24B36' },
  aiBody: { fontSize: 12, lineHeight: 18, color: TOKENS.text.primary },
  aiExpandHint: { marginTop: 6, fontSize: 11, fontWeight: '700', color: TOKENS.text.secondary },
  mapMini: {
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    position: 'relative',
  },
  mapMiniImg: { width: '100%', height: '100%' },
  mapMiniPh: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: TOKENS.surface.mapMuted },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOKENS.surface.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  detailsRowTxt: { fontSize: 14, fontWeight: '700', color: TOKENS.text.primary },
  detailsChevron: { fontSize: 18, fontWeight: '700', color: TOKENS.text.secondary },
  detailsBody: {
    backgroundColor: TOKENS.surface.primary,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    marginTop: -4,
  },
  detailBlock: { gap: 4 },
  detailLbl: { fontSize: 10, fontWeight: '800', color: TOKENS.text.secondary, letterSpacing: 0.4 },
  detailVal: { fontSize: 13, lineHeight: 19, color: TOKENS.text.primary },
  detailValMuted: { fontSize: 13, color: TOKENS.text.secondary },
  fixedActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: TOKENS.surface.paper,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border.subtle,
  },
  likePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    minHeight: FIXED_ACTION_H,
    borderRadius: 999,
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  likePillOn: { backgroundColor: TOKENS.brand.tintWeak, borderColor: TOKENS.brand.tintStrong },
  likePillTxt: { fontSize: 14, fontWeight: '800', color: TOKENS.text.primary },
  visitPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: FIXED_ACTION_H,
    borderRadius: 999,
    backgroundColor: TOKENS.brand.primary,
  },
  visitPillDone: { opacity: 0.92 },
  visitPillTxt: { fontSize: 15, fontWeight: '800', color: TOKENS.surface.primary },
  shareOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  shareBox: { backgroundColor: '#fff', borderRadius: 24, padding: 24, maxWidth: 340, alignSelf: 'center', width: '100%' },
  shareTitle: { fontSize: 14, fontWeight: '700', color: '#aaa', textAlign: 'center', marginBottom: 20, letterSpacing: 0.6 },
  shareGrid: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  shareX: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#000' },
  shareLine: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#06C755' },
  shareCopy: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#f5f5f5' },
  shareLbl: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  shareLblW: { fontSize: 12, fontWeight: '700', color: '#fff' },
  cancelShare: { marginTop: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center' },
  cancelShareTxt: { fontSize: 14, fontWeight: '700', color: '#888' },
  visitSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18,12,16,0.44)',
  },
  visitSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    gap: 12,
    backgroundColor: TOKENS.surface.primary,
  },
  visitSheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(46,40,37,0.18)',
    marginBottom: 4,
  },
  visitSheetThumb: { width: '100%', height: 140, borderRadius: 16 },
  visitSheetThumbPh: { backgroundColor: TOKENS.surface.mapMuted, alignItems: 'center', justifyContent: 'center' },
  visitSheetTitle: { fontSize: 18, fontWeight: '800', color: TOKENS.text.primary, textAlign: 'center' },
  visitSheetSub: { fontSize: 13, fontWeight: '700', color: TOKENS.text.secondary, textAlign: 'center' },
  visitSheetPrimary: {
    minHeight: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.brand.primary,
  },
  visitSheetPrimaryTxt: { fontSize: 15, fontWeight: '800', color: TOKENS.surface.primary },
  visitSheetSecondary: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.surface.alt,
  },
  visitSheetSecondaryTxt: { fontSize: 14, fontWeight: '700', color: TOKENS.text.secondary },
})
