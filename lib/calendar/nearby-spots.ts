import { wanspotFetchJson } from '@/lib/wanspot-api'

/**
 * イベント周辺スポット。
 *
 * サーバ側で事前計算した結果を読むだけ。距離計算はしない
 * （スポットは約2万件あり、端末で毎回絞るのは無駄）。
 * イベント一覧APIには含めない。1か月ぶんを毎回運ぶことになるため、
 * 詳細を開いたときだけ取りに行く。
 */
export type NearbyRole = 'food' | 'play' | 'stay' | 'other'

export type NearbySpot = {
  spot_id: string
  name: string
  category: string | null
  role: NearbyRole
  distance_m: number
  rank: number
}

export const NEARBY_ROLE_LABEL: Record<NearbyRole, string> = {
  food: 'ごはん',
  play: '遊ぶ',
  stay: '泊まる',
  other: 'そのほか',
}

/** 1km未満はm、以遠は小数1桁のkm */
export function formatNearbyDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`
}

export async function fetchNearbySpots(eventId: string): Promise<NearbySpot[]> {
  try {
    const json = await wanspotFetchJson<{ spots?: NearbySpot[] }>(
      `/api/calendar/events/${encodeURIComponent(eventId)}/nearby`,
      { auth: false }
    )
    return Array.isArray(json?.spots) ? json.spots : []
  } catch {
    // 周辺スポットが出せなくてもイベント詳細は表示できる
    return []
  }
}
