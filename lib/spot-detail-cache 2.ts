import type { PlaceResult } from '@/types/places'
import { isPendingPlaceRouteId, placeRouteIdFromPlaceId } from '@/lib/spot-detail-pending'

/** 画面遷移直前に同期的に渡す（AsyncStorage の競合を避ける） */
const memory = new Map<string, PlaceResult>()
const uuidByPlaceId = new Map<string, string>()

export function placeRouteId(placeId: string): string {
  return placeRouteIdFromPlaceId(placeId)
}

export function setSpotDetailPlaceCache(routeId: string, place: PlaceResult): void {
  memory.set(routeId, place)
  memory.set(placeRouteId(place.place_id), place)
  memory.set(`place:${place.place_id}`, place)
}

export function setSpotDetailUuidCache(placeId: string, spotUuid: string): void {
  if (!placeId || !spotUuid) return
  uuidByPlaceId.set(placeId, spotUuid)
}

export function getSpotDetailUuidCache(placeId: string): string | null {
  return uuidByPlaceId.get(placeId) ?? null
}

export function getSpotDetailPlaceCache(spotId: string): PlaceResult | null {
  return memory.get(spotId) ?? null
}

/** 初回解決後も再試行に備え、読み取り時は削除しない */
export function peekSpotDetailPlaceCache(spotId: string): PlaceResult | null {
  const direct = memory.get(spotId)
  if (direct) return direct
  if (isPendingPlaceRouteId(spotId)) {
    return memory.get(spotId) ?? null
  }
  return null
}

export function takeSpotDetailPlaceCache(spotId: string): PlaceResult | null {
  const place = memory.get(spotId) ?? null
  if (place) memory.delete(spotId)
  return place
}
