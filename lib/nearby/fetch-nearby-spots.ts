import {
  DOG_RUN_SEARCH_QUERY,
  DOG_RUN_SUPPLEMENTARY_SEARCH_QUERY,
  NEARBY_MIN_SPOTS_THRESHOLD,
  NEARBY_RADIUS_EXPANSION_STEPS_M,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import { sortDogRunSpotsByPriority } from '@/lib/nearby/dog-run-priority'
import { placeMatchesGenreFilter } from '@/lib/nearby/map-filter'
import { calcDistanceMeters } from '@/lib/nearby/geo'
import { wanspotFetch } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

async function fetchNearbyByType(
  lat: number,
  lng: number,
  radiusM: number,
  type: string
): Promise<PlaceResult[]> {
  const q = `/api/spots/nearby?lat=${lat}&lng=${lng}&radius=${radiusM}&type=${type}`
  const r = await wanspotFetch(q)
  let data: { spots?: PlaceResult[]; error?: string } = {}
  try {
    data = (await r.json()) as { spots?: PlaceResult[]; error?: string }
  } catch {
    return []
  }
  if (!r.ok) return []
  return data.spots ?? []
}

async function fetchDogRunSpotsForQuery(
  query: string,
  lat: number,
  lng: number,
  radiusM: number
): Promise<PlaceResult[]> {
  const q = `/api/spots/search?q=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}`
  const r = await wanspotFetch(q)
  let data: { spots?: PlaceResult[] } = {}
  try {
    data = (await r.json()) as { spots?: PlaceResult[] }
  } catch {
    return []
  }
  if (!r.ok) return []
  return (data.spots ?? [])
    .filter((spot) => placeMatchesGenreFilter(spot, 'dog_run'))
    .filter((spot) => calcDistanceMeters(lat, lng, spot.lat, spot.lng) <= radiusM)
}

async function fetchDogRunSpots(lat: number, lng: number, radiusM: number): Promise<PlaceResult[]> {
  const primary = await fetchDogRunSpotsForQuery(DOG_RUN_SEARCH_QUERY, lat, lng, radiusM)
  const merged = new Map<string, PlaceResult>()
  for (const spot of primary) {
    if (spot.place_id) merged.set(spot.place_id, spot)
  }

  // 件数が閾値未満のときだけ「屋内ドッグラン」で補助検索する
  // （常時2クエリ投げると Places API コストが倍増するため、不足時限定）
  if (merged.size < NEARBY_MIN_SPOTS_THRESHOLD) {
    const supplementary = await fetchDogRunSpotsForQuery(DOG_RUN_SUPPLEMENTARY_SEARCH_QUERY, lat, lng, radiusM)
    for (const spot of supplementary) {
      if (spot.place_id && !merged.has(spot.place_id)) merged.set(spot.place_id, spot)
    }
  }

  const spots = [...merged.values()].map((spot) => ({ ...spot, category: 'ドッグラン' }))
  // 公営より民営・屋内・テーマパーク的なドッグランを優先表示（非表示にはしない）
  return sortDogRunSpotsByPriority(spots)
}

/**
 * アクティブジャンル1件のみ取得（Places コスト削減）。
 */
export async function fetchNearbySpotsForGenre(
  location: { lat: number; lng: number },
  radiusM: number,
  genre: MapGenreKey
): Promise<{ spots: PlaceResult[]; error: string | null }> {
  try {
    const raw =
      genre === 'dog_run'
        ? await fetchDogRunSpots(location.lat, location.lng, radiusM)
        : await fetchNearbyByType(location.lat, location.lng, radiusM, genre)

    const spots = raw.filter(
      (spot) =>
        spot.place_id &&
        calcDistanceMeters(location.lat, location.lng, spot.lat, spot.lng) <= radiusM &&
        placeMatchesGenreFilter(spot, genre)
    )

    return { spots, error: null }
  } catch {
    return {
      spots: [],
      error:
        'ネットワークエラーです。API の URL（EXPO_PUBLIC_WANSPOT_API_URL / https://www.wanspot.app）を確認してください',
    }
  }
}

/**
 * 件数が閾値未満なら半径を段階的に拡張（既存 default 起点 → 上限まで）。
 */
export async function fetchNearbySpotsForGenreWithExpansion(
  location: { lat: number; lng: number },
  genre: MapGenreKey,
  minSpots = NEARBY_MIN_SPOTS_THRESHOLD
): Promise<{ spots: PlaceResult[]; error: string | null; radiusM: number }> {
  const steps = NEARBY_RADIUS_EXPANSION_STEPS_M
  let lastResult: { spots: PlaceResult[]; error: string | null; radiusM: number } | null = null

  for (const radiusM of steps) {
    const result = await fetchNearbySpotsForGenre(location, radiusM, genre)
    lastResult = { spots: result.spots, error: result.error, radiusM }
    if (result.error || result.spots.length >= minSpots) return lastResult
  }

  return lastResult ?? { spots: [], error: null, radiusM: steps[steps.length - 1] }
}
