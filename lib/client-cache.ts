/** セッション内のインメモリキャッシュ（タブ切替・画面往復での再取得を抑止） */

export const CACHE_TTL = {
  LOCATION_MS: 3 * 60_000,
  NEARBY_SPOTS_MS: 12 * 60_000,
  USER_LISTS_MS: 5 * 60_000,
  WALK_TAGS_MS: 30 * 60_000,
  TODAY_PHOTO_MS: 60 * 60_000,
  ALBUM_MS: 10 * 60_000,
  WEATHER_MS: 10 * 60_000,
  GEO_MS: 30 * 60_000,
  ARTICLES_MS: 10 * 60_000,
  SUGGEST_TAGS_MS: 15 * 60_000,
  SPOT_LIKES_MS: 5 * 60_000,
  RECOMMEND_MS: 12 * 60_000,
  DOG_PROFILE_MS: 10 * 60_000,
} as const

type CacheEntry<T> = {
  data: T
  fetchedAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function geoBucket(lat: number, lng: number, decimals = 3): string {
  return `${lat.toFixed(decimals)},${lng.toFixed(decimals)}`
}

export function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  const hit = store.get(key)
  return hit as CacheEntry<T> | undefined
}

export function isCacheFresh(key: string, ttlMs: number, now = Date.now()): boolean {
  const entry = store.get(key)
  if (!entry) return false
  return now - entry.fetchedAt < ttlMs
}

export function readCache<T>(key: string): T | undefined {
  return getCacheEntry<T>(key)?.data
}

export function writeCache<T>(key: string, data: T, fetchedAt = Date.now()): void {
  store.set(key, { data, fetchedAt })
}

export function invalidateCache(key: string): void {
  store.delete(key)
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export function invalidateAllCache(): void {
  store.clear()
}

const inflight = new Map<string, Promise<unknown>>()

/** キャッシュがあれば即返し、期限切れ時のみ fetcher を実行（同一キーの同時呼び出しは1回にまとめる） */
export async function fetchWithCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  opts?: { force?: boolean }
): Promise<{ data: T; fromCache: boolean }> {
  if (!opts?.force && isCacheFresh(key, ttlMs)) {
    const cached = readCache<T>(key)
    if (cached !== undefined) return { data: cached, fromCache: true }
  }

  const pending = inflight.get(key) as Promise<{ data: T; fromCache: boolean }> | undefined
  if (pending) return pending

  const task = (async () => {
    const data = await fetcher()
    writeCache(key, data)
    return { data, fromCache: false as const }
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, task)
  return task
}
