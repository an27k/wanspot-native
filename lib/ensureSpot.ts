import type { PlaceResult } from '@/types/places'
import { wanspotFetch } from '@/lib/wanspot-api'

export async function ensureSpotId(spot: PlaceResult): Promise<string | null> {
  const types =
    Array.isArray(spot.types) && spot.types.length > 0
      ? spot.types.filter((t): t is string => typeof t === 'string')
      : null

  try {
    const response = await wanspotFetch('/api/spots/ensure', {
      method: 'POST',
      json: {
        place_id: spot.place_id,
        name: spot.name,
        category: spot.category ?? null,
        address: spot.address ?? null,
        lat: spot.lat,
        lng: spot.lng,
        rating: spot.rating ?? null,
        price_level: spot.price_level ?? null,
        google_types: types,
      },
    })

    if (!response.ok) {
      console.warn('ensureSpotId failed:', response.status)
      return null
    }

    const data = (await response.json()) as unknown
    const id = (data as { id?: unknown } | null)?.id
    return typeof id === 'string' ? id : null
  } catch (e) {
    console.warn('ensureSpotId exception:', e)
    return null
  }
}
