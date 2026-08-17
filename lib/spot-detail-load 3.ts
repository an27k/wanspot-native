import type { PlaceResult } from '@/types/places'
import { ensureSpotId } from '@/lib/ensureSpot'
import { peekSpotDetailHandoff } from '@/lib/spot-detail-handoff'
import {
  getSpotDetailPlaceCache,
  getSpotDetailUuidCache,
  peekSpotDetailPlaceCache,
  placeRouteId,
} from '@/lib/spot-detail-cache'
import { extractPlaceIdFromRouteId } from '@/lib/spot-detail-pending'
import { readStashedSpotDetailPlace } from '@/lib/spot-detail-stash'
import { wanspotFetch } from '@/lib/wanspot-api'

export const SPOT_DETAIL_SELECT =
  'id, place_id, name, category, rating, address, lat, lng, price_level, price_label, instagram_id, instagram_lookup_due'

export type SpotDetailRow = {
  id: string
  place_id: string
  name: string
  category: string
  rating: number | null
  address: string | null
  lat: number | null
  lng: number | null
  price_level?: number | null
  price_label?: string | null
  instagram_id?: string | null
  instagram_lookup_due?: boolean
  /** ペット同伴可否（共通コントラクト。/api/spots/row やハンドオフ元の PlaceResult から引き継ぐ） */
  pet_indoor_allowed?: boolean | null
  pet_terrace_only?: boolean | null
  pet_friendly_status?: string | null
  pet_friendly_verified?: boolean | null
  /** 構造化属性の短いラベル（共有文用。犬情報は含めない） */
  dog_fact_highlights?: string[]
}

type ResolveOk = { ok: true; spot: SpotDetailRow; resolvedId: string }
type ResolveErr = { ok: false; message: string; retryable: boolean }

export function isSpotUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value.trim())
}

export function spotRowFromPlace(routeId: string, place: PlaceResult, resolvedId?: string): SpotDetailRow {
  const cachedUuid = getSpotDetailUuidCache(place.place_id)
  const id = resolvedId ?? cachedUuid ?? (isSpotUuid(routeId) ? routeId : routeId)
  return {
    id,
    place_id: place.place_id,
    name: place.name,
    category: place.category,
    rating: place.rating,
    address: place.address?.trim() ? place.address.trim() : null,
    lat: place.lat,
    lng: place.lng,
    price_level: place.price_level,
    price_label: place.price_label,
    pet_indoor_allowed: place.pet_indoor_allowed ?? null,
    pet_terrace_only: place.pet_terrace_only ?? null,
    pet_friendly_status: place.pet_friendly_status ?? null,
    pet_friendly_verified: place.pet_friendly_verified ?? null,
  }
}

