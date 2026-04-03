/**
 * 検索タブ「トレンド」「AIレコメンド」の検索結果に共通で適用するフィルタ。
 * 精度向上のルールは随時ここへ追加する（呼び出し側は filterDiscoverRecommendSpots のみ使う）。
 * place_id / 名称パターンのブロックリストは lib/blocklist.ts を編集。
 *
 * 前提: 犬の飼い主が散歩・お出かけで立ち寄りたい施設・場（ドッグラン・公園・同伴可カフェ等）に寄せる。
 * 除外例:
 * - カフェ・ふれあい・犬種名+CAFE・写真スタジオ（アウトドア系クエリとジャンル被りを減らす）
 * - 観光地の銅像・記念碑など「犬連れの目的地」になりにくい POI（例: 忠犬ハチ公像）
 */

import { NAME_BLOCK_PATTERNS, PLACE_ID_BLOCKLIST } from '@/lib/blocklist'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 宿泊・観光タイプの除外判定で name + vicinity を見るときのシグナル */
const DOG_SIGNAL_KEYWORDS = ['犬', 'ペット', 'ドッグ', 'わん', '同伴', 'dog', 'pet']

function textHasDogSignal(text: string): boolean {
  const t = text
  for (const kw of DOG_SIGNAL_KEYWORDS) {
    if (kw === 'dog') {
      if (/dog/i.test(t)) return true
      continue
    }
    if (kw === 'pet') {
      if (/pet/i.test(t)) return true
      continue
    }
    if (t.includes(kw)) return true
  }
  return false
}

export type DiscoverSpotFilterInput = {
  place_id?: string
  name: string
  types?: string[]
  vicinity?: string
  /** 既存のカテゴリ列（フィルタで引き続き使用） */
  category?: string
}

function isLodgingLikeType(types: string[]): boolean {
  return types.some((x) => x === 'lodging' || x.toLowerCase() === 'hotel')
}

/** ルールD: tourist_attraction でも犬シグナルなしで通す secondary types */
const TOURIST_ATTRACTION_DOG_SIGNAL_PASS_TYPES = new Set([
  'cafe',
  'restaurant',
  'park',
  'lodging',
  'pet_store',
  'veterinary_care',
  'campground',
])

function typesIncludesNormalized(types: string[], value: string): boolean {
  const v = value.toLowerCase()
  return types.some((x) => x.toLowerCase() === v)
}

function typesIncludesAnyPassForTouristAttraction(types: string[]): boolean {
  return types.some((x) => TOURIST_ATTRACTION_DOG_SIGNAL_PASS_TYPES.has(x.toLowerCase()))
}

/** app/onboarding/dog.tsx の犬種から「その他」「MIX」は曖昧なので除外 */
const BREEDS_JP_RAW = [
  'キャバリアキングチャールズスパニエル',
  'ミニチュアシュナウザー',
  'アメリカンコッカースパニエル',
  'ウエストハイランドホワイトテリア',
  'ゴールデンレトリバー',
  'イタリアングレイハウンド',
  'ラブラドールレトリバー',
  'ジャックラッセルテリア',
  'フレンチブルドッグ',
  'ヨークシャーテリア',
  'シベリアンハスキー',
  'ボーダーコリー',
  'ビションフリーゼ',
  'ミニチュアピンシャー',
  'ボストンテリア',
  '日本スピッツ',
  'トイプードル',
  'ダックスフンド',
  'ポメラニアン',
  '柴犬',
  'マルチーズ',
  'ウェルシュコーギー',
  'パピヨン',
  '秋田犬',
  'チワワ',
  'シーズー',
  'パグ',
  'ビーグル',
  'サモエド',
] as const

/** 長い方を先に（部分一致の取り違えを減らす） */
const BREEDS_JP_SORTED = [...BREEDS_JP_RAW].sort((a, b) => b.length - a.length)

const BREEDS_EN_RAW = [
  'cavalier king charles spaniel',
  'miniature schnauzer',
  'american cocker spaniel',
  'west highland white terrier',
  'golden retriever',
  'italian greyhound',
  'labrador retriever',
  'jack russell terrier',
  'french bulldog',
  'frenchie',
  'yorkshire terrier',
  'siberian husky',
  'border collie',
  'bichon frise',
  'miniature pinscher',
  'boston terrier',
  'japanese spitz',
  'toy poodle',
  'dachshund',
  'pomeranian',
  'shiba inu',
  'maltese',
  'welsh corgi',
  'papillon',
  'akita inu',
  'chihuahua',
  'shih tzu',
  'shih-tzu',
  'cocker spaniel',
  'golden',
  'cavalier',
  'schnauzer',
  'labrador',
  'yorkie',
  'corgi',
  'poodle',
  'beagle',
  'shiba',
  'husky',
  'pug',
  'samoyed',
  'akita',
  'westie',
  'cocker',
  'lab',
] as const

const BREEDS_EN_SORTED = [...BREEDS_EN_RAW].sort((a, b) => b.length - a.length)

/** 犬種名の直後に CAFE / Cafe / cafe / カフェ（間に空白・中黒・& 可） */
const CAFE_AFTER_BREED =
  '(?:\\s|・|＆|&)*(?:カフェ|CAFE|Cafe|cafe|Café|café)'

const BREED_ALT_JP = BREEDS_JP_SORTED.map((b) => escapeRegExp(b)).join('|')
const BREED_ALT_EN = BREEDS_EN_SORTED.map((b) => escapeRegExp(b)).join('|')

const BREED_CAFE_RE = new RegExp(`(?:${BREED_ALT_JP}|${BREED_ALT_EN})${CAFE_AFTER_BREED}`, 'i')

