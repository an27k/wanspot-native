import type { PlaceResult } from '@/types/places'
import { catalogEntryByLabel } from '@/lib/walk-area-catalog'
import { calcDistanceMeters } from '@/lib/user-spot-list-utils'

/**
 * AIレコメンド・トレンドの検索結果を、現在地距離＋登録エリア（住所一致・カタログ代表座標との距離）で並べ替え。
 * API が未対応でもクライアントだけで精度を上げられる。
 */
export function rankSpotsByWalkContext(
  spots: PlaceResult[],
  userLocation: { lat: number; lng: number } | null,
  areaTags: string[]
): PlaceResult[] {
  if (spots.length === 0) return spots
  const tags = [...new Set(areaTags.map((t) => t.trim()).filter(Boolean))]
  if (tags.length === 0 && !userLocation) return spots

  const indexed = spots.map((s, idx) => ({ s, idx, score: scoreSpotForWalkContext(s, userLocation, tags) }))
  indexed.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.idx - b.idx
  })
  return indexed.map((x) => x.s)
}

function scoreSpotForWalkContext(
  spot: PlaceResult,
  userLocation: { lat: number; lng: number } | null,
  tags: string[]
): number {
  let sc = 0
  const addr = (spot.address ?? '').replace(/\s/g, '')

  for (const t of tags) {
    if (!t) continue
    if (addr.includes(t)) sc += 100
    const cityIdx = t.indexOf('市')
    if (cityIdx > 0 && cityIdx < t.length - 1) {
      const afterCity = t.slice(cityIdx + 1)
      if (afterCity.length >= 2 && addr.includes(afterCity)) sc += 70
    }
  }

  if (userLocation != null && spot.lat != null && spot.lng != null) {
    const dUser = calcDistanceMeters(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
    sc -= dUser / 450
  }

  for (const t of tags) {
    const entry = catalogEntryByLabel(t)
    if (!entry || spot.lat == null || spot.lng == null) continue
    const d = calcDistanceMeters(entry.lat, entry.lng, spot.lat, spot.lng)
    sc -= d / 650
  }

  return sc
}
