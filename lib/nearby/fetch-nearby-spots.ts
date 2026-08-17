import {
  DOG_RUN_SEARCH_QUERY,
  DOG_RUN_SUPPLEMENTARY_SEARCH_QUERY,
  MAP_GENRE_CHIPS,
  NEARBY_MIN_SPOTS_THRESHOLD,
  NEARBY_RADIUS_EXPANSION_STEPS_M,
  URGENT_GENRES,
  URGENT_RADIUS_EXPANSION_STEPS_M,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import { sortDogRunSpotsByPriority } from '@/lib/nearby/dog-run-priority'
import { placeMatchesGenreFilter } from '@/lib/nearby/map-filter'
import { calcDistanceMeters } from '@/lib/nearby/geo'
import { wanspotFetch } from '@/lib/wanspot-api'
import type { PlaceResult } from '@/types/places'

async function fetchNearbyByType(
  lat: number,
  lng: number,
  radiusM: number,
  type: string
): Promise<PlaceResult[]> {
  const q = `/api/spots/nearby?lat=${lat}&lng=${lng}&radius=${radiusM}&type=${type}`
  const r = await wanspotFetch(q)
  let data: { spots?: PlaceResult[]; error?: string } = {}
  try {
    data = (await r.json()) as { spots?: PlaceResult[]; error?: string }
  } catch {
    return []
  }
  if (!r.ok) return []
  return data.spots ?? []
}

async function fetchDogRunSpotsForQuery(
  query: string,
  lat: number,
  lng: number,
  radiusM: number
): Promise<PlaceResult[]> {
  const q = `/api/spots/search?q=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}`
  const r = await wanspotFetch(q)
  let data: { spots?: PlaceResult[] } = {}
  try {
    data = (await r.json()) as { spots?: PlaceResult[] }
  } catch {
    return []
  }
  if (!r.ok) return []
  return (data.spots ?? [])
    .filter((spot) => placeMatchesGenreFilter(spot, 'dog_run'))
    .filter((spot) => calcDistanceMeters(lat, lng, spot.lat, spot.lng) <= radiusM)
}

async function fetchDogRunSpots(lat: number, lng: number, radiusM: number): Promise<PlaceResult[]> {
  // テキスト検索（Google 20件上限）と、収集済みDB併合ルート（/api/spots/nearby type=dog_run）を並列で引く。
  // 後者はサーバーがDBのドッグランを半径内で返すため、テキスト検索の取りこぼしを補える
  const [primary, fromDbRaw] = await Promise.all([
    fetchDogRunSpotsForQuery(DOG_RUN_SEARCH_QUERY, lat, lng, radiusM),
    fetchNearbyByType(lat, lng, radiusM, 'dog_run'),
  ])
  // 併合ルートには Google のキーワード検索ノイズ（サロン・病院等）が混ざるため、必ずジャンル述語を通す
  const fromDb = fromDbRaw.filter((spot) => placeMatchesGenreFilter(spot, 'dog_run'))
  const merged = new Map<string, PlaceResult>()
  for (const spot of [...primary, ...fromDb]) {
    if (spot.place_id) merged.set(spot.place_id, spot)
  }

  // 件数が閾値未満のときだけ「屋内ドッグラン」で補助検索する
  // （常時2クエリ投げると Places API コストが倍増するため、不足時限定）
  if (merged.size < NEARBY_MIN_SPOTS_THRESHOLD) {
    const supplementary = await fetchDogRunSpotsForQuery(DOG_RUN_SUPPLEMENTARY_SEARCH_QUERY, lat, lng, radiusM)
    for (const spot of supplementary) {
      if (spot.place_id && !merged.has(spot.place_id)) merged.set(spot.place_id, spot)
    }
  }

  const spots = [...merged.values()].map((spot) => ({ ...spot, category: 'ドッグラン' }))
  // 公営より民営・屋内・テーマパーク的なドッグランを優先表示（非表示にはしない）
  return sortDogRunSpotsByPriority(spots)
}

/**
 * アクティブジャンル1件のみ取得（Places コスト削減）。
 */
export async function fetchNearbySpotsForGenre(
  location: { lat: number; lng: number },
  radiusM: number,
  genre: MapGenreKey
): Promise<{ spots: PlaceResult[]; error: string | null }> {
  try {
    const raw =
      genre === 'dog_run'
        ? await fetchDogRunSpots(location.lat, location.lng, radiusM)
        : await fetchNearbyByType(location.lat, location.lng, radiusM, genre)

    const spots = raw.filter(
      (spot) =>
        spot.place_id &&
        calcDistanceMeters(location.lat, location.lng, spot.lat, spot.lng) <= radiusM &&
        placeMatchesGenreFilter(spot, genre)
    )

    return { spots, error: null }
  } catch {
    return {
      spots: [],
      error: 'うまく読み込めませんでした。通信環境を確認して、もう一度お試しください。',
    }
  }
}

/**
 * 全ジャンル取得（デフォルト表示用）: 6ジャンルを並列取得して place_id で重複排除する。
 * サーバー側は約1kmセル×24hの共有キャッシュを持つため、同一エリアの2回目以降は実コストが掛からない。
 * 初回セルのみ Places 実コール（ジャンル数ぶん）が発生する点は許容する（プロダクト判断）。
 */
export async function fetchAllNearbySpots(
  location: { lat: number; lng: number },
  radiusM: number
): Promise<{ spots: PlaceResult[]; error: string | null }> {
  const results = await Promise.all(
    MAP_GENRE_CHIPS.map((g) => fetchNearbySpotsForGenre(location, radiusM, g.key as MapGenreKey))
  )
  const merged = new Map<string, PlaceResult>()
  for (const r of results) {
    for (const spot of r.spots) {
      if (spot.place_id && !merged.has(spot.place_id)) merged.set(spot.place_id, spot)
    }
  }
  // 全ジャンル失敗のときだけエラー扱い（一部失敗は出せた分を表示する）
  const allFailed = results.every((r) => r.error != null)
  return { spots: [...merged.values()], error: allFailed ? (results[0]?.error ?? null) : null }
}

/** 全ジャンル版の段階拡張（件数不足なら半径を広げる） */
export async function fetchAllNearbySpotsWithExpansion(
  location: { lat: number; lng: number },
  minSpots = NEARBY_MIN_SPOTS_THRESHOLD
): Promise<{ spots: PlaceResult[]; error: string | null; radiusM: number }> {
  const steps = NEARBY_RADIUS_EXPANSION_STEPS_M
  let lastResult: { spots: PlaceResult[]; error: string | null; radiusM: number } | null = null

  for (const radiusM of steps) {
    const result = await fetchAllNearbySpots(location, radiusM)
    lastResult = { spots: result.spots, error: result.error, radiusM }
    if (result.error || result.spots.length >= minSpots) return lastResult
  }

  return lastResult ?? { spots: [], error: null, radiusM: steps[steps.length - 1] }
}

/**
 * 件数が閾値未満なら半径を段階的に拡張（既存 default 起点 → 上限まで）。
 */
export async function fetchNearbySpotsForGenreWithExpansion(
  location: { lat: number; lng: number },
  genre: MapGenreKey,
  minSpots = NEARBY_MIN_SPOTS_THRESHOLD
): Promise<{ spots: PlaceResult[]; error: string | null; radiusM: number }> {
  // 動物病院だけは 5km で打ち止めにしない。緊急時に「圏内に無い」は「無い」と同じ
  const steps = URGENT_GENRES.includes(genre)
    ? URGENT_RADIUS_EXPANSION_STEPS_M
    : NEARBY_RADIUS_EXPANSION_STEPS_M
  let lastResult: { spots: PlaceResult[]; error: string | null; radiusM: number } | null = null

  for (const radiusM of steps) {
    const result = await fetchNearbySpotsForGenre(location, radiusM, genre)
    lastResult = { spots: result.spots, error: result.error, radiusM }
    if (result.error || result.spots.length >= minSpots) return lastResult
  }

  return lastResult ?? { spots: [], error: null, radiusM: steps[steps.length - 1] }
}
