import { TOKENS } from '@/constants/color-tokens'

export const colors = {
  /** ブランド主色（Snapchat の黄に相当する wanspot のオレンジ） */
  brand: '#FF8A1F',
  /** 主ボタン・CTA 用のややソフトなオレンジ（`brand` より明るめ・濃いテキスト前提） */
  brandButton: '#FFC785',
  brandDark: '#E5740A',
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
