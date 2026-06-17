import { PLACE_ROUTE_ID_PREFIX } from '@/lib/open-spot-detail'
import type { PlaceResult } from '@/types/places'

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
  return id.startsWith(PLACE_ROUTE_ID_PREFIX)
}

/** expo-router の search params から ensure 用 PlaceResult を復元 */
export function pendingPlaceFromParams(
  params: Record<string, string | string[] | undefined>
): PlaceResult | null {
  const place_id = first(params.place_id)
  const name = first(params.name)
  const lat = num(first(params.lat))
  const lng = num(first(params.lng))
  if (!place_id || !name || lat == null || lng == null) return null
  return {
    place_id,
    name,
    category: first(params.category) ?? '',
    lat,
    lng,
    address: first(params.address) ?? '',
    photo_ref: first(params.photo_ref) || null,
    rating: num(first(params.rating)),
    price_level: num(first(params.price_level)),
    price_label: first(params.price_label) || null,
    user_ratings_total: num(first(params.user_ratings_total)),
  }
}
