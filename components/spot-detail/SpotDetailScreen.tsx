import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
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
import Svg, { Circle, Path, Polygon, Text as SvgTextNode } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import { colors } from '@/constants/colors'
import { RunningDog, PowState } from '@/components/DogStates'
import { IconInstagram } from '@/components/IconInstagram'
import { IconPaw } from '@/components/IconPaw'
import { HEART_ICON } from '@/lib/constants'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
import { fetchUserWalkAreaTagsByUserId } from '@/lib/fetch-user-walk-area-tags'
import { track } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetch, wanspotFetchJson, wanspotPublicUrl } from '@/lib/wanspot-api'

const { width: WIN_W, height: WIN_H } = Dimensions.get('window')

type IgStatus = 'unprocessed' | 'registered' | 'verified' | 'fetching' | 'not_found'

type Spot = {
  id: string
  place_id: string
  name: string
  category: string
  rating: number | null
  address: string | null
  lat: number | null
  lng: number | null
  price_level?: number | null
  instagram_id?: string | null
  ig_status?: IgStatus | string | null
  ig_last_checked?: string | null
}

type AISummary = { keywords: string[]; summary: string }

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  user_id: string
}

type DetailJson = {
  photos?: { photo_reference?: string }[]
  rating?: number
  formatted_address?: string
  price_level?: number | null
  vicinity?: string
  reviews?: { text?: string }[]
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

/** reviews への upsert。エラー時は message を返す */
async function syncUserSpotReview(
  client: SupabaseClient,
  params: { spotId: string; userId: string; rating: number; comment: string | null }
): Promise<string | null> {
  const { spotId, userId, rating, comment } = params
  if (rating > 0) {
    const { data: rows } = await client
      .from('reviews')
      .select('id')
      .eq('spot_id', spotId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    const ids = (rows ?? []).map((x: { id: string }) => x.id).filter(Boolean)
    const keepId = ids[0]
    const row = { spot_id: spotId, user_id: userId, rating, comment }
    if (keepId) {
      const dupIds = ids.slice(1)
      if (dupIds.length > 0) {
        await client.from('reviews').delete().in('id', dupIds)
      }
      const { error } = await client.from('reviews').update({ rating, comment }).eq('id', keepId)
      return error?.message ?? null
    }
    const { error } = await client.from('reviews').insert(row)
    return error?.message ?? null
  }
  const { error } = await client.from('reviews').delete().eq('spot_id', spotId).eq('user_id', userId)
  return error?.message ?? null
}

/** 1ユーザー1件（DBに複製があっても最新のみ） */
function dedupeReviewsLatestPerUser(rows: Review[]): Review[] {
  const m = new Map<string, Review>()
  for (const r of rows) {
    const prev = m.get(r.user_id)
    if (!prev || new Date(r.created_at).getTime() > new Date(prev.created_at).getTime()) m.set(r.user_id, r)
  }
  return Array.from(m.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/** 同一コメント文の重複を除く（空コメントはユーザー単位の1件のみ残すのでそのまま通す） */
function dedupeReviewsByCommentText(rows: Review[]): Review[] {
  const seen = new Set<string>()
  const out: Review[] = []
  for (const r of rows) {
    const key = (r.comment ?? '').trim()
    if (key.length === 0) {
      out.push(r)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

function dedupeReviewsForDisplay(rows: Review[]): Review[] {
  return dedupeReviewsByCommentText(dedupeReviewsLatestPerUser(rows))
}

type CheckInCommentRow = { user_id: string; comment: string | null; created_at: string }

/** 同一 user は最新1件、同一コメント文は1回だけ（パパ/ママの声用） */
function dedupeCheckInCommentsForAdvice(rows: CheckInCommentRow[]): string[] {
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const byUser = new Map<string, string>()
  for (const row of sorted) {
    const c = typeof row.comment === 'string' ? row.comment.trim() : ''
    if (!c || byUser.has(row.user_id)) continue
    byUser.set(row.user_id, c)
  }
  const seenText = new Set<string>()
  const out: string[] = []
  for (const c of byUser.values()) {
    if (seenText.has(c)) continue
    seenText.add(c)
    out.push(c)
  }
  return out
}

const IconChevronLeft = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
)

const IconHeart = ({ filled }: { filled: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill={filled ? HEART_ICON.filled : 'none'} stroke={filled ? HEART_ICON.filled : HEART_ICON.strokeEmpty} strokeWidth={2}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

const IconStar = ({ filled, size = 28 }: { filled: boolean; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#FFD84D' : 'none'} stroke={filled ? '#FFD84D' : '#ddd'} strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

/** メタカード内のレビュー星と同じ表示サイズ */
const META_STAR_PX = 14

const IconStarSm = ({ filled }: { filled: boolean }) => <IconStar filled={filled} size={META_STAR_PX} />

function PriceLevel({ level }: { level: number | null }) {
  if (level === null || level === undefined) {
    return <Text style={styles.priceQ}>?</Text>
  }
  const px = META_STAR_PX
  /** viewBox 24 内の円 (r=10) に収まる文字サイズ（デバイス px に比例） */
  const yenFs = Math.round((11 * px) / 10)
  return (
    <View style={styles.priceLevelRow}>
      {[1, 2, 3, 4].map((i) => (
        <Svg key={i} width={px} height={px} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill={i <= level ? '#FFD84D' : '#e8e8e8'} />
          <SvgTextNode
            x={12}
            y={12}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={yenFs}
            fill={i <= level ? '#1a1a1a' : '#bbb'}
            fontWeight="bold"
          >
            ¥
          </SvgTextNode>
        </Svg>
      ))}
    </View>
  )
}

const IconGoogle = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
)

const IconShare = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round">
    <Circle cx={18} cy={5} r={3} />
    <Circle cx={6} cy={12} r={3} />
    <Circle cx={18} cy={19} r={3} />
    <Path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" />
  </Svg>
)

const IconX = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
    <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </Svg>
)

const IconCopy = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round">
    <Path d="M9 9h10v10H9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
)

export default function SpotDetailScreen({ spotId }: { spotId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const likeScale = useRef(new Animated.Value(1)).current
  const instagramAutoFetchSent = useRef<string | null>(null)
  const photoListRef = useRef<FlatList<string>>(null)
  /** モーダル表示時点の評価・コメント（変更検知・未保存クローズ確認用） */
  const checkInBaselineRef = useRef<{ rating: number; comment: string } | null>(null)

  const [spot, setSpot] = useState<Spot | null>(null)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [photoRefs, setPhotoRefs] = useState<string[]>([])
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [googleRating, setGoogleRating] = useState<number | null>(null)
  const [googlePriceLevel, setGooglePriceLevel] = useState<number | null>(null)
  const [googleAddress, setGoogleAddress] = useState<string | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [checkInRating, setCheckInRating] = useState(0)
  const [checkInComment, setCheckInComment] = useState('')
  const [checkInSubmitting, setCheckInSubmitting] = useState(false)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [checkInToastMessage, setCheckInToastMessage] = useState<string | null>(null)
  const [checkInPrefillLoading, setCheckInPrefillLoading] = useState(false)
  const [checkInCommentsForOwnerAdvice, setCheckInCommentsForOwnerAdvice] = useState<string[]>([])
  const [ownerAdviceText, setOwnerAdviceText] = useState<string | null>(null)
  const [ownerAdviceLoading, setOwnerAdviceLoading] = useState(false)

  const loadReviews = useCallback(async (sId: string) => {
    const { data } = await supabase.from('reviews').select('*').eq('spot_id', sId).order('created_at', { ascending: false })
    setReviews(dedupeReviewsForDisplay((data ?? []) as Review[]))
  }, [])

  useEffect(() => {
    const init = async () => {
      const [{ data: { user } }, { data: spotData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('spots').select('*').eq('id', spotId).single(),
      ])
      if (!spotData) {
        router.replace('/(tabs)')
        return
      }
      setSpot(spotData as Spot)
      if (user) setUserId(user.id)

      const detailHttp = await wanspotFetch(
        `/api/spots/detail?place_id=${encodeURIComponent(spotData.place_id)}`
      ).catch(() => null)
      let detailRes: DetailJson | null = null
      if (detailHttp?.ok) {
        try {
          detailRes = parsePlaceDetailResponse(await detailHttp.json())
        } catch {
          detailRes = null
        }
      }

      const [
        { count: likeC },
        myLikeResult,
        myCheckIn,
      ] = await Promise.all([
        supabase.from('spot_likes').select('*', { count: 'exact', head: true }).eq('spot_id', spotId),
        user
          ? supabase.from('spot_likes').select('id').eq('spot_id', spotId).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('check_ins').select('id, rating, comment').eq('spot_id', spotId).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      setLikeCount(likeC ?? 0)
      setLiked(!!myLikeResult.data)
      setCheckedIn(!!myCheckIn.data)

      if (detailRes?.photos?.length) {
        setPhotoRefs(detailRes.photos.slice(0, 8).map((p) => p.photo_reference).filter(Boolean) as string[])
      }
      const dr = detailRes?.rating
      if (typeof dr === 'number' && Number.isFinite(dr)) setGoogleRating(dr)
      let priceLvl = priceLevelFromDetail(detailRes) ?? normalizePriceLevel((spotData as Spot).price_level)
      if (priceLvl === null && spotData.place_id && (!detailHttp || !detailHttp.ok)) {
        try {
          const br = await wanspotFetch('/api/spots/batch-details', {
            method: 'POST',
            json: { place_ids: [spotData.place_id] },
          })
          if (br.ok) {
            const bj = (await br.json()) as { details?: Record<string, { price_level?: unknown }> }
            priceLvl = normalizePriceLevel(bj.details?.[spotData.place_id]?.price_level) ?? priceLvl
          }
        } catch {
          /* ignore */
        }
      }
      setGooglePriceLevel(priceLvl)
      setGoogleAddress(detailRes?.formatted_address ?? detailRes?.vicinity ?? null)
      setLoading(false)

      const [walkTags, posCtx] = await Promise.all([
        user?.id ? fetchUserWalkAreaTagsByUserId(supabase, user.id) : Promise.resolve([] as string[]),
        Location.getCurrentPositionAsync({})
          .then((p) => ({ lat: p.coords.latitude, lng: p.coords.longitude }))
          .catch((): null => null),
      ])

      wanspotFetchJson<{ keywords?: string[]; summary?: string }>('/api/ai-summary', {
        method: 'POST',
        json: {
          place_id: spotData.place_id,
          name: spotData.name,
          category: spotData.category,
          rating: spotData.rating,
          address: spotData.address,
          reviews: detailRes?.reviews?.slice(0, 5).map((r) => r.text).filter(Boolean) ?? [],
          userContext: {
            walkAreaTags: walkTags,
            lat: posCtx?.lat ?? null,
            lng: posCtx?.lng ?? null,
          },
        },
      })
        .then((json) => {
          if (json.keywords && json.summary) setAiSummary({ keywords: json.keywords, summary: json.summary })
        })
        .catch(() => {})
        .finally(() => setAiLoading(false))

      await loadReviews(spotId)

      const { data: rawCheckInRows } = await supabase
        .from('check_ins')
        .select('user_id, comment, created_at')
        .eq('spot_id', spotId)
        .not('comment', 'is', null)

      const adviceComments = dedupeCheckInCommentsForAdvice((rawCheckInRows ?? []) as CheckInCommentRow[])
      setCheckInCommentsForOwnerAdvice(adviceComments)

      if (adviceComments.length >= 1) {
        setOwnerAdviceLoading(true)
        wanspotFetchJson<{ advice?: string }>('/api/spots/owner-advice', {
          method: 'POST',
          json: { place_id: spotData.place_id, comments: adviceComments },
        })
          .then((json) => {
            if (json.advice && typeof json.advice === 'string') setOwnerAdviceText(json.advice)
          })
          .catch(() => {})
          .finally(() => setOwnerAdviceLoading(false))
      }
    }
    void init()
  }, [spotId, router, loadReviews])

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
    if (!checkInToastMessage) return
    const t = setTimeout(() => setCheckInToastMessage(null), 2000)
    return () => clearTimeout(t)
  }, [checkInToastMessage])

  useEffect(() => {
    if (!showCheckInModal || !spot || !userId) {
      checkInBaselineRef.current = null
      return
    }
    if (!checkedIn) {
      setCheckInRating(0)
      setCheckInComment('')
      setCheckInPrefillLoading(false)
      checkInBaselineRef.current = { rating: 0, comment: '' }
      return
    }
    checkInBaselineRef.current = null
    let cancelled = false
    setCheckInPrefillLoading(true)
    void (async () => {
      const [{ data: ci }, { data: rev }] = await Promise.all([
        supabase.from('check_ins').select('rating, comment').eq('spot_id', spot.id).eq('user_id', userId).maybeSingle(),
        supabase
          .from('reviews')
          .select('rating, comment')
          .eq('spot_id', spot.id)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      let r = 0
      let c = ''
      const ciRow = ci as { rating?: number | null; comment?: string | null } | null
      const revRow = rev as { rating?: number | null; comment?: string | null } | null
      if (ciRow) {
        if (typeof ciRow.rating === 'number' && ciRow.rating > 0) r = ciRow.rating
      }
      if (revRow) {
        const rr = typeof revRow.rating === 'number' ? revRow.rating : 0
        if (rr > r) r = rr
      }
      const cFromCi = typeof ciRow?.comment === 'string' ? ciRow.comment.trim() : ''
      const cFromRev = typeof revRow?.comment === 'string' ? revRow.comment.trim() : ''
      c = cFromCi || cFromRev
      if (!cancelled) {
        setCheckInRating(r)
        setCheckInComment(c)
        setCheckInPrefillLoading(false)
        checkInBaselineRef.current = { rating: r, comment: c.trim() }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showCheckInModal, checkedIn, spot?.id, userId, spot])

  const isCheckInDirty = () => {
    const b = checkInBaselineRef.current
    if (!b) return false
    return checkInRating !== b.rating || checkInComment.trim() !== b.comment
  }

  const tryCloseCheckInModal = () => {
    if (checkInPrefillLoading) {
      setShowCheckInModal(false)
      return
    }
    if (isCheckInDirty()) {
      Alert.alert('確認', '変更は保存されません。閉じますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '閉じる', onPress: () => setShowCheckInModal(false) },
      ])
      return
    }
    setShowCheckInModal(false)
  }

  const toggleLike = async () => {
    if (!userId || !spot || likeLoading) return
    setLikeLoading(true)
    playLikeHeartAnimation(likeScale)
    try {
      if (liked) {
        await supabase.from('spot_likes').delete().eq('spot_id', spot.id).eq('user_id', userId)
        setLiked(false)
        setLikeCount((c) => c - 1)
      } else {
        await supabase.from('spot_likes').insert({ spot_id: spot.id, user_id: userId })
        setLiked(true)
        setLikeCount((c) => c + 1)
        track('spot_liked', { spot_id: spot.id })
      }
    } finally {
      setLikeLoading(false)
    }
  }

  const submitNewCheckIn = async () => {
    if (!userId || !spot || checkInSubmitting || checkedIn) return
    if (checkInRating < 1) {
      Alert.alert('', '評価をお願いします')
      return
    }
    setCheckInSubmitting(true)
    try {
      const comment = checkInComment.trim() || null
      const rating = checkInRating > 0 ? checkInRating : 0
      const payload: Record<string, unknown> = {
        spot_id: spot.id,
        user_id: userId,
        rating: checkInRating > 0 ? checkInRating : null,
        comment,
      }
      const { error: insErr } = await supabase.from('check_ins').insert(payload)
      if (insErr) {
        await supabase.from('check_ins').insert({ spot_id: spot.id, user_id: userId })
      }
      const reviewErr = await syncUserSpotReview(supabase, { spotId: spot.id, userId, rating, comment })
      if (reviewErr) {
        Alert.alert('レビュー保存エラー', reviewErr)
        return
      }
      await loadReviews(spot.id)
      setCheckedIn(true)
      setCheckInRating(0)
      setCheckInComment('')
      setShowCheckInModal(false)
      setCheckInToastMessage('行ったを記録しました')
      track('spot_checked_in', { spot_id: spot.id })
    } finally {
      setCheckInSubmitting(false)
    }
  }

  const saveCheckInEdits = async () => {
    if (!userId || !spot || checkInSubmitting || !checkedIn) return
    if (checkInRating < 1) {
      Alert.alert('', '評価をお願いします')
      return
    }
    const b = checkInBaselineRef.current
    if (b && checkInRating === b.rating && checkInComment.trim() === b.comment) {
      Alert.alert('', '変更はありません')
      return
    }
    setCheckInSubmitting(true)
    try {
      const comment = checkInComment.trim() || null
      const rating = checkInRating > 0 ? checkInRating : 0
      const ratingVal = rating > 0 ? rating : null
      const { error: upCiErr } = await supabase
        .from('check_ins')
        .update({ rating: ratingVal, comment })
        .eq('spot_id', spot.id)
        .eq('user_id', userId)
      if (upCiErr) {
        Alert.alert('保存エラー', upCiErr.message)
        return
      }
      const reviewErr = await syncUserSpotReview(supabase, { spotId: spot.id, userId, rating, comment })
      if (reviewErr) {
        Alert.alert('レビュー保存エラー', reviewErr)
        return
      }
      await loadReviews(spot.id)
      setShowCheckInModal(false)
      setCheckInToastMessage('記録を更新しました')
      checkInBaselineRef.current = { rating: checkInRating, comment: checkInComment.trim() }
    } finally {
      setCheckInSubmitting(false)
    }
  }

  const removeCheckInWithConfirm = () => {
    Alert.alert('確認', '本当に取り消しますか？この操作は元に戻せません', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '取り消す', style: 'destructive', onPress: () => void executeRemoveCheckIn() },
    ])
  }

  const executeRemoveCheckIn = async () => {
    if (!userId || !spot || checkInSubmitting) return
    setCheckInSubmitting(true)
    try {
      await supabase.from('check_ins').delete().eq('spot_id', spot.id).eq('user_id', userId)
      await supabase.from('reviews').delete().eq('spot_id', spot.id).eq('user_id', userId)
      setCheckedIn(false)
      setShowCheckInModal(false)
      setCheckInRating(0)
      setCheckInComment('')
      await loadReviews(spot.id)
    } finally {
      setCheckInSubmitting(false)
    }
  }

  const share = async (platform: string) => {
    if (!spot) return
    const url = wanspotPublicUrl(`/spots/${spotId}/share`)
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })

  const displayRating = googleRating ?? spot?.rating ?? null

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

  const bottomInset = 16 + insets.bottom

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <RunningDog label="スポット詳細を読み込み中..." />
      </View>
    )
  }

  if (!spot) return null

  const photoUris = photoRefs.map((r) => spotPhotoUrl(r, 800)).filter(Boolean) as string[]

  return (
    <View style={styles.screen}>
      {checkInToastMessage ? (
        <View style={[styles.toast, { bottom: bottomInset }]}>
          <Text style={styles.toastTxt}>{checkInToastMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.backFab, { top: Math.max(16, insets.top) }]}>
        <Pressable style={styles.fabBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="戻る">
          <IconChevronLeft />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 24 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.photoWrap, { height: 260 }]}>
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
                renderItem={({ item }) => <Image source={{ uri: item }} style={{ width: WIN_W, height: 260 }} resizeMode="cover" />}
                getItemLayout={(_, index) => ({ length: WIN_W, offset: WIN_W * index, index })}
              />
              {currentPhoto > 0 ? (
                <Pressable
                  style={[styles.photoNav, { left: 16 }]}
                  onPress={() => {
                    const next = Math.max(0, currentPhoto - 1)
                    photoListRef.current?.scrollToOffset({ offset: next * WIN_W, animated: true })
                    setCurrentPhoto(next)
                  }}
                  accessibilityLabel="前の写真"
                >
                  <IconChevronLeft />
                </Pressable>
              ) : null}
              {currentPhoto < photoUris.length - 1 ? (
                <Pressable
                  style={[styles.photoNav, { right: 16, transform: [{ scaleX: -1 }] }]}
                  onPress={() => {
                    const next = Math.min(photoUris.length - 1, currentPhoto + 1)
                    photoListRef.current?.scrollToOffset({ offset: next * WIN_W, animated: true })
                    setCurrentPhoto(next)
                  }}
                  accessibilityLabel="次の写真"
                >
                  <IconChevronLeft />
                </Pressable>
              ) : null}
              {photoUris.length > 1 ? (
                <View style={styles.dots}>
                  {photoUris.map((_, i) => (
                    <Pressable
                      key={i}
                      onPress={() => {
                        photoListRef.current?.scrollToOffset({ offset: i * WIN_W, animated: true })
                        setCurrentPhoto(i)
                      }}
                      style={[styles.dot, i === currentPhoto && styles.dotOn]}
                    />
                  ))}
                </View>
              ) : null}
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeTxt}>
                  {currentPhoto + 1} / {photoUris.length}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noPhoto}>
              <IconPaw size={40} color="#ddd" />
              <Text style={styles.noPhotoTxt}>写真なし</Text>
            </View>
          )}
        </View>

        <View style={styles.pad}>
          <View style={styles.card}>
            <View style={styles.catPill}>
              <Text style={styles.catTxt}>{spot.category}</Text>
            </View>
            <Text style={styles.h1}>{spot.name}</Text>
            <View style={styles.addrRow}>
              {(spot.address ?? googleAddress) ? (
                <Text style={styles.addr}>{spot.address ?? googleAddress}</Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <Pressable style={styles.shareSm} onPress={() => setShowShareSheet(true)} accessibilityLabel="シェア">
                <IconShare />
              </Pressable>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actHalf, liked && styles.actHalfLiked]}
              onPress={() => void toggleLike()}
              disabled={likeLoading || !userId}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <IconHeart filled={liked} />
              </Animated.View>
              <Text style={styles.actLbl}>{likeCount > 0 ? String(likeCount) : 'いいね'}</Text>
            </Pressable>
            <Pressable
              style={[styles.actHalf, checkedIn && styles.actHalfCheck]}
              onPress={() => (userId ? setShowCheckInModal(true) : Alert.alert('ログインが必要です'))}
              disabled={!userId}
            >
              <IconPaw size={16} color={checkedIn ? '#FFD84D' : '#1a1a1a'} />
              <Text style={styles.actLbl}>{checkedIn ? '行った ✓' : '行った'}</Text>
            </Pressable>
          </View>

          <View style={styles.metaCard}>
            <View style={[styles.metaSeg, { flex: 1.5 }]}>
              <View style={styles.metaStackReview}>
                <View style={styles.metaReviewTopRow}>
                  <IconGoogle />
                  <Text style={styles.metaLbl}>レビュー</Text>
                </View>
                <View style={styles.rateRow}>
                  {displayRating != null && Number.isFinite(displayRating) ? (
                    <>
                      <Text style={styles.rateNum}>{displayRating.toFixed(1)}</Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <IconStarSm key={s} filled={s <= Math.round(displayRating)} />
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.rateDash}>—</Text>
                  )}
                </View>
              </View>
            </View>
            <View style={[styles.metaSeg, { flex: 1 }]}>
              <View style={styles.metaStackPrice}>
                <Text style={[styles.metaLbl, styles.metaLblOverRate]}>価格帯</Text>
                <View style={styles.rateRow}>
                  {googlePriceLevel != null ? (
                    <PriceLevel level={googlePriceLevel} />
                  ) : (
                    <Text style={styles.rateDash}>—</Text>
                  )}
                </View>
              </View>
            </View>
            <View style={[styles.metaSegIcons, { flex: 1.5 }]}>
              <Pressable
                style={styles.iconSq}
                onPress={() =>
                  Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(spot.name + ' Instagram')}`)
                }
              >
                <IconInstagram size={24} />
              </Pressable>
              <Pressable style={styles.iconSq} onPress={() => Linking.openURL(mapsUrl)}>
                <Image source={require('@/assets/icon-google-maps.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.aiHead}>
              <IconPaw size={13} color="#FFD84D" />
              <Text style={styles.sectionLbl}>AI まとめ</Text>
            </View>
            {aiLoading ? (
              <RunningDog label="AIまとめを生成中..." />
            ) : aiSummary ? (
              <>
                <View style={styles.kwRow}>
                  {aiSummary.keywords.map((tag) => (
                    <View key={tag} style={styles.kwPill}>
                      <Text style={styles.kwTxt}>#{tag}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.aiBody}>{aiSummary.summary}</Text>
              </>
            ) : (
              <PowState label="AIまとめを生成できませんでした" />
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLbl}>みんなのレビュー</Text>
            {reviews.length === 0 ? (
              <Text style={styles.revHint}>「行った」ボタンを押すとレビューを残せます</Text>
            ) : (
              reviews.map((r, i) => (
                <View key={r.id} style={[styles.revItem, i < reviews.length - 1 && styles.revBorder]}>
                  <View style={styles.revTop}>
                    <View style={styles.revStarsWrap}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <IconStarSm key={s} filled={s <= r.rating} />
                      ))}
                    </View>
                    <View style={styles.revDateCol}>
                      <Text style={styles.revDate} numberOfLines={1}>
                        {formatDate(r.created_at)}
                      </Text>
                    </View>
                  </View>
                  {r.comment ? <Text style={styles.revComment}>{r.comment}</Text> : null}
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLbl}>パパ/ママの声</Text>
            {checkInCommentsForOwnerAdvice.length >= 1 ? (
              ownerAdviceLoading ? (
                <RunningDog label="まとめを生成中..." />
              ) : ownerAdviceText ? (
                <>
                  <Text style={styles.aiBody}>{ownerAdviceText}</Text>
                  <Text style={styles.adviceFoot}>
                    コメントは任意ですが、AIがワンちゃんオーナーへのアドバイスとして参考にさせていただきます。
                  </Text>
                </>
              ) : (
                <PowState label="まとめを生成できませんでした" />
              )
            ) : (
              <Text style={styles.revHint}>みんなの声をコメントで聞かせてね。</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={showCheckInModal} transparent animationType="slide" onRequestClose={tryCloseCheckInModal}>
        <KeyboardAvoidingView
          style={styles.checkInKeyboardRoot}
          enabled={Platform.OS === 'ios'}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <Pressable style={styles.modalBg} onPress={tryCloseCheckInModal}>
            <Pressable style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 12) }]} onPress={(e) => e.stopPropagation()}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.checkInSheetScrollContent}
              >
                <View style={styles.sheetGrab} />
                <Text style={styles.sheetTitle}>{spot.name}</Text>
                <Text style={styles.sheetHint}>評価をお願いします</Text>
                {checkInPrefillLoading && checkedIn ? (
                  <RunningDog label="読み込み中..." />
                ) : (
                  <>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Pressable key={s} onPress={() => setCheckInRating(s)} disabled={checkInSubmitting}>
                          <IconStar filled={s <= checkInRating} />
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={styles.ta}
                      value={checkInComment}
                      onChangeText={setCheckInComment}
                      placeholder="コメント（任意）"
                      placeholderTextColor="#aaa"
                      multiline
                      editable={!checkInSubmitting}
                    />
                    <Text style={styles.taFoot}>AIが学習に活用しますが、外部に公開されることはありません。</Text>
                    {checkedIn ? (
                      <>
                        <Pressable
                          style={styles.primaryBtn}
                          onPress={() => void saveCheckInEdits()}
                          disabled={checkInSubmitting || checkInPrefillLoading || checkInRating < 1}
                        >
                          <Text style={styles.primaryBtnTxt}>{checkInSubmitting ? '保存中...' : '保存する'}</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryBtn} onPress={removeCheckInWithConfirm} disabled={checkInSubmitting}>
                          <Text style={styles.secondaryBtnTxt}>{checkInSubmitting ? '処理中...' : '行ったを取り消す'}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        style={styles.primaryBtn}
                        onPress={() => void submitNewCheckIn()}
                        disabled={checkInSubmitting || checkInRating < 1}
                      >
                        <Text style={styles.primaryBtnTxt}>{checkInSubmitting ? '記録中...' : '行った！'}</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

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
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f6f3' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 55,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  toastTxt: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 14 },
  backFab: { position: 'absolute', left: 16, zIndex: 20 },
  fabBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  photoWrap: { backgroundColor: '#e8e4de', width: '100%', position: 'relative' },
  photoNav: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { width: 20, backgroundColor: '#fff' },
  photoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noPhotoTxt: { fontSize: 12, color: '#bbb' },
  pad: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  catPill: { alignSelf: 'flex-start', backgroundColor: '#FFF9E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  catTxt: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  h1: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', lineHeight: 26 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  addr: { flex: 1, fontSize: 12, color: '#aaa', lineHeight: 18 },
  shareSm: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#ebebeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  actHalfLiked: { backgroundColor: '#FFF6E5', borderColor: '#f0e4c4' },
  actHalfCheck: { backgroundColor: '#FFD84D', borderColor: '#FFD84D' },
  actLbl: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
    minHeight: 92,
    overflow: 'hidden',
  },
  metaSeg: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#ebebeb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** G の左端＝下段の点数の左端。「レビュー」は G の右隣 */
  metaStackReview: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  metaReviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    alignSelf: 'stretch',
  },
  /** 価格帯: ラベルと円マーク列の左端を揃える（高さは metaStackReview と同じ minHeight） */
  metaStackPrice: {
    width: '100%',
    minHeight: 48,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  metaSegIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  /** 点数・円行の直上ラベル（左端を下段の先頭に合わせる） */
  metaLblOverRate: { marginBottom: 6, textAlign: 'left', alignSelf: 'stretch' },
  metaLbl: { fontSize: 10, lineHeight: 14, fontWeight: '700', color: '#aaa', letterSpacing: 0.6 },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    minHeight: 28,
    alignSelf: 'stretch',
  },
  rateNum: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  rateDash: { fontSize: 18, fontWeight: '800', color: '#ccc' },
  priceLevelRow: { flexDirection: 'row', gap: 2, alignItems: 'center', flexShrink: 0 },
  priceQ: { fontSize: 14, fontWeight: '800', color: '#ccc', lineHeight: META_STAR_PX },
  iconSq: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#ebebeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionLbl: { fontSize: 12, fontWeight: '700', color: '#aaa', letterSpacing: 0.6, marginBottom: 12 },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kwPill: { backgroundColor: '#FFD84D', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  kwTxt: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  aiBody: { fontSize: 14, lineHeight: 22, color: '#555' },
  revHint: { fontSize: 14, color: '#aaa', textAlign: 'center', paddingVertical: 16 },
  revItem: { paddingBottom: 12 },
  revBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  revTop: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
    marginBottom: 6,
  },
  revStarsWrap: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  revDateCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  revDate: { fontSize: 12, color: '#bbb', textAlign: 'right' },
  revComment: { fontSize: 14, lineHeight: 22, color: '#555', marginTop: 2, alignSelf: 'stretch' },
  adviceFoot: { fontSize: 12, color: '#bbb', marginTop: 12, lineHeight: 18 },
  checkInKeyboardRoot: { flex: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: WIN_H * 0.88,
  },
  checkInSheetScrollContent: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 8,
  },
  sheetGrab: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e8e8e8', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  sheetHint: { fontSize: 14, color: '#aaa' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 8 },
  ta: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    backgroundColor: '#f7f6f3',
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    textAlignVertical: 'top',
  },
  taFoot: { fontSize: 12, color: '#aaa', lineHeight: 18 },
  primaryBtn: {
    backgroundColor: '#FFD84D',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  secondaryBtn: { backgroundColor: '#f5f5f5', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  secondaryBtnTxt: { fontSize: 14, fontWeight: '700', color: '#888' },
  shareOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  shareBox: { backgroundColor: '#fff', borderRadius: 24, padding: 24, maxWidth: 340, alignSelf: 'center', width: '100%' },
  shareTitle: { fontSize: 14, fontWeight: '700', color: '#aaa', textAlign: 'center', marginBottom: 20, letterSpacing: 0.6 },
  shareGrid: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  shareX: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#000' },
  shareLine: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#06C755' },
  shareCopy: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#f5f5f5' },
  shareLbl: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  shareLblW: { fontSize: 12, fontWeight: '700', color: '#fff' },
  cancelShare: { marginTop: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center' },
  cancelShareTxt: { fontSize: 14, fontWeight: '700', color: '#888' },
})
