import {
  DEFAULT_MAP_GENRE,
  DOG_RUN_RELEVANT_PATTERN,
  GROOMING_ONLY_NAME_PATTERN,
  MAP_GENRE_CHIPS,
  PET_HOTEL_RELEVANT_PATTERN,
  matchesGenre,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import { placeIsIndoorPetOk, placeIsTerracePetOk, type PetPolicySource } from '@/lib/nearby/pet-policy'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import type { PlaceResult } from '@/types/places'

const CAFE_GOOGLE_TYPES = new Set(['cafe', 'bakery', 'coffee_shop'])
const RESTAURANT_GOOGLE_TYPES = new Set(['restaurant', 'meal_takeaway', 'meal_delivery', 'bar', 'food'])
/** Google Places の正式 type（park/veterinary_care は legacy API でも安定して付与される） */
const PARK_GOOGLE_TYPES = new Set(['park'])
const VETERINARY_GOOGLE_TYPES = new Set(['veterinary_care'])

export type MapFilter =
  | { kind: 'genre'; genre: MapGenreKey }
  | { kind: 'like' }

/**
 * 地図フィルタの全体状態。indoorOnly はジャンル・いいね選択（active）と直交する常設トグルで、
 * ON のとき表示中の母集団を「店内OK確認済み（pet_indoor_allowed === true）」だけに絞る。
 * 排他選択の MapFilter に混ぜると解除時（active=null）にトグルが消えてしまうため別軸で持つ。
 */
export type MapFilterState = {
  active: MapFilter | null
  indoorOnly: boolean
}

/** indoorOnly が ON のときだけ「確認済み店内OK」述語で絞る（OFF なら母集団そのまま） */
export function applyIndoorOnlyFilter<T extends PetPolicySource>(items: T[], indoorOnly: boolean): T[] {
  return indoorOnly ? items.filter(placeIsIndoorPetOk) : items
}

/**
 * 条件フィルタ（店内OK・テラスOK・いいね）。ジャンル絞り込みと直交して重ね掛けできる。
 * フィルタバー最左のじょうごボタンに格納され、複数 ON は AND で合成する。
 */
export type MapConditionFilter = {
  indoorOnly: boolean
  terraceOnly: boolean
  likedOnly: boolean
}

export const EMPTY_MAP_CONDITIONS: MapConditionFilter = {
  indoorOnly: false,
  terraceOnly: false,
  likedOnly: false,
}

/** ON になっている条件の数（じょうごボタンのバッジ表示用） */
export function activeConditionCount(cond: MapConditionFilter): number {
  return Number(cond.indoorOnly) + Number(cond.terraceOnly) + Number(cond.likedOnly)
}

/** 条件フィルタを AND で適用する。isLiked はいいね判定（likedPlaceIds ＋ 楽観更新の合成を呼び出し側が渡す） */
export function applyMapConditions<T extends PetPolicySource>(
  items: T[],
  cond: MapConditionFilter,
  isLiked: (item: T) => boolean
): T[] {
  let out = items
  if (cond.indoorOnly) out = out.filter(placeIsIndoorPetOk)
  if (cond.terraceOnly) out = out.filter(placeIsTerracePetOk)
  if (cond.likedOnly) out = out.filter(isLiked)
  return out
}

export function isSameMapFilter(a: MapFilter | null, b: MapFilter): boolean {
  if (!a) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'genre' && b.kind === 'genre') return a.genre === b.genre
  return true
}

export function mapFilterLabel(f: MapFilter): string {
  if (f.kind === 'like') return 'いいね'
  const labels: Record<MapGenreKey, string> = {
    cafe: 'カフェ',
    park: '公園',
    restaurant: 'レストラン',
    dog_run: 'ドッグラン',
    veterinary_care: '動物病院',
    pet_hotel: 'ペットホテル',
  }
  return labels[f.genre]
}

export function inferSpotGenre(spot: SheetSpot): MapGenreKey {
  for (const g of MAP_GENRE_CHIPS) {
    if (matchesGenre(spot.category, g.key)) return g.key
  }
  return DEFAULT_MAP_GENRE
}

/** 選択ジャンルに合致するスポットだけ残す（カフェ選択時にレストランが混ざるのを防ぐ） */
export function placeMatchesGenreFilter(spot: PlaceResult, genre: MapGenreKey): boolean {
  if (genre === 'dog_run') {
    // Google types に dog_park が付いていれば、施設名に「ドッグラン」等の文言がなくても通す
    // （民営・屋内ドッグランは名前だけでは判定できないケースが多いため）。
    if ((spot.types ?? []).includes('dog_park')) return true
    const text = [spot.name, spot.address, spot.category]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .join(' ')
    return DOG_RUN_RELEVANT_PATTERN.test(text)
  }

  const types = (spot.types ?? []).map((t) => t.toLowerCase())
  const cat = spot.category ?? ''
  const catCafe = matchesGenre(cat, 'cafe')
  const catRestaurant = matchesGenre(cat, 'restaurant')

  if (genre === 'cafe' || genre === 'restaurant') {
    const hasCafeType = types.some((t) => CAFE_GOOGLE_TYPES.has(t))
    const hasRestaurantType = types.some((t) => RESTAURANT_GOOGLE_TYPES.has(t))

    if (genre === 'cafe') {
      if (hasRestaurantType && !hasCafeType && !catCafe) return false
      if (catRestaurant && !catCafe && !hasCafeType) return false
      return hasCafeType || catCafe
    }
    if (hasCafeType && !hasRestaurantType && !catRestaurant) return false
    if (catCafe && !catRestaurant && !hasRestaurantType) return false
    return hasRestaurantType || catRestaurant
  }

  if (genre === 'park') {
    // types に park が付いていれば、category ラベルが旧ロジック由来の汎用値でも通す
    if (types.some((t) => PARK_GOOGLE_TYPES.has(t))) return true
    return matchesGenre(cat, 'park')
  }

  if (genre === 'veterinary_care') {
    // veterinary_care は legacy API でも安定して付与されるため、types 一致を最優先で信頼する
    if (types.some((t) => VETERINARY_GOOGLE_TYPES.has(t))) return true
    return matchesGenre(cat, 'veterinary_care')
  }

  if (genre === 'pet_hotel') {
    // pet_hotel/grooming は Google Places に type が存在しない（Nearby/Text Search Legacy）ため、
    // types による判定はできない。名前がトリミング専業を示し、宿泊を示す語が一切ないものだけ除外する
    // （収集・検索側で既に「ペットホテル」意図の検索結果に絞られているため、除外は最小限に留める）。
    const name = spot.name ?? ''
    const groomingOnlySignal = GROOMING_ONLY_NAME_PATTERN.test(name)
    if (!groomingOnlySignal) return true
    // category は Nearby 側で「ペットホテル」に固定されがちなので判定材料に使わず、
    // 施設名・住所だけで宿泊を示す語の有無を見る
    const text = [name, spot.address]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .join(' ')
    return PET_HOTEL_RELEVANT_PATTERN.test(text)
  }

  return matchesGenre(cat, genre)
}
