/**
 * スポットが「滞在系」か「通過系」かを分類する。
 * 滞在系 = 一定時間留まることが前提のスポット（この後に長い移動は非現実的）
 * 通過系 = 立ち寄り・散歩など、移動の延長として成立するスポット
 */

const STAY_CATEGORIES = [
  'ドッグラン',
  'カフェ',
  'レストラン',
  'ペットショップ',
  'ペットホテル',
  '温泉',
  '宿泊施設',
  'ホテル',
  '美容室',
  'トリミング',
  '動物病院',
  '観光施設',
  '博物館',
  '美術館',
  'テーマパーク',
]

const PASS_THROUGH_CATEGORIES = ['公園', '散歩コース', '神社', '寺', '河川敷', '海岸', '遊歩道']

export type SpotStayType = 'stay' | 'pass_through'

export function classifySpot(category: string | null | undefined): SpotStayType {
  if (!category) return 'pass_through' // 不明は緩い扱い

  if (STAY_CATEGORIES.some((c) => category.includes(c))) {
    return 'stay'
  }
  if (PASS_THROUGH_CATEGORIES.some((c) => category.includes(c))) {
    return 'pass_through'
  }

  // デフォルト：カテゴリ不明は滞在系扱い（安全側）
  return 'stay'
}
