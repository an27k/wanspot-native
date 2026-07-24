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
  /** Google Places のレビュー件数（API が返す場合） */
  user_ratings_total?: number | null
  price_level: number | null
  /** Google Maps 風の価格帯表示（例: ¥1,000–2,000） */
  price_label?: string | null
  /** Google Places types（検索レスポンスに含まれる場合） */
  types?: string[]
  /** 近傍表示用の短い所在地 */
  vicinity?: string
  /** 店内へのペット同伴可否（共通コントラクト。サーバー未対応時は undefined、未確認は null） */
  pet_indoor_allowed?: boolean | null
  /** テラス席のみ同伴可か（共通コントラクト） */
  pet_terrace_only?: boolean | null
  /** ペット同伴ステータス文字列（例: 'not_allowed'。共通コントラクト） */
  pet_friendly_status?: string | null
  /** ペット同伴情報が確認済みか（共通コントラクト） */
  pet_friendly_verified?: boolean | null
}
