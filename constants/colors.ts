import { TOKENS } from '@/constants/color-tokens'

export const colors = {
  brand: '#FFD84D',
  /** 主ボタン・CTA 用のやや薄い黄（`brand` よりソフト） */
  brandButton: '#FFE8A8',
  brandDark: '#e8c44a',
  background: '#ffffff',
  cardBg: '#f7f6f3',
  border: '#ebebeb',
  text: TOKENS.text.primary,
  textMuted: '#aaaaaa',
  textLight: '#666666',
  error: '#E84335',
  /** ワクチン「接種済」スタンプ（文字） */
  success: '#34A853',
  /** ワクチン「接種済」スタンプ背景 */
  successMutedBg: '#F0FDF4',
  /** 愛犬写真未登録の円背景（オーナー未設定の薄グレー調に合わせる） */
  dogPhotoPlaceholderBg: '#E8E8E8',
  /** 愛犬写真未登録の肉球アイコン色 */
  dogPhotoPlaceholderPaw: '#A0A0A0',
  /** ♂・オス・パパ表記用の薄い青 */
  genderMale: '#4A90D9',
  /** ♀・メス・ママ表記用の赤 */
  genderFemale: '#E84335',
} as const
