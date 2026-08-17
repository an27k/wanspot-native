import type { PlaceResult } from '@/types/places'
import { extractPlaceIdFromRouteId } from '@/lib/spot-detail-pending'

/** 画面遷移直前に同期的にセット（router params / cache より優先） */
let slot: { routeId: string; place: PlaceResult; at: number } | null = null

export function setSpotDetailHandoff(routeId: string, place: PlaceResult): void {
  slot = { routeId, place, at: Date.now() }
}

export function peekSpotDetailHandoff(routeId: string): PlaceResult | null {
  if (!slot) return null
  if (Date.now() - slot.at > 60_000) {
    slot = null
    return null
  }
  if (slot.routeId === routeId) return slot.place
  const placeId = extractPlaceIdFromRouteId(routeId)
  if (placeId && slot.place.place_id === placeId) return slot.place
  // カードタップ直後（routeId が UUID / place_ で食い違っても）同一セッション内は受け入れる
  if (Date.now() - slot.at < 8000) return slot.place
  return null
}

export function takeSpotDetailHandoff(routeId: string): PlaceResult | null {
  const place = peekSpotDetailHandoff(routeId)
  if (place) slot = null
  return place
}
