import { calcDistanceMeters } from '@/lib/nearby/geo'
import type { PlaceResult } from '@/types/places'

const PRIOR_MEAN = 4.0
const PRIOR_WEIGHT = 10
const DISTANCE_BUCKET_M = 1000

/**
 * ベイズ風の加重スコア。レビュー件数が API に無い場合は 0 件扱いで保守的に下げる。
 * user_ratings_total が将来 nearby に載れば自動的に効く。
 */
export function placeQualityScore(spot: PlaceResult): number {
  const rating = spot.rating
  if (rating == null || rating <= 0 || !Number.isFinite(rating)) return -1

  const rawCount = spot.user_ratings_total
  const n =
    typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount > 0
      ? rawCount
      : 0

  const v = n
  return (v / (v + PRIOR_WEIGHT)) * rating + (PRIOR_WEIGHT / (v + PRIOR_WEIGHT)) * PRIOR_MEAN
}

export function sortPlacesByScore(
  spots: PlaceResult[],
  origin: { lat: number; lng: number } | null
): PlaceResult[] {
  return [...spots].sort((a, b) => {
    if (origin) {
      const da = calcDistanceMeters(origin.lat, origin.lng, a.lat, a.lng)
      const db = calcDistanceMeters(origin.lat, origin.lng, b.lat, b.lng)
      const ba = Math.floor(da / DISTANCE_BUCKET_M)
      const bb = Math.floor(db / DISTANCE_BUCKET_M)
      if (ba !== bb) return ba - bb
      const sa = placeQualityScore(a)
      const sb = placeQualityScore(b)
      if (sb !== sa) return sb - sa
      return da - db
    }

    const sa = placeQualityScore(a)
    const sb = placeQualityScore(b)
    if (sb !== sa) return sb - sa
    return 0
  })
}
