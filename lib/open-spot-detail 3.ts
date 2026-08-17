import type { Router } from 'expo-router'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import type { UserSpotRow } from '@/lib/fetch-user-spot-lists'
import { setSpotDetailHandoff } from '@/lib/spot-detail-handoff'
import { setSpotDetailPlaceCache, setSpotDetailUuidCache } from '@/lib/spot-detail-cache'
import { isSpotUuid } from '@/lib/spot-detail-load'
import { placeParamsFromPlace, placeRouteIdFromPlaceId } from '@/lib/spot-detail-pending'
import { stashSpotDetailPlace } from '@/lib/spot-detail-stash'
import type { PlaceResult } from '@/types/places'

/** URL の `:` 解釈を避けるため `place:` ではなく `place_` を使う */
export const PLACE_ROUTE_ID_PREFIX = 'place_'
/** 旧 OTA で生成された `place:ChIJ…` リンク互換 */
export const LEGACY_PLACE_ROUTE_ID_PREFIX = 'place:'

let navigating = false

function releaseNavLock() {
  setTimeout(() => {
    navigating = false
  }, 900)
}

function routeIdForPlace(place: PlaceResult): string {
  return placeRouteIdFromPlaceId(place.place_id)
}

function pushSpotDetail(router: Router, routeId: string, place: PlaceResult, spotUuid?: string | null) {
  setSpotDetailHandoff(routeId, place)
  setSpotDetailPlaceCache(routeId, place)
  if (spotUuid && isSpotUuid(spotUuid)) {
    setSpotDetailUuidCache(place.place_id, spotUuid)
  }
  void stashSpotDetailPlace(routeId, place)
  router.push({
    pathname: '/spots/[id]',
    params: { id: routeId, ...placeParamsFromPlace(place) },
  })
}

function sheetSpotToPlace(spot: SheetSpot): PlaceResult {
  return {
    place_id: spot.placeId,
    name: spot.name,
    category: spot.category,
    address: spot.address,
    lat: spot.lat,
    lng: spot.lng,
    photo_ref: spot.photoRef,
    rating: spot.rating,
    price_level: spot.priceLevel,
    price_label: spot.priceLabel,
    user_ratings_total: spot.userRatingsTotal,
  }
}

/** 一覧から詳細へ（ensure を待たず place 情報ごと遷移） */
export function openSpotDetailFromPlace(
  router: Router,
  place: PlaceResult,
  spotUuid?: string | null
): void {
  if (navigating) return
  navigating = true
  releaseNavLock()
  pushSpotDetail(router, routeIdForPlace(place), place, spotUuid)
}

/** カードタップから詳細へ即遷移 */
export function openSpotDetail(router: Router, spot: SheetSpot): void {
  openSpotDetailFromPlace(router, sheetSpotToPlace(spot), spot.spotUuid)
}

/** UUID 確定済みの詳細遷移 */
export function openSpotDetailById(router: Router, spotUuid: string, place: PlaceResult): void {
  openSpotDetailFromPlace(router, place, spotUuid)
}

export function placeFromUserSpotRow(row: UserSpotRow): PlaceResult {
  return {
    place_id: row.place_id,
    name: row.name,
    category: row.category,
    address: row.address ?? '',
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    photo_ref: row.photoRef,
    rating: row.rating,
    price_level: row.priceLevel,
    price_label: row.priceLabel,
    user_ratings_total: null,
  }
}

export function openSpotDetailFromUserSpotRow(router: Router, row: UserSpotRow): void {
  openSpotDetailFromPlace(router, placeFromUserSpotRow(row), row.id)
}
