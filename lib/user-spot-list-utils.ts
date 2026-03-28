import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'

export type UserSpotSortKey = 'date_desc' | 'name' | 'distance' | 'rating' | 'likes'

export type PlaceCardEnrichment = {
  photo_ref: string | null
  rating: number | null
  price_level: number | null
  formatted_address?: string | null
  vicinity?: string | null
}

export function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function sortUserSpotRows(
  list: UserSpotRow[],
  key: UserSpotSortKey,
  enrichment: Record<string, PlaceCardEnrichment>,
  userLocation: { lat: number; lng: number } | null
): UserSpotRow[] {
  const copy = [...list]
  const savedTime = (s: UserSpotRow) => (s.savedAt ? new Date(s.savedAt).getTime() : 0)
  const ratingOf = (s: UserSpotRow) => enrichment[s.place_id]?.rating ?? 0

  copy.sort((a, b) => {
    if (key === 'date_desc') return savedTime(b) - savedTime(a)
    if (key === 'name') return a.name.localeCompare(b.name, 'ja')
    if (key === 'rating') return ratingOf(b) - ratingOf(a)
    if (key === 'likes') return (b.likeCount ?? 0) - (a.likeCount ?? 0)
    if (key === 'distance') {
      if (!userLocation) return 0
      const da =
        a.lat != null && a.lng != null
          ? calcDistanceMeters(userLocation.lat, userLocation.lng, a.lat, a.lng)
          : Number.POSITIVE_INFINITY
      const db =
        b.lat != null && b.lng != null
          ? calcDistanceMeters(userLocation.lat, userLocation.lng, b.lat, b.lng)
          : Number.POSITIVE_INFINITY
      return da - db
    }
    return 0
  })
  return copy
}