/** wanspot `/api/spots/detail` は geometry なしのフラット JSON を返す */
function placeFromDetailJson(json: unknown, placeId: string, fallbackName: string): PlaceResult | null {
  if (!json || typeof json !== 'object') return null
  const root = json as Record<string, unknown>
  if (typeof root.error === 'string' && root.error.length > 0) return null
  const o = (root.result && typeof root.result === 'object' ? root.result : root) as Record<string, unknown>
  const name =
    (typeof o.name === 'string' && o.name.trim()) || fallbackName.trim() || 'スポット'
  const addr =
    (typeof o.formatted_address === 'string' && o.formatted_address.trim()) ||
    (typeof o.vicinity === 'string' && o.vicinity.trim()) ||
    ''
  const geom = o.geometry as { location?: { lat?: number; lng?: number } } | undefined
  const latRaw = geom?.location?.lat ?? o.lat
  const lngRaw = geom?.location?.lng ?? o.lng
  const lat = typeof latRaw === 'number' && Number.isFinite(latRaw) ? latRaw : 0
  const lng = typeof lngRaw === 'number' && Number.isFinite(lngRaw) ? lngRaw : 0
  const rating = typeof o.rating === 'number' && Number.isFinite(o.rating) ? o.rating : null
  const priceRaw = o.price_level ?? o.priceLevel
  const price_level =
    typeof priceRaw === 'number' && Number.isFinite(priceRaw) ? Math.max(0, Math.min(4, Math.round(priceRaw))) : null
  const types = o.types
  const typeStrings = Array.isArray(types) ? types.filter((t): t is string => typeof t === 'string') : []
  const category = typeStrings[0] ?? 'establishment'
  const priceLabelRaw = o.price_label ?? o.priceLabel
  const price_label =
    typeof priceLabelRaw === 'string' && priceLabelRaw.trim().length > 0 ? priceLabelRaw.trim() : null
  // ペット可否（共通コントラクト）。サーバー未対応・未確認は null = unknown として扱う
  const petFlag = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
  const pet_friendly_status =
    typeof o.pet_friendly_status === 'string' && o.pet_friendly_status.trim().length > 0
      ? o.pet_friendly_status.trim()
      : null
  return {
    place_id: placeId,
    name,
    category,
    address: addr,
    lat,
    lng,
    photo_ref: null,
    rating,
    price_level,
    price_label,
    user_ratings_total:
      typeof o.user_ratings_total === 'number' && Number.isFinite(o.user_ratings_total)
        ? o.user_ratings_total
        : null,
    pet_indoor_allowed: petFlag(o.pet_indoor_allowed),
    pet_terrace_only: petFlag(o.pet_terrace_only),
    pet_friendly_status,
    pet_friendly_verified: petFlag(o.pet_friendly_verified),
  }
}

async function fetchSpotRowFromWanspotApi(opts: {
  spotId?: string
  placeId?: string
}): Promise<SpotDetailRow | null> {
  const spotId = opts.spotId?.trim() ?? ''
  const placeId = opts.placeId?.trim() ?? ''
  const query =
    spotId && isSpotUuid(spotId)
      ? `spot_id=${encodeURIComponent(spotId)}`
      : placeId
        ? `place_id=${encodeURIComponent(placeId)}`
        : null
  if (!query) return null
  const res = await wanspotFetch(`/api/spots/row?${query}`).catch(() => null)
  if (!res?.ok) return null
  try {
    const json = (await res.json()) as {
      spot?: SpotDetailRow & { dog_fact_highlights?: unknown }
    }
    const spot = json.spot
    if (!spot) return null
    const raw = spot.dog_fact_highlights
    const dog_fact_highlights = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 3)
      : []
    return { ...spot, dog_fact_highlights }
  } catch {
    return null
  }
}

async function placeFromDetailApi(placeId: string, fallbackName: string): Promise<PlaceResult | null> {
  const res = await wanspotFetch(`/api/spots/detail?place_id=${encodeURIComponent(placeId)}`).catch(() => null)
  if (!res?.ok) return null
  try {
    return placeFromDetailJson(await res.json(), placeId, fallbackName)
  } catch {
    return null
  }
}

async function resolveViaWanspotDetail(
  spotId: string,
  placeId: string,
  fallbackName: string
): Promise<ResolveOk | null> {
  const fromDetail = await placeFromDetailApi(placeId, fallbackName)
  if (!fromDetail) return null
  const cachedUuid = getSpotDetailUuidCache(placeId)
  const resolvedId = cachedUuid ?? (isSpotUuid(spotId) ? spotId : spotId)
  return ok(spotRowFromPlace(spotId, fromDetail, resolvedId))
}

function ok(spot: SpotDetailRow): ResolveOk {
  return { ok: true, spot, resolvedId: spot.id }
}

function fail(message: string, retryable: boolean): ResolveErr {
  return { ok: false, message, retryable }
}

function cachedPlaceForRoute(spotId: string): PlaceResult | null {
  return peekSpotDetailPlaceCache(spotId) ?? getSpotDetailPlaceCache(spotId)
}

