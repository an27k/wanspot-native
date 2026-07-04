import { LEGACY_PLACE_ROUTE_ID_PREFIX, PLACE_ROUTE_ID_PREFIX } from '@/lib/open-spot-detail'
import type { PlaceResult } from '@/types/places'

export function extractPlaceIdFromRouteId(routeId: string): string | null {
  if (routeId.startsWith(PLACE_ROUTE_ID_PREFIX)) {
    const id = routeId.slice(PLACE_ROUTE_ID_PREFIX.length).trim()
    return id || null
  }
  if (routeId.startsWith(LEGACY_PLACE_ROUTE_ID_PREFIX)) {
    const id = routeId.slice(LEGACY_PLACE_ROUTE_ID_PREFIX.length).trim()
    return id || null
  }
  return null
}

function first(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined
  return Array.isArray(v) ? v[0] : v
}

function num(v: string | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function isPendingPlaceRouteId(id: string): boolean {
  return id.startsWith(PLACE_ROUTE_ID_PREFIX) || id.startsWith(LEGACY_PLACE_ROUTE_ID_PREFIX)
}

export function placeRouteIdFromPlaceId(placeId: string): string {
  return `${PLACE_ROUTE_ID_PREFIX}${placeId}`
}

/** expo-router の search params から ensure 用 PlaceResult を復元 */
/** 詳細画面へ渡す search params（Supabase 不通時のフォールバック表示に使う） */
export function placeParamsFromPlace(place: PlaceResult): Record<string, string> {
  return {
    place_id: place.place_id,
    name: place.name,
    category: place.category,
    address: place.address ?? '',
    lat: String(place.lat),
    lng: String(place.lng),
    photo_ref: place.photo_ref ?? '',
    rating: place.rating != null ? String(place.rating) : '',
    price_level: place.price_level != null ? String(place.price_level) : '',
    price_label: place.price_label ?? '',
    user_ratings_total: place.user_ratings_total != null ? String(place.user_ratings_total) : '',
  }
}

export function pendingPlaceFromParams(
  params: Record<string, string | string[] | undefined>
): PlaceResult | null {
  const place_id = first(params.place_id)?.trim()
  const name = first(params.name)?.trim() || 'スポット'
  if (!place_id) return null
  const lat = num(first(params.lat))
  const lng = num(first(params.lng))
  return {
    place_id,
    name,
    category: first(params.category) ?? '',
    lat: lat ?? 0,
    lng: lng ?? 0,
    address: first(params.address) ?? '',
    photo_ref: first(params.photo_ref) || null,
    rating: num(first(params.rating)),
    price_level: num(first(params.price_level)),
    price_label: first(params.price_label) || null,
    user_ratings_total: num(first(params.user_ratings_total)),
  }
}
