import {
  DEFAULT_MAP_GENRE,
  DOG_RUN_RELEVANT_PATTERN,
  MAP_GENRE_CHIPS,
  matchesGenre,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import type { SheetSpot } from '@/lib/nearby/sheet-spot'
import type { PlaceResult } from '@/types/places'

const CAFE_GOOGLE_TYPES = new Set(['cafe', 'bakery', 'coffee_shop'])
const RESTAURANT_GOOGLE_TYPES = new Set(['restaurant', 'meal_takeaway', 'bar', 'food'])

export type MapFilter =
  | { kind: 'genre'; genre: MapGenreKey }
  | { kind: 'like' }

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

  return matchesGenre(cat, genre)
}
