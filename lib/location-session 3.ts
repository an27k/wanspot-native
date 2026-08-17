import * as Location from 'expo-location'
import { calcDistanceMeters } from '@/lib/nearby/geo'
import {
  CACHE_TTL,
  geoBucket,
  isCacheFresh,
  readCache,
  writeCache,
} from '@/lib/client-cache'

const LOCATION_KEY = 'session:location'

export type SessionLocation = { lat: number; lng: number }

type CachedLocation = SessionLocation & { bucket: string }

const MOVE_THRESHOLD_M = 80

function locationChanged(a: SessionLocation | null, b: SessionLocation): boolean {
  if (!a) return true
  return calcDistanceMeters(a.lat, a.lng, b.lat, b.lng) >= MOVE_THRESHOLD_M
}

/**
 * フォーカス時の GPS 再取得を抑え、TTL 内かつ大きく動いていなければキャッシュを返す。
 */
export async function resolveSessionLocation(
  current: SessionLocation | null
): Promise<
  | { ok: true; location: SessionLocation; changed: boolean; permissionDenied: false }
  | { ok: false; permissionDenied: true }
  | { ok: false; permissionDenied: false; error: string }
> {
  const cached = readCache<CachedLocation>(LOCATION_KEY)
  if (cached && isCacheFresh(LOCATION_KEY, CACHE_TTL.LOCATION_MS)) {
    const loc = { lat: cached.lat, lng: cached.lng }
    return { ok: true, location: loc, changed: locationChanged(current, loc), permissionDenied: false }
  }

  let { status } = await Location.getForegroundPermissionsAsync()
  if (status === 'undetermined') {
    const req = await Location.requestForegroundPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') {
    return { ok: false, permissionDenied: true }
  }

  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    writeCache(LOCATION_KEY, { ...loc, bucket: geoBucket(loc.lat, loc.lng) })
    return { ok: true, location: loc, changed: locationChanged(current, loc), permissionDenied: false }
  } catch {
    if (cached) {
      const loc = { lat: cached.lat, lng: cached.lng }
      return { ok: true, location: loc, changed: false, permissionDenied: false }
    }
    return { ok: false, permissionDenied: false, error: '位置情報を取得できませんでした' }
  }
}
