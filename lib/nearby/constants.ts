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

/** 「店内OK」常設フィルタの永続化キー（夏冬の常用条件になるため選択状態を保存する）
 *  @deprecated v96 で NEARBY_MAP_CONDITIONS_STORAGE_KEY へ移行（読み取りマイグレーションのみ残置） */
export const NEARBY_INDOOR_ONLY_STORAGE_KEY = 'nearby_indoor_only_v1'

/** 条件フィルタ（店内OK・テラスOK・いいね）の永続化キー（MapConditionFilter を JSON 保存） */
export const NEARBY_MAP_CONDITIONS_STORAGE_KEY = 'nearby_map_conditions_v1'

/** ジャンル永続化で「全ジャンル表示」を表す番兵値 */
export const NEARBY_GENRE_ALL = 'all'

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
    match: ['動物病院', '獣医', 'アニマルクリニック', 'アニマルホスピタル', 'veterinary', 'animal hospital', 'animal clinic'],
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
/** 主検索で件数が不足したときだけ追加で投げる補助クエリ（民営・屋内施設の取り漏らし対策） */
export const DOG_RUN_SUPPLEMENTARY_SEARCH_QUERY = '屋内ドッグラン'

/**
 * 民営・屋内ドッグランは「〇〇ガーデン」「△△ヴィレッジ」等の独自ブランド名が多く、
 * 施設名に「ドッグラン」という文言そのものが入らないケースが多い。
 * name/address からも拾えるよう、犬の運動施設を示唆する語を広めに列挙する
 * （汎用的すぎる単語は誤ヒットを避けるため入れない）。
 */
export const DOG_RUN_RELEVANT_PATTERN =
  /(ドッグラン|ドッグパーク|ドッグガーデン|ドッグヴィレッジ|ドッグフィールド|ドッグエリア|わんこの広場|犬の遊び場|犬の広場|ノーリード広場|ペットラン|dog ?run|dog ?park|dog ?garden|dog ?village|dog ?field|off.?leash)/i

/**
 * Google Places に `pet_hotel`/`grooming` type は存在しない（実在するのは
 * `pet_boarding_service`/`pet_care` だが、これらは Places API (New) 限定で、
 * 本アプリが使う Nearby/Text Search (Legacy) の `types[]` には出現しない）。
 * そのため types による救済はできず、名前ベースの正規表現が唯一の判定材料になる。
 */
export const PET_HOTEL_RELEVANT_PATTERN =
  /(ホテル|わんこ ?の ?宿|犬 ?の ?宿|お泊り|おとまり|一時預かり|宿泊|ケンネル|kennel|hotel|pet ?boarding|dog ?boarding|boarding)/i

/** 名前がトリミング（グルーミング）専業を強く示唆する語。宿泊系の語が併記されていなければペットホテルから除外する */
export const GROOMING_ONLY_NAME_PATTERN = /(トリミング(サロン|専門|ルーム)?|グルーミング|grooming)/i

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