const DOG_CAFE_RE =
  /犬カフェ|いぬカフェ|イヌカフェ|ドッグカフェ|ドックカフェ|わんこカフェ|ワンコカフェ|わんちゃんカフェ|ワンちゃんカフェ|ワンチャンカフェ|dog\s*caf[eé]|dog\s*cafe/i
const ANIMAL_CAFE_RE = /アニマルカフェ|animal\s*caf[eé]/i
/** 動物ふれあい・触れ合い系カフェ */
const PETTING_CAFE_RE = /ふれあいカフェ|フレアイカフェ|触れ合いカフェ|ふれあい\s*カフェ/i

/** ペット写真・スタジオ系（トレンドの外遊び系と被りやすい） */
const PHOTO_STUDIO_RE =
  /写真スタジオ|フォトスタジオ|ペット写真|撮影スタジオ|スタジオ撮影|ペットフォト|フォトペット|pet\s*photo|photo\s*studio|pet\s*studio|フォト\s*スタジオ/i

/**
 * 名前・カテゴリに含まれると「施設・おでかけ先」として残すヒント（像の近くの店などは除外しない）
 */
const VENUE_OR_PET_OUTING_HINT =
  /カフェ|CAFE|Café|café|コーヒー|COFFEE|スターバックス|Starbucks|ドトール|タリーズ|珈琲|喫茶|レストラン|RESTAURANT|ドッグラン|公園|パーク|PARK|広場|ホテル|HOTEL|宿|旅館|民宿|キャンプ|トリミング|動物病院|ペットショップ|ペット|イヌ|犬|わん|ワン|ドッグ|DOG|DOG\s*RUN|テラス|ビアガーデン|ショップ|SHOP|STORE|サロン|ビーチ|海水浴|道の駅|ファーム|牧場/i

/** 像・記念碑・モニュメントが「スポット本体」である名前（施設名ヒントが無いときだけ除外に使う） */
const MONUMENT_LIKE_NAME_RE =
  /忠犬ハチ公|ハチ公像|ハチ公|Hachiko|hachiko|Loyal\s*Dog\s*Hachiko|像$|銅像|記念碑|モニュメント|Monument|monument|Statue|statue|historical\s*landmark/i

/** カテゴリが記念物・観光ランドマーク寄り（同伴施設の語が無いとき） */
const MONUMENT_LIKE_CATEGORY_RE =
  /記念碑|銅像|モニュメント|ランドマーク|史跡|Monument|monument|Statue|statue|historical\s*landmark|tourist\s*attraction|観光名所|名所|ランドマーク/i

function matchesExcludedGenreText(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (DOG_CAFE_RE.test(t) || ANIMAL_CAFE_RE.test(t) || PETTING_CAFE_RE.test(t)) return true
  if (BREED_CAFE_RE.test(t)) return true
  if (PHOTO_STUDIO_RE.test(t)) return true
  return false
}

export function isExcludedHotSpotName(name: string): boolean {
  return matchesExcludedGenreText(name)
}

function isExcludedHotSpotCategory(category: string): boolean {
  return matchesExcludedGenreText(category)
}

/**
 * 犬のおでかけ先として不自然な「観光モニュメント単体」などを除外する。
 * 名前にカフェ・公園・ペット関連などが含まれる場合は近接施設とみなして残す。
 */
export function isExcludedIrrelevantLandmarkSpot(spot: { name: string; category?: string }): boolean {
  const name = spot.name.trim()
  const cat = (spot.category ?? '').trim()
  const combined = `${name} ${cat}`

  if (VENUE_OR_PET_OUTING_HINT.test(name) || VENUE_OR_PET_OUTING_HINT.test(cat)) return false

  if (MONUMENT_LIKE_NAME_RE.test(name)) return true

  if (cat && MONUMENT_LIKE_CATEGORY_RE.test(cat) && !VENUE_OR_PET_OUTING_HINT.test(combined)) return true

  return false
}

function isExcludedByBlocklistAndTypes(spot: DiscoverSpotFilterInput): boolean {
  const name = spot.name.trim()

  // ルールA：place_id ブロックリスト
  if (spot.place_id && PLACE_ID_BLOCKLIST.has(spot.place_id)) return true
  // ルールB：名称パターンブロック
  if (NAME_BLOCK_PATTERNS.some((re) => re.test(name))) return true

  // ルールC/D：Google types が無いときは判定しない（API 未対応時はスキップ）
  if (spot.types === undefined) return false

  const types = spot.types
  const nameVicinity = `${name}${spot.vicinity ?? ''}`

  // ルールC：宿泊施設は犬シグナル必須
  if (isLodgingLikeType(types) && !textHasDogSignal(nameVicinity)) return true

  // ルールD：tourist_attraction は犬シグナル必須（特定 types があれば通す）
  if (typesIncludesNormalized(types, 'tourist_attraction')) {
    if (!typesIncludesAnyPassForTouristAttraction(types) && !textHasDogSignal(nameVicinity)) {
      return true
    }
  }

  return false
}

export function isExcludedHotSpot(spot: DiscoverSpotFilterInput): boolean {
  if (isExcludedHotSpotName(spot.name)) return true
  if (isExcludedHotSpotCategory(spot.category ?? '')) return true
  if (isExcludedIrrelevantLandmarkSpot(spot)) return true
  if (isExcludedByBlocklistAndTypes(spot)) return true
  return false
}

export function filterDiscoverRecommendSpots<T extends DiscoverSpotFilterInput>(spots: T[]): T[] {
  return spots.filter((s) => !isExcludedHotSpot(s))
}

/** @deprecated filterDiscoverRecommendSpots と同一。互換用。 */
export const filterHotSpotResults = filterDiscoverRecommendSpots
