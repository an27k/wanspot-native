import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import type { PlaceResult } from '@/types/places'

/** ボトムシート3タブ共通の軽量行 */
export type SheetSpot = {
  key: string
  placeId: string
  spotUuid: string | null
  name: string
  category: string
  address: string
  lat: number
  lng: number
  photoRef: string | null
  rating: number | null
  priceLevel: number | null
  userRatingsTotal: number | null
}

export function sheetSpotFromPlace(p: PlaceResult): SheetSpot {
  return {
    key: p.place_id,
    placeId: p.place_id,
    spotUuid: null,
    name: p.name,
    category: p.category,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    photoRef: p.photo_ref,
    rating: p.rating,
    priceLevel: p.price_level,
    userRatingsTotal: p.user_ratings_total ?? null,
  }
}

export function sheetSpotFromUserRow(row: UserSpotRow): SheetSpot | null {
  if (row.lat == null || row.lng == null) return null
  return {
    key: row.place_id || row.id,
    placeId: row.place_id,
    spotUuid: row.id,
    name: row.name,
    category: row.category,
    address: row.address ?? '',
    lat: row.lat,
    lng: row.lng,
    photoRef: null,
    rating: null,
    priceLevel: null,
    userRatingsTotal: null,
  }
}
