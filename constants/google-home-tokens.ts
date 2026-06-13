/**
 * Google Chrome 新規タブ風ホーム画面トークン。
 * 色差は Google 参考の3段階: 検索窓/AIピル(最暗) → チップ/検索ボタン(明) → カード(薄いガラス)
 * 背景グラデへのマスクは使わない。
 */
export const GOOGLE_HOME = {
  /** 背景グラデ（上→下: コーラル → ピンク → グリーン） */
  gradient: ['#FF8F5E', '#FF6B8A', '#4FD1A5'] as const,
  gradientLocations: [0, 0.48, 1] as const,

  /** Tier1: 検索窓・AIピル（Google の検索バー / AI Mode 相当・最暗） */
  searchBg: 'rgba(8, 7, 6, 0.76)',
  searchBorder: 'rgba(255,255,255,0.08)',
  searchPlaceholder: 'rgba(255,255,255,0.45)',
  searchText: '#FFFFFF',

  pillBg: 'rgba(8, 7, 6, 0.76)',
  pillBorder: 'rgba(255,255,255,0.08)',
  pillActiveBg: 'rgba(8, 7, 6, 0.84)',
  pillActiveBorder: 'rgba(255,255,255,0.12)',

  /** Tier2: 検索ボタン・キーワードチップ（検索窓内の明るいハイライト） */
  searchActionBg: 'rgba(255,255,255,0.18)',
  searchActionBorder: 'rgba(255,255,255,0.14)',

  /** Tier3: お散歩アラート / いいね / まとめカード（Google Discover 相当・薄いガラス） */
  panelBg: 'rgba(30, 28, 26, 0.34)',
  panelBgPressed: 'rgba(30, 28, 26, 0.46)',
  panelBorder: 'rgba(255,255,255,0.08)',
  blurIntensity: 20,
  blurTint: 'dark' as const,

  /** テキスト階層 */
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.78)',
  textMuted: 'rgba(255,255,255,0.50)',
  textKicker: 'rgba(255,255,255,0.55)',

  /** 角丸・余白 */
  radiusPill: 999,
  radiusPanel: 22,
  radiusSearch: 28,
  padH: 20,
  gapSection: 14,
  gapCard: 10,
} as const
