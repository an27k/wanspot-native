import * as Location from 'expo-location'
import { CACHE_TTL, fetchWithCache, geoBucket } from '@/lib/client-cache'

export async function getCachedPrefecture(lat: number, lng: number): Promise<string> {
  const key = `geo:pref:${geoBucket(lat, lng)}`
  const { data } = await fetchWithCache(key, CACHE_TTL.GEO_MS, async () => {
    try {
      const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
      const r0 = rows[0]
      if (r0?.region) return r0.region
      if (r0?.subregion) return r0.subregion
    } catch {
      /* ignore */
    }
    return '東京'
  })
  return data
}

export async function getCachedPrefectureAndMunicipality(
  lat: number,
  lng: number
): Promise<{ prefecture: string | null; municipality: string | null }> {
  const key = `geo:pref-muni:${geoBucket(lat, lng)}`
  const { data } = await fetchWithCache(key, CACHE_TTL.GEO_MS, async () => {
    try {
      const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
      const r0 = rows[0]
      const prefecture = r0?.region ?? r0?.subregion ?? null
      const municipality = r0?.city ?? r0?.district ?? r0?.subregion ?? null
      return {
        prefecture: typeof prefecture === 'string' ? prefecture : null,
        municipality: typeof municipality === 'string' ? municipality : null,
      }
    } catch {
      return { prefecture: null, municipality: null }
    }
  })
  return data
}
