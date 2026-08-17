/**
 * イベントの住所から都道府県を解決する。
 *
 * 出典: wanspot(Web) src/lib/calendar/resolve-prefecture.ts — サーバー側が正。変更時はここも追随する。
 *
 * イベントは prefecture_id が埋まっていないものが多く、住所文字列だけが頼りになる
 * （例:「日本、〒238-0316 神奈川県横須賀市長井２丁目１４−１」）。
 * 外部APIもLLMも使わず、文字列だけで確定できる。
 */

/** 47都道府県。表記そのまま */
const PREFECTURE_NAMES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const

export type PrefectureName = (typeof PREFECTURE_NAMES)[number]

/**
 * 住所文字列から都道府県名を取り出す。
 *
 * 「京都府」を含む住所で「東京都」が先にマッチする、といった取り違えを防ぐため、
 * 出現位置が最も早いものを採る（住所は都道府県から始まる形式が基本）。
 * 郵便番号や「日本、」の接頭辞が付いていても影響しない。
 */
export function prefectureFromAddress(address: string | null | undefined): PrefectureName | null {
  const a = address?.trim()
  if (!a) return null

  let best: { name: PrefectureName; at: number } | null = null
  for (const name of PREFECTURE_NAMES) {
    const at = a.indexOf(name)
    if (at < 0) continue
    if (!best || at < best.at) best = { name, at }
  }
  return best?.name ?? null
}

/**
 * 住所 → 会場名 の順で都道府県を決める。
 * どちらからも読めなければ null（推測で埋めない。誤ったエリアを出すほうが害が大きい）。
 */
export function resolveEventPrefecture(input: {
  address?: string | null
  venue_name?: string | null
}): PrefectureName | null {
  return prefectureFromAddress(input.address) ?? prefectureFromAddress(input.venue_name)
}
