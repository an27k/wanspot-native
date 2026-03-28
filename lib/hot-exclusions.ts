/**
 * 検索「トレンド」用：カフェ・ふれあい・犬種名+CAFE・写真スタジオ等を除外（アウトドア系とジャンル被りを減らす）
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

export function isExcludedHotSpot(spot: { name: string; category?: string }): boolean {
  if (isExcludedHotSpotName(spot.name)) return true
  return isExcludedHotSpotCategory(spot.category ?? '')
}

export function filterHotSpotResults<T extends { name: string; category?: string }>(spots: T[]): T[] {
  return spots.filter((s) => !isExcludedHotSpot(s))
}
