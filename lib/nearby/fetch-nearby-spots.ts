import {
  DOG_RUN_RELEVANT_PATTERN,
  DOG_RUN_SEARCH_QUERY,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import { calcDistanceMeters } from '@/lib/nearby/geo'
import { wanspotFetch } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

function isDogRunSpot(spot: PlaceResult): boolean {
  const text = [spot.name, spot.address, spot.category]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
  return DOG_RUN_RELEVANT_PATTERN.test(text)
}

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

async function fetchDogRunSpots(lat: number, lng: number, radiusM: number): Promise<PlaceResult[]> {
  const q = `/api/spots/search?q=${encodeURIComponent(DOG_RUN_SEARCH_QUERY)}&lat=${lat}&lng=${lng}`
  const r = await wanspotFetch(q)
  let data: { spots?: PlaceResult[] } = {}
  try {
    data = (await r.json()) as { spots?: PlaceResult[] }
  } catch {
    return []
  }
  if (!r.ok) return []
  return (data.spots ?? [])
    .filter(isDogRunSpot)
    .filter((spot) => calcDistanceMeters(lat, lng, spot.lat, spot.lng) <= radiusM)
    .map((spot) => ({ ...spot, category: 'ドッグラン' }))
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
        calcDistanceMeters(location.lat, location.lng, spot.lat, spot.lng) <= radiusM
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
