import { useCallback, useEffect, useRef, useState } from 'react'
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
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import Svg, { Circle, Path, Polygon, Text as SvgTextNode } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { RunningDog, PowState } from '@/components/DogStates'
import { IconInstagram } from '@/components/IconInstagram'
import { IconPaw } from '@/components/IconPaw'
import { HEART_ICON } from '@/lib/constants'
import { playLikeHeartAnimation } from '@/lib/playLikeHeartAnimation'
import { fetchUserWalkAreaTagsByUserId } from '@/lib/fetch-user-walk-area-tags'
import { track } from '@/lib/analytics'
import { remoteImageExpoProps } from '@/lib/images/remoteImageDefaults'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetch, wanspotFetchJson, wanspotPublicUrl } from '@/lib/wanspot-api'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import { ensureSpotId } from '@/lib/ensureSpot'
import { isPendingPlaceRouteId } from '@/lib/spot-detail-pending'
import { MAP_VISITED_CHECK_COLOR } from '@/lib/nearby/constants'
import { formatVisitRecordError, recordSpotVisit } from '@/lib/visits-memories'
import { logUserEvent } from '@/lib/user-events'
import { useDogProfile } from '@/components/dog/useDogProfile'
import type { PlaceResult } from '@/types/places'

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

type AISummary = {
  keywords: string[]
  summary: string
  wanspotRating?: { avg: number; count: number }
}

const WANSPOT_RATING_THRESHOLD = 3

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

const IconChevronLeft = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
)

