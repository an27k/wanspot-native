import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PlaceResult } from '@/types/places'

const KEY = 'spot_detail_place_stash_v1'

export async function stashSpotDetailPlace(spotId: string, place: PlaceResult): Promise<void> {
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        spotId,
        place,
        at: Date.now(),
      })
    )
  } catch {
    /* ignore */
  }
}

export async function readStashedSpotDetailPlace(spotId: string): Promise<PlaceResult | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { spotId?: string; place?: PlaceResult; at?: number }
    if (!parsed.place?.place_id || !parsed.place.name) return null
    if (parsed.spotId !== spotId) return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > 15 * 60 * 1000) return null
    return parsed.place
  } catch {
    return null
  }
}
