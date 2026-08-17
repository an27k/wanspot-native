import type { OpeningPeriod } from '@/lib/business-hours'

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
  /** サーバー検証済みの拡張カテゴリ（dog_run / onsen）。名前の表記ゆれより優先する分類 */
  extended_category?: string | null
  /**
   * 営業時間。open_now ではなく periods を受け取り、判定はクライアントで毎回行う。
   * open_now は「その瞬間」を焼き込むので、24時間キャッシュに載せると嘘になる。
   */
  opening_hours?: { periods?: OpeningPeriod[] | null } | null
  /** テラス席のみ同伴可か（共通コントラクト） */
  pet_terrace_only?: boolean | null
  /** ペット同伴ステータス文字列（例: 'not_allowed'。共通コントラクト） */
  pet_friendly_status?: string | null
  /** ペット同伴情報が確認済みか（共通コントラクト） */
  pet_friendly_verified?: boolean | null
  /**
   * 自分の子を連れて行けるか（bring_own）／店の子に会いに行く店か（meet_dogs）。
   * 「ドッグカフェ」は日本語では両方を指すため名前では判別できない。
   * meet_dogs を候補から外さないと「連れて行ったら入れなかった」が起きる。
   */
  dog_interaction?: string | null
  /** 例:「大型犬不可」。大型犬の飼い主には可否そのものを決める情報 */
  pet_size_limit?: string | null
}
