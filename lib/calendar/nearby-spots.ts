import { wanspotFetchJson } from '@/lib/wanspot-api'

/**
 * イベント周辺スポット。
 *
 * サーバ側で事前計算した結果を読むだけ。距離計算はしない
 * （スポットは約2万件あり、端末で毎回絞るのは無駄）。
 * イベント一覧APIには含めない。1か月ぶんを毎回運ぶことになるため、
 * 詳細を開いたときだけ取りに行く。
 */
export type NearbyKind = 'food' | 'play' | 'stay'

export type NearbySpot = {
  spot_id: string
  name: string
  category: string | null
  kind: NearbyKind
  distance_m: number
  rating: number | null
  reviews: number | null
  rank: number
}

export const NEARBY_KIND_LABEL: Record<NearbyKind, string> = {
  food: 'ごはん',
  play: '遊ぶ',
  stay: '泊まる',
}

/**
 * 何を基準に選んだ並びかを1行で示す。
 *
 * 「近い順」に見えると、遠いものが上にあることが不自然に映る。
 * 実際には評価で選んでおり、首都圏から遠いイベントでは宿を前面に出している。
 */
export function nearbyLeadText(spots: NearbySpot[]): string {
  const hasStay = spots.some((s) => s.kind === 'stay')
  return hasStay
    ? '日帰りには遠いので、ワンちゃんと泊まれる宿を中心に選んでいます。'
    : '近い順ではなく、評価の高いワンちゃんOKの店を選んでいます。'
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
