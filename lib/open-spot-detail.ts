import type { Router } from 'expo-router'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'

export const PLACE_ROUTE_ID_PREFIX = 'place:'

let navigating = false

function releaseNavLock() {
  setTimeout(() => {
    navigating = false
  }, 900)
}

/** カードタップから詳細へ即遷移（ensure は詳細画面側）。連打でスタックが積まないようガード。 */
export function openSpotDetail(router: Router, spot: SheetSpot): void {
  if (navigating) return
  navigating = true
  releaseNavLock()

  if (spot.spotUuid) {
    router.push(`/spots/${spot.spotUuid}`)
    return
  }

  router.push({
    pathname: '/spots/[id]',
    params: {
      id: `${PLACE_ROUTE_ID_PREFIX}${spot.placeId}`,
      place_id: spot.placeId,
      name: spot.name,
      category: spot.category,
      address: spot.address ?? '',
      lat: String(spot.lat),
      lng: String(spot.lng),
      photo_ref: spot.photoRef ?? '',
      rating: spot.rating != null ? String(spot.rating) : '',
      price_level: spot.priceLevel != null ? String(spot.priceLevel) : '',
      price_label: spot.priceLabel ?? '',
      user_ratings_total: spot.userRatingsTotal != null ? String(spot.userRatingsTotal) : '',
    },
  })
}
