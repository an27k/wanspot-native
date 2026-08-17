import { useEffect, useMemo, useRef, useState } from 'react'
import { WanspotIconHeart } from '@/components/icons/WanspotIconHeart'
import { Image } from 'expo-image'
import {
  Alert,
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
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { AppHeader } from '@/components/AppHeader'
import { LoginRequiredPanel } from '@/components/auth/LoginRequiredPanel'
import { RunningDog, PowState } from '@/components/DogStates'
import { IconGoogleMaps } from '@/components/IconGoogleMaps'
import { IconInstagram } from '@/components/IconInstagram'
import { IconPaw } from '@/components/IconPaw'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
import { submitSpotInfoTip } from '@/lib/spot-info-tips'
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
import { buildSpotShareText } from '@/lib/spot-share-text'
import {
  cancelSpotVisit,
  formatVisitRecordError,
  fetchTodaySpotVisit,
  fetchVisitPlates,
  recordSpotVisit,
  updateVisit,
} from '@/lib/visits-memories'
import { REVIEW_ALBUM_TAB_ENABLED, SPOT_INLINE_REVIEW_ENABLED, VLOG_ENABLED } from '@/lib/feature-flags'
import { pickSpotReviewMemoPlaceholder } from '@/lib/spot-review-memo'
import { logUserEvent } from '@/lib/user-events'
import { WanspotIconPaw } from '@/components/icons/WanspotIconPaw'
import { useDogProfile } from '@/components/dog/useDogProfile'
import { fetchAiSummary } from '@/lib/ai-summary'
import { withTimeout } from '@/lib/promise-timeout'
import { calcDistanceMeters, formatDistanceLabel } from '@/lib/nearby/geo'
import { petPolicyBadge, type PetPolicyBadge } from '@/lib/nearby/pet-policy'
import { formatPriceDisplay, getSpotOpenStatus } from '@/lib/business-hours'
import { getGoogleMapsIosApiKey } from '@/lib/google-maps-config'
import { computeVlogProgressFromPlates } from '@/lib/album/vlog-progress'
import type { PlaceResult } from '@/types/places'
import { useAuth } from '@/context/AuthContext'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const { width: WIN_W } = Dimensions.get('window')
const HERO_H = 290
const FIXED_ACTION_H = 56

type Spot = SpotDetailRow

type AISummary = {
  keywords: string[]
  summary: string
  /** うちの子向けの一言（共有まとめとは別レイヤー。他ユーザーには出ない） */
  personalNote?: string
  wanspotRating?: { avg: number; count: number }
  /** 'pending' = 浅い版（検索不発・サーバが裏で昇格中）。注釈を添える */
  searchState?: 'done' | 'pending'
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

const IconShare = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Circle cx={18} cy={5} r={3} />
    <Circle cx={6} cy={12} r={3} />
    <Circle cx={18} cy={19} r={3} />
    <Path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" />
  </Svg>
)

const IconHeart = ({ filled }: { filled: boolean }) => (
  <WanspotIconHeart size={20} filled={filled} />
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

const IconCopy = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M9 9h10v10H9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
)

const STAR_ROW_STYLE = { flexDirection: 'row', gap: 4 } as const

function StarRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { colors } = useAppTheme()

  return (
    <View style={STAR_ROW_STYLE}>
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
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const petBadgeToneStyles = useThemedStyles(createPetBadgeToneStyles)
  const router = useRouter()
  const { session } = useAuth()
  const requireAuth = useRequireAuth()
  const { dog, loading: dogLoading } = useDogProfile()
  const isGuest = !session
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
  const [showCancelVisitConfirm, setShowCancelVisitConfirm] = useState(false)
  /** AIレビューが空だったスポットで、知っている人から情報を教えてもらう枠 */
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipBody, setTipBody] = useState('')
  const [tipSending, setTipSending] = useState(false)
  const [tipSent, setTipSent] = useState(false)
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
      let resolvedSpotId = spotData.id
      if (!isSpotUuid(resolvedSpotId)) {
        const uuid = await ensureSpotUuidForPlace(
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
        )
        if (cancelled) return
        if (uuid && uuid !== resolvedSpotId) {
          resolvedSpotId = uuid
          spotData = { ...spotData, id: uuid }
          setSpot(spotData)
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      const user = session?.user ?? null
      if (user) setUserId(user.id)

      const canQuerySpotState = isSpotUuid(resolvedSpotId)
      const publicRowPromise = canQuerySpotState
        ? wanspotFetch(`/api/spots/row?spot_id=${encodeURIComponent(resolvedSpotId)}`, {
            auth: false,
          }).catch(() => null)
        : Promise.resolve(null)
      const likeStatePromise = canQuerySpotState
        ? Promise.all([
            supabase
              .from('spot_likes')
              .select('*', { count: 'exact', head: true })
              .eq('spot_id', resolvedSpotId),
            user
              ? supabase
                  .from('spot_likes')
                  .select('id')
                  .eq('spot_id', resolvedSpotId)
                  .eq('user_id', user.id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ])
        : Promise.resolve([{ count: 0 }, { data: null }] as const)

      // Places Detail と いいね/チェックイン状態は互いに依存しないため並列化してラウンドトリップを1回減らす
      const [detailHttp, publicRowHttp, [likeResult, myLikeResult]] = await Promise.all([
        wanspotFetch(`/api/spots/detail?place_id=${encodeURIComponent(spotData.place_id)}`).catch(() => null),
        publicRowPromise,
        likeStatePromise,
      ])
      if (cancelled) return

      if (publicRowHttp?.ok) {
        try {
          const json = (await publicRowHttp.json()) as { spot?: Partial<Spot> }
          if (json.spot?.id === resolvedSpotId) {
            spotData = { ...spotData, ...json.spot, id: resolvedSpotId }
            setSpot(spotData)
          }
        } catch {
          // Google Detailの表示は継続し、公開行の補足情報だけ諦める。
        }
      }

      let detailRes: DetailJson | null = null
      if (detailHttp?.ok) {
        try {
          detailRes = parsePlaceDetailResponse(await detailHttp.json())
        } catch {
          detailRes = null
        }
      }

      setLikeCount(likeResult.count ?? 0)
      setLiked(!!myLikeResult.data)
      if (user && canQuerySpotState) {
        const todayVisit = await fetchTodaySpotVisit(user.id, resolvedSpotId)
        if (cancelled) return
        if (todayVisit) {
          setVisitId(todayVisit.id)
          setCheckedIn(true)
          if (SPOT_INLINE_REVIEW_ENABLED) {
            setUserRating(todayVisit.rating ?? 0)
            setUserMemo(todayVisit.comment ?? '')
          }
        } else {
          setVisitId(null)
          setCheckedIn(false)
          if (SPOT_INLINE_REVIEW_ENABLED) {
            setUserRating(0)
            setUserMemo('')
          }
        }
        logUserEvent({ eventType: 'spot_view', spotId: resolvedSpotId, userId: user.id })
      } else {
        setVisitId(null)
        setCheckedIn(false)
        if (SPOT_INLINE_REVIEW_ENABLED) {
          setUserRating(0)
          setUserMemo('')
        }
        if (canQuerySpotState) {
          logUserEvent({ eventType: 'spot_view', spotId: resolvedSpotId })
        }
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
    if (isGuest) {
      setAiLoading(false)
      setAiSummary(null)
      return
    }
    const dogKey = `${dog?.size ?? 'none'}:${dog?.breed ?? 'none'}`
    const requestKey = `${spot.id}:${dogKey}:${reviewsForAi.length > 0 ? 'r1' : 'r0'}`
    if (aiRequestKeyRef.current === requestKey) return
    aiRequestKeyRef.current = requestKey

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
        dogName: dog?.name ?? undefined,
        userContext: {
          walkAreaTags: walkTags,
          lat: posCtx?.lat ?? null,
          lng: posCtx?.lng ?? null,
        },
      })
      // cancelled で捨てると、同じ requestKey の再実行が早期 return して要約が永久に出ない。
      // 「最新のリクエストか」で判定すれば、重複した再実行があっても結果は活きる
      if (aiRequestKeyRef.current === requestKey && result) setAiSummary(result)
    })().finally(() => {
      // 自分が最新リクエストのときだけローディングを下ろす（新しい取得が始まっていれば触らない）。
      // ここを cancelled で判定すると、再実行が早期 return したときに「生成中...」が固まる
      if (aiRequestKeyRef.current === requestKey) setAiLoading(false)
    })
  }, [spot, loading, dogLoading, dog?.size, dog?.breed, userId, reviewsForAi, isGuest])

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

  useEffect(() => {
    if (loading || !spot) return
    const placeId = spot.place_id
    if (instagramAutoFetchSent.current === placeId) return
    if (spot.instagram_lookup_due !== true) return

    instagramAutoFetchSent.current = placeId
    wanspotFetchJson<{
      ok?: boolean
      instagram_id?: string | null
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
                instagram_lookup_due: false,
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
    if (!spot || !userId || !isSpotUuid(spot.id)) return null
    const result = await recordSpotVisit(userId, spot.id, 'review')
    if (!result.ok || !result.visitId) return null
    setVisitId(result.visitId)
    setCheckedIn(true)
    return result.visitId
  }

  const saveUserRating = async (rating: number) => {
    if (!SPOT_INLINE_REVIEW_ENABLED || !spot || !checkedIn) return
    if (!requireAuth('評価はアカウントに保存されます。', 'spot_rating')) return
    if (!userId) return
    const id = await ensureVisitId()
    if (!id) return
    const saved = await updateVisit(id, { rating })
    if (saved) {
      setUserRating(rating)
    } else {
      setVisitToast({ message: '評価の保存に失敗しました', tone: 'error', retry: true })
    }
  }

  const saveUserMemo = (comment: string) => {
    if (!SPOT_INLINE_REVIEW_ENABLED || !checkedIn) return
    if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current)
    memoDebounceRef.current = setTimeout(() => {
      void (async () => {
        if (!spot || !userId || !checkedIn) return
        if (!requireAuth('メモはアカウントに保存されます。', 'spot_memo')) return
        const id = await ensureVisitId()
        if (!id) return
        await updateVisit(id, { comment: comment.trim() || null })
      })()
    }, 800)
  }

  const submitTip = async () => {
    if (!spot || tipSending) return
    if (!requireAuth('情報の送信にはアカウントが必要です。', 'spot_tip')) return
    setTipSending(true)
    try {
      const result = await submitSpotInfoTip(spot.id, tipBody)
      if (result.ok) {
        setTipSent(true)
        setTipBody('')
        // お礼を見せてから静かに閉じる
        setTimeout(() => {
          setShowTipModal(false)
          setTipSent(false)
        }, 1600)
      } else {
        Alert.alert('送信できませんでした', result.message)
      }
    } finally {
      setTipSending(false)
    }
  }

  const toggleLike = async () => {
    if (!spot || likeLoading) return
    if (!requireAuth('いいねはアカウントに保存されます。', 'spot_like')) return
    if (!userId) return
    if (!isSpotUuid(spot.id)) {
      setVisitToast({
        message: 'スポット情報を準備できませんでした。画面を再読み込みしてください。',
        tone: 'error',
        retry: true,
      })
      return
    }
    setLikeLoading(true)
    playLikeHeartAnimation(likeScale)
    try {
      if (liked) {
        const { error } = await supabase
          .from('spot_likes')
          .delete()
          .eq('spot_id', spot.id)
          .eq('user_id', userId)
        if (error) throw error
        setLiked(false)
        setLikeCount((c) => Math.max(0, c - 1))
        logUserEvent({ eventType: 'unlike', spotId: spot.id, userId })
      } else {
        const { error } = await supabase
          .from('spot_likes')
          .insert({ spot_id: spot.id, user_id: userId })
        if (error) throw error
        setLiked(true)
        setLikeCount((c) => c + 1)
        track('spot_liked', { spot_id: spot.id })
        logUserEvent({ eventType: 'like', spotId: spot.id, userId })
      }
    } catch (error) {
      console.warn('[toggleLike] failed', error)
      setVisitToast({ message: 'いいねの更新に失敗しました', tone: 'error', retry: true })
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

  const resetVisitState = () => {
    setCheckedIn(false)
    setVisitId(null)
    if (SPOT_INLINE_REVIEW_ENABLED) {
      setUserRating(0)
      setUserMemo('')
    }
  }

  const cancelVisitTap = () => {
    if (!spot || !userId || visitRecording || visitRecordInFlight.current) return
    setShowCancelVisitConfirm(true)
  }

  const confirmCancelVisit = () => {
    if (!spot || !userId || visitRecording || visitRecordInFlight.current) return
    if (!isSpotUuid(spot.id)) {
      setVisitToast({
        message: 'スポット情報を準備できませんでした。画面を再読み込みしてください。',
        tone: 'error',
        retry: true,
      })
      return
    }
    setShowCancelVisitConfirm(false)
    void (async () => {
      visitRecordInFlight.current = true
      setVisitRecording(true)
      try {
        const result = await cancelSpotVisit(userId, spot.id)
        if (!result.ok) {
          setVisitToast({ message: '取り消しに失敗しました', tone: 'error', retry: true })
          return
        }
        resetVisitState()
      } finally {
        visitRecordInFlight.current = false
        setVisitRecording(false)
      }
    })()
  }

  const recordVisitTap = async () => {
    if (!spot || visitRecording || visitRecordInFlight.current) return
    if (!requireAuth('行った記録はアカウントに保存されます。', 'spot_checkin')) return
    if (!userId) return
    if (!isSpotUuid(spot.id)) {
      setVisitToast({
        message: 'スポット情報を準備できませんでした。画面を再読み込みしてください。',
        tone: 'error',
        retry: true,
      })
      return
    }
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
      if (REVIEW_ALBUM_TAB_ENABLED) openVisitSheet()
    } finally {
      visitRecordInFlight.current = false
      setVisitRecording(false)
    }
  }

  const visitPillTap = () => {
    if (checkedIn) {
      cancelVisitTap()
      return
    }
    void recordVisitTap()
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
    // 属性ベースの共有文。犬の名前・サイズは入れない
    let highlights = spot.dog_fact_highlights ?? []
    if (highlights.length === 0) {
      const q = isSpotUuid(shareId)
        ? `spot_id=${encodeURIComponent(shareId)}`
        : spot.place_id
          ? `place_id=${encodeURIComponent(spot.place_id)}`
          : null
      if (q) {
        const res = await wanspotFetch(`/api/spots/row?${q}`).catch(() => null)
        if (res?.ok) {
          try {
            const json = (await res.json()) as { spot?: { dog_fact_highlights?: unknown } }
            const raw = json.spot?.dog_fact_highlights
            if (Array.isArray(raw)) {
              highlights = raw
                .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
                .slice(0, 3)
              if (highlights.length > 0) {
                setSpot((prev) => (prev ? { ...prev, dog_fact_highlights: highlights } : prev))
              }
            }
          } catch {
            /* 共有はフォールバック文で続行 */
          }
        }
      }
    }
    const text = buildSpotShareText(spot.name, highlights)
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
      <View style={styles.screen}>
        <AppHeader variant="back" onBack={() => router.back()} />
        <View style={styles.loadErrBody}>
          <RunningDog label="スポット詳細を読み込み中..." />
        </View>
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={styles.screen}>
        <AppHeader variant="back" onBack={() => router.back()} />
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
  // ペット同伴可否バッジ。確認済みデータがあるときだけ表示する（根拠が見えることが信頼につながる）
  const petBadge = petPolicyBadge(spot)

  return (
    <View style={styles.screen}>
      <AppHeader
        variant="back"
        onBack={() => router.back()}
        rightSlot={
          <Pressable style={styles.headerAction} onPress={() => setShowShareSheet(true)} accessibilityLabel="シェア">
            <IconShare color={colors.text} />
          </Pressable>
        }
      />
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
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeTxt}>
                  {currentPhoto + 1} / {photoUris.length}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noPhoto}>
              <IconPaw size={40} color={colors.textHint} />
              <Text style={styles.noPhotoTxt}>写真なし</Text>
            </View>
          )}
        </View>

        <View style={styles.pad}>
          <Text style={styles.h1}>{spot.name}</Text>

          {petBadge ? (
            <View style={styles.petBadgeRow}>
              <View style={[styles.petBadge, petBadgeToneStyles[petBadge.tone].pill]}>
                <Text style={[styles.petBadgeTxt, petBadgeToneStyles[petBadge.tone].txt]}>
                  {petBadge.label}
                </Text>
              </View>
            </View>
          ) : null}

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
                <IconInstagram size={18} />
              </Pressable>
              <Pressable style={styles.mapsBtn} onPress={() => Linking.openURL(mapsUrl)} accessibilityLabel="Google Maps">
                <IconGoogleMaps size={20} />
              </Pressable>
            </View>
          </View>

          {SPOT_INLINE_REVIEW_ENABLED && checkedIn ? (
            <View style={styles.userReviewCard}>
              <View style={styles.userReviewHead}>
                <Text style={styles.userReviewTitle}>あなたの評価</Text>
                <Text style={styles.userReviewDisclaimer}>
                  ※この情報は公開されずAIが学習して提案する内容に反映されます。
                </Text>
              </View>
              <StarRow value={userRating} onChange={(n) => void saveUserRating(n)} />
              <View style={styles.userReviewMemoFrame}>
                <TextInput
                  style={styles.userReviewInput}
                  value={userMemo}
                  onChangeText={(text) => {
                    setUserMemo(text)
                    saveUserMemo(text)
                  }}
                  placeholder={memoPlaceholder}
                  placeholderTextColor={colors.textHint}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
          ) : null}

          {isGuest ? (
            <LoginRequiredPanel
              variant="card"
              title="ワンスポ AIレビュー"
              body="うちの子の年齢やサイズに合わせた読み方は、ログイン後に表示します。住所・営業時間・地図はこのまま見られます。"
              feature="spot_ai_review"
            />
          ) : (
          <View style={styles.aiCard}>
            {aiLoading ? (
              <RunningDog label="ワンスポAIレビューを生成中..." />
            ) : aiSummary ? (
              <Pressable onPress={() => setAiExpanded((v) => !v)}>
                {/* 絵文字は iOS の標準UIに出てこない。既存の肉球アイコンに置き換える */}
                <View style={styles.aiHeadRow}>
                  <WanspotIconPaw size={13} color={colors.pillText} />
                  <Text style={styles.aiHead}>ワンスポ AIレビュー</Text>
                </View>
                <View style={styles.kwRow}>
                  {aiKeywords.map((tag) => (
                    <View key={tag} style={styles.kwPill}>
                      <Text style={styles.kwTxt} numberOfLines={1}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.aiBody} numberOfLines={aiExpanded ? undefined : 3}>
                  {aiSummary.summary}
                </Text>
                {aiSummary.personalNote ? (
                  <View style={styles.personalNote}>
                    <WanspotIconPaw size={13} color={colors.pillText} />
                    <Text style={styles.personalNoteTxt}>{aiSummary.personalNote}</Text>
                  </View>
                ) : null}
                {aiSummary.searchState === 'pending' ? (
                  <Text style={styles.aiPendingHint}>さらにくわしい情報を調べています</Text>
                ) : null}
                {!aiExpanded ? <Text style={styles.aiExpandHint}>タップで続きを読む</Text> : null}
              </Pressable>
            ) : (
              <View style={styles.aiEmptyBox}>
                {/*
                  謝らずに事実を言う。ネット上に犬連れ情報が無いスポットは実在し、
                  それはアプリの失敗ではない。代わりに、知っている飼い主から
                  教えてもらう枠を出す（検索では埋まらない層の唯一の入口）
                */}
                <Text style={styles.aiEmptyTxt}>
                  このスポットの犬連れ情報は、ネット上に見つかりませんでした。
                </Text>
                <Pressable style={styles.aiTipBtn} onPress={() => setShowTipModal(true)}>
                  <WanspotIconPaw size={14} color={colors.pillText} />
                  <Text style={styles.aiTipBtnTxt}>ご存じの情報があれば教えてください</Text>
                </Pressable>
              </View>
            )}
          </View>
          )}

          <Pressable style={styles.mapMini} onPress={() => Linking.openURL(mapsUrl)} accessibilityLabel="Google Mapsで開く">
            {mapMiniUrl ? (
              <Image source={{ uri: mapMiniUrl }} style={styles.mapMiniImg} contentFit="cover" {...remoteImageExpoProps} />
            ) : (
              <View style={styles.mapMiniPh}>
                <Ionicons name="map-outline" size={22} color={colors.textSecondary} />
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
          onPress={visitPillTap}
          disabled={visitRecording}
          accessibilityLabel="行った"
        >
          <View style={styles.visitPillInner}>
            {checkedIn ? (
              <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
            ) : (
              <IconPaw size={16} color={colors.onPrimary} />
            )}
            <Text style={styles.visitPillTxt}>行った</Text>
          </View>
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
                <IconCopy color={colors.text} />
                <Text style={styles.shareLbl}>コピー</Text>
              </Pressable>
            </View>
            <Pressable style={styles.cancelShare} onPress={() => setShowShareSheet(false)}>
              <Text style={styles.cancelShareTxt}>キャンセル</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showCancelVisitConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelVisitConfirm(false)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setShowCancelVisitConfirm(false)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.confirmTitle}>行ったを取り消しますか？</Text>
            <Text style={styles.confirmBody}>「行った」の記録と、あなたの評価は削除されます。</Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setShowCancelVisitConfirm(false)}
              >
                <Text style={styles.confirmCancelTxt}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.confirmDestructiveBtn} onPress={confirmCancelVisit}>
                <Text style={styles.confirmDestructiveTxt}>取り消す</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTipModal} transparent animationType="fade" onRequestClose={() => setShowTipModal(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setShowTipModal(false)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
            {tipSent ? (
              <>
                <Text style={styles.confirmTitle}>ありがとうございます！</Text>
                <Text style={styles.confirmBody}>いただいた情報は、犬連れ情報の充実に使わせていただきます。</Text>
              </>
            ) : (
              <>
                <Text style={styles.confirmTitle}>このスポットの犬連れ情報</Text>
                <Text style={styles.confirmBody}>
                  行ったことがあれば、わかる範囲で教えてください。{'\n'}
                  例: 店内OKだった・テラスのみ・大型犬もいた・足洗い場があった
                </Text>
                <TextInput
                  style={styles.tipInput}
                  value={tipBody}
                  onChangeText={setTipBody}
                  placeholder="例: 店内は小型犬のみOKでした。入口に水飲み場あり"
                  placeholderTextColor={colors.textHint}
                  multiline
                  maxLength={1000}
                  editable={!tipSending}
                />
                <View style={styles.confirmActions}>
                  <Pressable style={styles.confirmCancelBtn} onPress={() => setShowTipModal(false)} disabled={tipSending}>
                    <Text style={styles.confirmCancelTxt}>閉じる</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tipSendBtn, (tipSending || !tipBody.trim()) && styles.tipSendBtnOff]}
                    onPress={() => void submitTip()}
                    disabled={tipSending || !tipBody.trim()}
                  >
                    <Text style={styles.tipSendTxt}>{tipSending ? '送信中…' : '送る'}</Text>
                  </Pressable>
                </View>
              </>
            )}
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
                  <IconPaw size={28} color={colors.textHint} />
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

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  loadErrBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  loadErrRetry: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  loadErrRetryTxt: { ...type.button, color: colors.onPrimary },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 55,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  toastErr: { backgroundColor: colors.errorMutedBg, borderColor: colors.error },
  // 失敗理由まで読ませるトーストなので本文サイズ。太字をやめても画面に1つしか出ないので埋もれない
  toastTxt: { ...type.body, color: colors.textPrimary, textAlign: 'center' as const },
  toastTxtErr: { color: colors.error },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  photoWrap: { backgroundColor: colors.mapMuted, width: '100%', position: 'relative' },
  photoBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoBadgeTxt: { ...type.label, color: '#fff' },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noPhotoTxt: { ...type.caption, color: colors.textMeta },
  pad: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  h1: { ...type.title, color: colors.text },
  petBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4 },
  petBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  petBadgeTxt: { ...type.label },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ratingLeft: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  gBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 評価・件数・カテゴリ・距離・営業状態は同じ13pxのメタ行に揃え、★と開閉だけ太さと色で立てる
  ratingStar: { ...type.caption, fontWeight: '800' as const, color: colors.primary },
  ratingMeta: { ...type.caption, color: colors.textSecondary },
  openInline: { ...type.caption, fontWeight: '800' as const },
  openInlineOpen: { color: colors.success },
  openInlineClosed: { color: colors.error },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  igBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapsBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  userReviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  userReviewHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 6,
  },
  userReviewTitle: { ...type.label, color: colors.textSecondary },
  // 「公開されない」は読まれて初めて意味がある注記なので、10pxのままにはしない
  userReviewDisclaimer: {
    ...type.caption,
    flex: 1,
    minWidth: 160,
    color: colors.textMeta,
  },
  userReviewMemoFrame: {
    backgroundColor: colors.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // 自分で書いて後から読み返す欄。入力欄は本文サイズにする
  userReviewInput: {
    ...type.body,
    minHeight: 72,
    color: colors.text,
    padding: 0,
  },
  aiCard: {
    backgroundColor: colors.tintWeak,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.tintStrong,
  },
  aiHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiHead: { ...type.label, color: colors.pillText },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kwPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '100%',
  },
  kwTxt: { ...type.label, color: colors.pillText },
  aiBody: { ...type.body, color: colors.text },
  // うちの子向けの一言。共有まとめと視覚的に分けて「自分ごと」だと分かるようにする
  personalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.tintStrong,
  },
  // うちの子への助言そのもの。まとめ本文と同じ本文サイズで読ませ、色と区切り線で自分ごとだと示す
  personalNoteTxt: { ...type.body, flex: 1, color: colors.pillText },
  aiExpandHint: { ...type.label, marginTop: 6, color: colors.textSecondary },
  mapMini: {
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  mapMiniImg: { width: '100%', height: '100%' },
  mapMiniPh: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mapMuted },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsRowTxt: { ...type.row, color: colors.text },
  // ⌄ / › は文字ではなくシェブロン。行の文字と一緒に動かさない
  detailsChevron: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  detailsBody: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: -4,
  },
  detailBlock: { gap: 4 },
  detailLbl: { ...type.label, color: colors.textSecondary },
  detailVal: { ...type.caption, color: colors.text },
  detailValMuted: { ...type.caption, color: colors.textSecondary },
  fixedActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  likePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: FIXED_ACTION_H,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  likePillOn: { backgroundColor: colors.tintWeak, borderColor: colors.tintStrong },
  likePillTxt: { ...type.button, color: colors.text },
  visitPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: FIXED_ACTION_H,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  visitPillDone: { opacity: 0.92 },
  visitPillInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitPillTxt: { ...type.button, color: colors.onPrimary },
  shareOverlay: { flex: 1, backgroundColor: colors.overlayScrim, justifyContent: 'center', padding: 20 },
  shareBox: { backgroundColor: colors.surfaceRaised, borderRadius: 24, padding: 24, maxWidth: 340, alignSelf: 'center', width: '100%' },
  // 元から字間を空けたグレーの小見出し。役割どおりマイクロラベルに寄せる
  shareTitle: { ...type.label, color: colors.textMuted, textAlign: 'center' as const, marginBottom: 20 },
  shareGrid: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  shareX: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#000' },
  shareLine: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#06C755' },
  shareCopy: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.surfaceAlt },
  // アイコンの下に置く名前なのでボタンではなくラベル。サイズは上げない
  shareLbl: { ...type.label, color: colors.text },
  shareLblW: { ...type.label, color: '#fff' },
  cancelShare: { marginTop: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  cancelShareTxt: { ...type.button, color: colors.textSecondary },
  confirmOverlay: {
    flex: 1,
    backgroundColor: colors.overlayScrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  /* AIレビューが空のときの案内と情報提供 */
  aiEmptyBox: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  aiEmptyTxt: { ...type.caption, fontSize: 14, color: colors.textSecondary, textAlign: 'center' as const },
  aiTipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.tintWeak,
  },
  aiTipBtnTxt: { ...type.button, fontSize: 14, color: colors.pillText },
  aiPendingHint: { ...type.label, marginTop: 6, color: colors.textHint },
  tipInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...type.row,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top' as const,
  },
  tipSendBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipSendBtnOff: { opacity: 0.5 },
  tipSendTxt: { ...type.button, fontSize: 15, color: '#FFFFFF' },
  confirmTitle: {
    ...type.heading,
    color: colors.text,
    textAlign: 'center' as const,
  },
  confirmBody: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
  },
  confirmCancelTxt: {
    ...type.button,
    color: colors.textSecondary,
  },
  confirmDestructiveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.errorMutedBg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  confirmDestructiveTxt: {
    ...type.button,
    color: colors.error,
  },
  visitSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlayScrim,
  },
  visitSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    gap: 12,
    backgroundColor: colors.surfaceRaised,
  },
  visitSheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderEmphasis,
    marginBottom: 4,
  },
  visitSheetThumb: { width: '100%', height: 140, borderRadius: 16 },
  visitSheetThumbPh: { backgroundColor: colors.mapMuted, alignItems: 'center', justifyContent: 'center' },
  // シートの見出し＝スポット名。ヒーローの h1 と同じ型にして「このお店の記録」だと一目で分かるようにする
  visitSheetTitle: { ...type.title, color: colors.text, textAlign: 'center' as const },
  visitSheetSub: { ...type.caption, color: colors.textSecondary, textAlign: 'center' as const },
  visitSheetPrimary: {
    minHeight: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  visitSheetPrimaryTxt: { ...type.button, color: colors.onPrimary },
  visitSheetSecondary: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  visitSheetSecondaryTxt: { ...type.button, color: colors.textSecondary },
})

/** 同伴可否バッジの色分け: 確認済みOK=グリーン / テラスのみ=アンバー / 同伴不可の可能性=グレー */
const createPetBadgeToneStyles = (
  colors: AppColors
): Record<PetPolicyBadge['tone'], { pill: object; txt: object }> => ({
  ok: {
    pill: { backgroundColor: colors.successMutedBg, borderColor: colors.success },
    txt: { color: colors.success },
  },
  terrace: {
    pill: { backgroundColor: colors.surfaceAlt, borderColor: colors.warning },
    txt: { color: colors.warning },
  },
  caution: {
    pill: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderEmphasis },
    txt: { color: colors.textSecondary },
  },
})
