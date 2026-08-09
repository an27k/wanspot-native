import { wanspotFetchJson } from '@/lib/wanspot-api'

/**
 * イベント周辺スポット。
 *
 * サーバ側で事前計算した結果を読むだけ。距離計算はしない
 * （スポットは約2万件あり、端末で毎回絞るのは無駄）。
 * イベント一覧APIには含めない。1か月ぶんを毎回運ぶことになるため、
 * 詳細を開いたときだけ取りに行く。
 */
/**
 * 周辺スポットの種別。
 *
 * 'play' は使わなくなった（サーバ側で枠ごと廃止）。中身の78%が
 * ドッグラン単体とただの公園で、イベント帰りの行き先になっていなかった。
 * 古い端末が古いデータを持っている場合に備えて型には残す。
 */
export type NearbyKind = 'food' | 'play' | 'stay'

export type NearbySpot = {
  spot_id: string
  name: string
  category: string | null
  /** スポット詳細は place_id を鍵に開く。無いと遷移できない */
  place_id: string | null
  address: string | null
  lat: number | null
  lng: number | null
  photo_ref: string | null
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

/** 1km未満はm、以遠は小数1桁のkm */
export function formatNearbyDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`
}

/**
 * スポット詳細へ渡す形に均す。
 * place_id が無いものは詳細を開けないので、一覧にも出さない
 * （押しても Unmatched Route になるだけ）。
 */
export function toPlaceResult(spot: NearbySpot) {
  return {
    place_id: spot.place_id ?? '',
    name: spot.name,
    category: spot.category ?? '',
    address: spot.address ?? '',
    lat: spot.lat ?? 0,
    lng: spot.lng ?? 0,
    photo_ref: spot.photo_ref ?? null,
    rating: spot.rating ?? null,
    price_level: null,
    price_label: null,
    user_ratings_total: spot.reviews ?? null,
  }
}

export async function fetchNearbySpots(eventId: string): Promise<NearbySpot[]> {
  try {
    const json = await wanspotFetchJson<{ spots?: NearbySpot[] }>(
      `/api/calendar/events/${encodeURIComponent(eventId)}/nearby`,
      { auth: false }
    )
    const spots = Array.isArray(json?.spots) ? json.spots : []
    // place_id が無いと詳細を開けない。押せないものを並べない
    return spots.filter((s) => Boolean(s.place_id))
  } catch (error) {
    // 周辺スポットが出せなくてもイベント詳細は表示できる
    console.warn('[calendar/nearby] nearby spots request failed', error)
    return []
  }
}