/** 一覧→詳細の同期ハンドオフ（カードと同じ PlaceResult をそのまま使う） */
export function getSpotDetailHandoffPlace(
  spotId: string,
  pendingPlace: PlaceResult | null
): PlaceResult | null {
  const fromSlot = peekSpotDetailHandoff(spotId)
  if (fromSlot) return fromSlot
  if (pendingPlace?.place_id) return pendingPlace
  const cached = cachedPlaceForRoute(spotId)
  if (cached) return cached
  const placeIdFromRoute = extractPlaceIdFromRouteId(spotId)
  if (placeIdFromRoute) {
    return cachedPlaceForRoute(placeRouteId(placeIdFromRoute))
  }
  return null
}

/** ネットワーク不要の同期ブートストラップ（place_ ルートは必ず非 null） */
export function bootstrapSpotForDetail(
  spotId: string,
  pendingPlace: PlaceResult | null
): SpotDetailRow | null {
  const handoff = getSpotDetailHandoffPlace(spotId, pendingPlace)
  if (handoff) return spotRowFromPlace(spotId, handoff)

  const placeIdFromRoute = extractPlaceIdFromRouteId(spotId)
  if (placeIdFromRoute) {
    const place: PlaceResult =
      pendingPlace?.place_id === placeIdFromRoute
        ? pendingPlace
        : {
            place_id: placeIdFromRoute,
            name: pendingPlace?.name?.trim() || 'スポット',
            category: pendingPlace?.category ?? '',
            address: pendingPlace?.address ?? '',
            lat: pendingPlace?.lat ?? 0,
            lng: pendingPlace?.lng ?? 0,
            photo_ref: pendingPlace?.photo_ref ?? null,
            rating: pendingPlace?.rating ?? null,
            price_level: pendingPlace?.price_level ?? null,
            price_label: pendingPlace?.price_label ?? null,
            user_ratings_total: pendingPlace?.user_ratings_total ?? null,
          }
    return spotRowFromPlace(spotId, place)
  }

  if (pendingPlace?.place_id) return spotRowFromPlace(spotId, pendingPlace)
  return null
}

function immediateResolve(spotId: string, place: PlaceResult): ResolveOk {
  const cachedUuid = getSpotDetailUuidCache(place.place_id)
  const resolvedId = cachedUuid ?? (isSpotUuid(spotId) ? spotId : spotId)
  return ok(spotRowFromPlace(spotId, place, resolvedId))
}

/** ensureSpotId をバックグラウンドで走らせ、表示用 spot.id を UUID に揃える */
export async function ensureSpotUuidForPlace(place: PlaceResult, currentId: string): Promise<string | null> {
  if (isSpotUuid(currentId)) return currentId
  const cached = getSpotDetailUuidCache(place.place_id)
  if (cached) return cached
  return ensureSpotId(place)
}

export async function resolveSpotForDetail(
  spotId: string,
  pendingPlace: PlaceResult | null
): Promise<ResolveOk | ResolveErr> {
  const syncFallback = getSpotDetailHandoffPlace(spotId, pendingPlace)
  if (syncFallback) return immediateResolve(spotId, syncFallback)

  const asyncFallback = await readStashedSpotDetailPlace(spotId)
  if (asyncFallback) return immediateResolve(spotId, asyncFallback)

  const placeIdFromRoute = extractPlaceIdFromRouteId(spotId)
  if (placeIdFromRoute) {
    const viaApi = await resolveViaWanspotDetail(spotId, placeIdFromRoute, 'スポット')
    if (viaApi) return viaApi
    return fail('スポット情報の取得に失敗しました。通信環境を確認して再試行してください。', true)
  }

  if (isSpotUuid(spotId)) {
    const viaRow = await fetchSpotRowFromWanspotApi({ spotId })
    if (viaRow) return ok(viaRow)
    if (pendingPlace?.place_id) {
      const viaDetail = await resolveViaWanspotDetail(spotId, pendingPlace.place_id, pendingPlace.name)
      if (viaDetail) return viaDetail
    }
    return fail(
      'スポット情報を取得できませんでした。一覧から再度開いてください。',
      true
    )
  }

  const viaApi = await resolveViaWanspotDetail(spotId, spotId, 'スポット')
  if (viaApi) return viaApi

  return fail('スポットが見つかりませんでした。', true)
}
