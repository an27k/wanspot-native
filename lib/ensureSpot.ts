import { supabase } from '@/lib/supabase'
import type { PlaceResult } from '@/types/places'

export async function ensureSpotId(spot: PlaceResult): Promise<string | null> {
  const types =
    Array.isArray(spot.types) && spot.types.length > 0
      ? spot.types.filter((t): t is string => typeof t === 'string')
      : null
  const { data, error } = await supabase
    .from('spots')
    .upsert(
      {
        place_id: spot.place_id,
        name: spot.name,
        category: spot.category,
        address: spot.address,
        lat: spot.lat,
        lng: spot.lng,
        rating: spot.rating,
        price_level: spot.price_level,
        ...(types ? { google_types: types } : {}),
      },
      { onConflict: 'place_id' }
    )
    .select('id')
    .single()
  if (error || !data) return null
  return data.id as string
}
