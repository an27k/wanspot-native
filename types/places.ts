/** Web lib/places.ts PlaceResult と同等 */
export type PlaceResult = {
  place_id: string
  name: string
  category: string
  lat: number
  lng: number
  address: string
  photo_ref: string | null
  rating: number | null
  price_level: number | null
  /** Google Places types（検索レスポンスに含まれる場合） */
  types?: string[]
  /** 近傍表示用の短い所在地 */
  vicinity?: string
}
