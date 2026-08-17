import type { PlaceResult } from '@/types/places'

/** 屋内・インドアを示す語（民営ドッグランで需要が高い属性） */
const INDOOR_KEYWORDS = /(屋内|室内|インドア|indoor)/i

/** テーマパーク・リゾート的な民間レジャー施設を示唆する語 */
const PRIVATE_LEISURE_KEYWORDS = /(テーマパーク|リゾート|ガーデン|ヴィレッジ|ランド|フィールド|village|garden|resort|theme ?park)/i

/** 公営（市区町村・都道府県立）を示す語。除外はせず減点のみに使う */
const PUBLIC_OPERATOR_KEYWORDS = /(市営|区営|町営|村営|県営|都立|市立|区立|都営|国営|府営|道営)/i

/** 施設名そのものが「〇〇公園」であるドッグラン＝公園の一部区画である可能性が高い */
const PARK_NAME_SUFFIX_PATTERN = /公園/

/**
 * 民営・屋内・テーマパーク的なドッグランを優先表示するためのスコア。
 * 公営ドッグランを非表示にはせず、並び順の加点/減点にのみ使う。
 */
export function scoreDogRunPriority(spot: PlaceResult): number {
  const text = [spot.name, spot.address]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')

  let score = 0
  if (INDOOR_KEYWORDS.test(text)) score += 3
  if (PRIVATE_LEISURE_KEYWORDS.test(text)) score += 2
  if (PUBLIC_OPERATOR_KEYWORDS.test(text)) score -= 3
  if (PARK_NAME_SUFFIX_PATTERN.test(spot.name ?? '')) score -= 2

  const types = spot.types ?? []
  if (types.includes('park') && !types.includes('dog_park')) score -= 1

  return score
}

/**
 * スコア降順でソートする。同スコア帯は入力順（= 既存の距離順）を維持する。
 */
export function sortDogRunSpotsByPriority<T extends PlaceResult>(spots: T[]): T[] {
  return spots
    .map((spot, index) => ({ spot, index, score: scoreDogRunPriority(spot) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
    .map((entry) => entry.spot)
}
