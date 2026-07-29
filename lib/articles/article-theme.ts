/**
 * 記事の theme「【エリア】ジャンルおすすめ」からエリア名とジャンルを導出する。
 * category 列が全件 "general" のため、タブ絞り込み・エリアラベル表示はここが真実源。
 * theme の形式が変わっても壊れないよう、抽出できなければ null を返すフェイルソフト設計。
 */

export type ArticleGenreKey =
  | 'cafe'
  | 'park'
  | 'dog_run'
  | 'restaurant'
  | 'hotel'
  | 'onsen'
  | 'indoor'
  | 'shopping'
  | 'camp'

export type ArticleThemeInfo = {
  /** 例: 東京都・軽井沢・関西（【】内） */
  area: string | null
  genre: ArticleGenreKey | null
  genreLabel: string | null
}

/** チップ表示順（飼い主の利用頻度順） */
export const ARTICLE_GENRE_CHIPS: { key: ArticleGenreKey; label: string; pattern: RegExp }[] = [
  { key: 'cafe', label: 'カフェ', pattern: /カフェ/ },
  { key: 'park', label: '公園', pattern: /公園/ },
  { key: 'dog_run', label: 'ドッグラン', pattern: /ドッ[グク]ラン/ },
  { key: 'restaurant', label: 'レストラン', pattern: /レストラン/ },
  { key: 'hotel', label: 'お泊まり', pattern: /泊まれる|宿|ホテル/ },
  { key: 'onsen', label: '温泉', pattern: /温泉/ },
  { key: 'indoor', label: '雨の日OK', pattern: /雨の日|屋内/ },
  { key: 'shopping', label: 'モール', pattern: /ショッピング|モール/ },
  { key: 'camp', label: 'キャンプ', pattern: /キャンプ/ },
]

export function parseArticleTheme(theme: string | null | undefined): ArticleThemeInfo {
  const t = theme?.trim() ?? ''
  if (!t) return { area: null, genre: null, genreLabel: null }

  const areaMatch = /^【(.+?)】/.exec(t)
  const area = areaMatch?.[1]?.trim() || null
  const rest = areaMatch ? t.slice(areaMatch[0].length) : t

  for (const chip of ARTICLE_GENRE_CHIPS) {
    if (chip.pattern.test(rest)) return { area, genre: chip.key, genreLabel: chip.label }
  }
  return { area, genre: null, genreLabel: null }
}