const IconHeart = ({ filled }: { filled: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill={filled ? HEART_ICON.filled : 'none'} stroke={filled ? HEART_ICON.filled : HEART_ICON.strokeEmpty} strokeWidth={2}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

const IconStar = ({ filled, size = 28 }: { filled: boolean; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? colors.gold : 'none'} stroke={filled ? colors.gold : '#ddd'} strokeWidth={1.5}>
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
          <Circle cx={12} cy={12} r={10} fill={i <= level ? colors.primary : '#e8e8e8'} />
          <SvgTextNode
            x={12}
            y={12}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={yenFs}
            fill={i <= level ? colors.textPrimary : '#bbb'}
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
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round">
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
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round">
    <Path d="M9 9h10v10H9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
)

export default function SpotDetailScreen({
  spotId,
  pendingPlace = null,
}: {
  spotId: string
  pendingPlace?: PlaceResult | null
}) {
  const router = useRouter()
  const requireAuth = useRequireAuth()
  const { dog } = useDogProfile()
  const insets = useSafeAreaInsets()
  const likeScale = useRef(new Animated.Value(1)).current
  const instagramAutoFetchSent = useRef<string | null>(null)
  const photoListRef = useRef<FlatList<string>>(null)

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
  const [googleRating, setGoogleRating] = useState<number | null>(null)
  const [googlePriceLevel, setGooglePriceLevel] = useState<number | null>(null)
  const [googleAddress, setGoogleAddress] = useState<string | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [visitRecording, setVisitRecording] = useState(false)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [visitToast, setVisitToast] = useState<{
    message: string
    tone: 'success' | 'error'
    retry?: boolean
  } | null>(null)
  useEffect(() => {
    const init = async () => {
      let resolvedSpotId = spotId
      if (isPendingPlaceRouteId(spotId) && pendingPlace) {
        const ensured = await ensureSpotId(pendingPlace)
        if (!ensured) {
          router.replace('/(tabs)/search')
          return
        }
        resolvedSpotId = ensured
      }

      const [{ data: { user } }, { data: spotData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('spots').select('*').eq('id', resolvedSpotId).single(),
      ])
      if (!spotData) {
        router.replace('/(tabs)/search')
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
        myVisit,
      ] = await Promise.all([
        supabase.from('spot_likes').select('*', { count: 'exact', head: true }).eq('spot_id', resolvedSpotId),
        user
          ? supabase
              .from('spot_likes')
              .select('id')
              .eq('spot_id', resolvedSpotId)
              .eq('user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase
              .from('visits')
              .select('id')
              .eq('spot_id', resolvedSpotId)
              .eq('user_id', user.id)
              .eq('soft_deleted', false)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      setLikeCount(likeC ?? 0)
      setLiked(!!myLikeResult.data)
      setCheckedIn(!!myVisit.data)
      if (user) {
        logUserEvent({ eventType: 'spot_view', spotId: resolvedSpotId, userId: user.id })
      }

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

      wanspotFetchJson<{ keywords?: string[]; summary?: string; wanspotRating?: { avg: number; count: number } }>(
        '/api/ai-summary',
        {
          method: 'POST',
          json: {
            place_id: spotData.place_id,
            spot_id: spotData.id,
            name: spotData.name,
            category: spotData.category,
            rating: spotData.rating,
            address: spotData.address,
            reviews: detailRes?.reviews?.slice(0, 5).map((r) => r.text).filter(Boolean) ?? [],
            dogSize: dog?.size ?? undefined,
            dogBreed: dog?.breed ?? undefined,
            userContext: {
              walkAreaTags: walkTags,
              lat: posCtx?.lat ?? null,
              lng: posCtx?.lng ?? null,
            },
          },
        }
      )
        .then((json) => {
          if (json.keywords && json.summary) {
            setAiSummary({
              keywords: json.keywords,
              summary: json.summary,
              wanspotRating: json.wanspotRating,
            })
          }
        })
        .catch(() => {})
        .finally(() => setAiLoading(false))
    }
    void init()
  }, [spotId, pendingPlace, router, dog?.size, dog?.breed])

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

  const recordVisitTap = async () => {
    if (!spot || visitRecording) return
    if (!requireAuth('チェックインするにはログインしてください。')) return
    if (!userId) return
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
      setVisitToast({
        message: result.created ? '行ったを記録しました' : '本日は記録済みです',
        tone: 'success',
      })
      if (result.created) track('spot_checked_in', { spot_id: spot.id })
    } finally {
      setVisitRecording(false)
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

  const displayRating = googleRating ?? spot?.rating ?? null
  const showWanspotRating =
    aiSummary?.wanspotRating != null && aiSummary.wanspotRating.count >= WANSPOT_RATING_THRESHOLD

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

  const photoUris = photoRefs.map((r) => spotPhotoUrl(r, 'hero')).filter(Boolean) as string[]

  return (
    <View style={styles.screen}>
      {visitToast ? (
        <Pressable
          style={[styles.toast, { bottom: bottomInset }, visitToast.tone === 'error' && styles.toastErr]}
          onPress={visitToast.retry ? () => void recordVisitTap() : undefined}
          disabled={!visitToast.retry}
        >
          <Text style={styles.toastTxt}>
            {visitToast.message}
            {visitToast.retry ? '（タップで再試行）' : ''}
          </Text>
        </Pressable>
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
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={{ width: WIN_W, height: 260 }}
                    contentFit="cover"
                    {...remoteImageExpoProps}
                  />
                )}
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
              disabled={likeLoading}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <IconHeart filled={liked} />
              </Animated.View>
              <Text style={styles.actLbl}>{likeCount > 0 ? String(likeCount) : 'いいね'}</Text>
            </Pressable>
            <Pressable
              style={[styles.actHalf, checkedIn && styles.actHalfCheck]}
              onPress={() => void recordVisitTap()}
              disabled={visitRecording}
            >
              <Ionicons
                name={checkedIn ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={20}
                color={checkedIn ? MAP_VISITED_CHECK_COLOR : colors.textPrimary}
              />
              <Text style={[styles.actLbl, checkedIn && styles.actLblCheck]}>
                {checkedIn ? '行った ✓' : '行った'}
              </Text>
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
                <Image
                  source={require('@/assets/icon-google-maps.png')}
                  style={{ width: 24, height: 24 }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, styles.aiCard]}>
            {aiLoading ? (
              <RunningDog label="ワンスポAIレビューを生成中..." />
            ) : aiSummary ? (
              <>
                <View style={styles.wanspotHeadRow}>
                  <View style={styles.wanspotHeadLeft}>
                    <View style={styles.wanspotHeadPaw}>
                      <IconPaw size={11} color="#aaa" />
                    </View>
                    <Text style={styles.wanspotHeadLbl}>ワンスポAIレビュー</Text>
                  </View>
                  {showWanspotRating && aiSummary.wanspotRating ? (
                    <View style={styles.wanspotRatingRow}>
                      <Text style={styles.wanspotRatingNum}>{aiSummary.wanspotRating.avg.toFixed(1)}</Text>
                      <IconStarSm filled />
                    </View>
                  ) : null}
                </View>
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
              <PowState label="ワンスポAIレビューを生成できませんでした" />
            )}
          </View>
        </View>
      </ScrollView>

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
  screen: { flex: 1, backgroundColor: colors.paper },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 55,
    backgroundColor: colors.textPrimary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  toastErr: {
    backgroundColor: '#3a2a28',
    borderColor: colors.error,
  },
  toastTxt: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 14 },
  backFab: { position: 'absolute', left: 16, zIndex: 20 },
  fabBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiCard: {
    backgroundColor: colors.tintWeak,
    borderColor: colors.border,
  },
  catPill: { alignSelf: 'flex-start', backgroundColor: colors.tintStrong, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  catTxt: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  h1: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, lineHeight: 26 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  addr: { flex: 1, fontSize: 12, color: '#aaa', lineHeight: 18 },
  shareSm: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: colors.border,
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
    borderColor: colors.border,
  },
  actHalfLiked: { backgroundColor: '#FFF6E5', borderColor: '#f0e4c4' },
  actHalfCheck: { backgroundColor: '#E8F5E9', borderColor: MAP_VISITED_CHECK_COLOR },
  actLbl: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  actLblCheck: { color: MAP_VISITED_CHECK_COLOR },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 92,
    overflow: 'hidden',
  },
  metaSeg: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: colors.border,
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
  rateNum: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  rateDash: { fontSize: 18, fontWeight: '800', color: '#ccc' },
  priceLevelRow: { flexDirection: 'row', gap: 2, alignItems: 'center', flexShrink: 0 },
  priceQ: { fontSize: 14, fontWeight: '800', color: '#ccc', lineHeight: META_STAR_PX },
  iconSq: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wanspotHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  wanspotHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  wanspotHeadPaw: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  wanspotHeadLbl: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.2 },
  wanspotRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wanspotRatingNum: { fontSize: 16, fontWeight: '800', color: colors.gold },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  kwPill: { backgroundColor: colors.tintStrong, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  kwTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },
  aiBody: { fontSize: 14, lineHeight: 22, color: colors.textSecondary },
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
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  sheetHint: { fontSize: 14, color: '#aaa' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 8 },
  ta: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  taFoot: { fontSize: 12, color: '#aaa', lineHeight: 18 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  secondaryBtn: { backgroundColor: '#f5f5f5', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  secondaryBtnTxt: { fontSize: 14, fontWeight: '700', color: '#888' },
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
})
