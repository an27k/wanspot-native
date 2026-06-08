/** 地図・近傍スポット取得の上限半径（メートル） */
export const NEARBY_RADIUS_M = 5000

/** 件数不足時に段階拡張する半径（既存 3km 相当 → 上限 5km） */
export const NEARBY_RADIUS_EXPANSION_STEPS_M = [3000, NEARBY_RADIUS_M] as const

/** この件数未満なら次の半径へ自動拡張 */
export const NEARBY_MIN_SPOTS_THRESHOLD = 5

/** 行った（チェックイン）ピン・ソートアイコン */
export const MAP_VISITED_CHECK_COLOR = '#2FA56A'

/** ボトムシート初期スナップ（1 = 55%・4枚目スクショ相当） */
export const NEARBY_DEFAULT_SHEET_INDEX = 1

export const NEARBY_MAP_GENRE_STORAGE_KEY = 'nearby_map_genre_v1'

/** 地図上ジャンル（6種）。icon は Ionicons 名、match は category 文字列照合用キーワード。 */
export const MAP_GENRE_CHIPS = [
  { key: 'cafe', label: 'カフェ', icon: 'cafe', match: ['カフェ', 'cafe', 'コーヒー', '珈琲', '喫茶'] },
  { key: 'park', label: '公園', icon: 'leaf', match: ['公園', 'パーク', 'park', '広場', '緑地'] },
  {
    key: 'restaurant',
    label: 'レストラン',
    icon: 'restaurant',
    match: ['レストラン', 'restaurant', '食堂', 'ダイニング', 'food', '飲食'],
  },
  {
    key: 'dog_run',
    label: 'ドッグラン',
    icon: 'paw',
    match: ['ドッグラン', 'ドッグパーク', '犬の広場', 'dog run', 'dog park', 'dogrun'],
  },
  {
    key: 'veterinary_care',
    label: '動物病院',
    icon: 'medkit',
    match: ['動物病院', '獣医', 'veterinary', 'animal hospital'],
  },
  {
    key: 'pet_hotel',
    label: 'ペットホテル',
    icon: 'bed',
    match: ['ペットホテル', 'pet hotel', 'pethotel', 'ペット ホテル'],
  },
] as const

export type MapGenreKey = (typeof MAP_GENRE_CHIPS)[number]['key']

/** Snapchat 風マップピンのジャンル別アクセントカラー（フラットで鮮やか） */
export const MAP_GENRE_COLOR: Record<MapGenreKey, string> = {
  cafe: '#F2A33C', // アンバー
  park: '#3FB56B', // グリーン
  restaurant: '#FF6B5E', // コーラル
  dog_run: '#4E97F2', // ブルー
  veterinary_care: '#FF7BA8', // ピンク
  pet_hotel: '#9B7BE8', // パープル
}

/** Snapchat 風の「いいね」ハートの赤 */
export const MAP_LIKE_COLOR = '#FA3C4C'

export const DEFAULT_MAP_GENRE: MapGenreKey = 'cafe'

/** category 文字列が指定ジャンルに該当するか（❤︎/☑︎ タブのジャンル絞り込み用） */
export function matchesGenre(category: string | null | undefined, genre: MapGenreKey): boolean {
  if (!category) return false
  const def = MAP_GENRE_CHIPS.find((g) => g.key === genre)
  if (!def) return false
  const lower = category.toLowerCase()
  return def.match.some((kw) => lower.includes(kw.toLowerCase()))
}

export const DOG_RUN_SEARCH_QUERY = 'ドッグラン'
export const DOG_RUN_RELEVANT_PATTERN = /(ドッグラン|ドッグパーク|犬の広場|dog ?run|dog ?park)/i

/** @deprecated 全ジャンル並列取得用。地図タブではジャンル単位 fetch に移行 */
export const NEARBY_GENRE_TYPES = [
  'cafe',
  'park',
  'restaurant',
  'veterinary_care',
  'pet_hotel',
  'pet_store',
  'grooming',
] as const

export type NearbyGenreType = (typeof NEARBY_GENRE_TYPES)[number]
