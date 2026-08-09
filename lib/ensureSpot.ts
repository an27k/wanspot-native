import type { PlaceResult } from '@/types/places'
import { setSpotDetailUuidCache } from '@/lib/spot-detail-cache'
import { wanspotFetch } from '@/lib/wanspot-api'

function uuidFromPayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const root = data as { id?: unknown; spot?: { id?: unknown } }
  const value = root.id ?? root.spot?.id
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    return null
  }
  return value
}

async function readUuid(response: Response): Promise<string | null> {
  try {
    return uuidFromPayload(await response.json())
  } catch {
    return null
  }
}

export async function ensureSpotId(spot: PlaceResult): Promise<string | null> {
  const placeId = spot.place_id.trim()
  if (!placeId) return null

  try {
    // 既存スポットは公開read APIで解決し、不要なmutationやGoogle課金を発生させない。
    const lookup = await wanspotFetch(
      `/api/spots/row?place_id=${encodeURIComponent(placeId)}`,
      { auth: false }
    )
    if (lookup.ok) {
      const id = await readUuid(lookup)
      if (id) setSpotDetailUuidCache(placeId, id)
      return id
    }
    if (lookup.status !== 404) {
      console.warn('ensureSpotId lookup failed:', lookup.status)
      return null
    }

    // 新規作成は認証済みユーザーだけが要求でき、表示名・座標などはサーバーが
    // Google Placesから検証して保存する。クライアント値はDBへ書き込ませない。
    const response = await wanspotFetch('/api/spots/ensure', {
      method: 'POST',
      json: { place_id: placeId },
    })

    if (!response.ok) {
      console.warn('ensureSpotId failed:', response.status)
      return null
    }

    const id = await readUuid(response)
    if (id) setSpotDetailUuidCache(placeId, id)
    return id
  } catch (e) {
    console.warn('ensureSpotId exception:', e)
    return null
  }
}
