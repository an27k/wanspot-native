/**
 * 犬種マスター（オンボーディング・プロフィール共通）。
 * 元: app/onboarding/dog.tsx の BREEDS 一覧。
 */
export const DOG_BREEDS = [
  'トイプードル',
  'チワワ',
  'ダックスフンド',
  'ポメラニアン',
  'ミニチュアシュナウザー',
  'フレンチブルドッグ',
  '柴犬',
  'ヨークシャーテリア',
  'マルチーズ',
  'シーズー',
  'ゴールデンレトリバー',
  'キャバリアキングチャールズスパニエル',
  'パピヨン',
  'ウェルシュコーギー',
  'ラブラドールレトリバー',
  'ビションフリーゼ',
  'ボーダーコリー',
  'パグ',
  'シベリアンハスキー',
  'イタリアングレイハウンド',
  'ジャックラッセルテリア',
  'サモエド',
  '日本スピッツ',
  '秋田犬',
  'ミニチュアピンシャー',
  'ウエストハイランドホワイトテリア',
  'ボストンテリア',
  'アメリカンコッカースパニエル',
  'ビーグル',
  'ミックス',
  'わからない',
] as const

export type DogBreed = (typeof DOG_BREEDS)[number]

/** ホットスポット犬種フィルタ等で曖昧扱いするラベル */
export const DOG_BREED_AMBIGUOUS = new Set(['ミックス', 'わからない', 'MIX（ミックス犬）', 'その他'])

export function filterDogBreeds(query: string): DogBreed[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...DOG_BREEDS]
  return DOG_BREEDS.filter((b) => b.toLowerCase().includes(q))
}
