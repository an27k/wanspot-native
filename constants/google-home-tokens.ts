/**
 * Google Chrome 新規タブ風ホーム画面トークン。
 * グラデ背景 + ダーク半透明ガラスパネル + 白文字階層。
 */
export const GOOGLE_HOME = {
  /** 背景グラデ（上→下: コーラル → ピンク → グリーン） */
  gradient: ['#FF8F5E', '#FF6B8A', '#4FD1A5'] as const,
  gradientLocations: [0, 0.52, 1] as const,

  /** ダークガラスパネル */
  panelBg: 'rgba(22, 20, 18, 0.58)',
  panelBgPressed: 'rgba(22, 20, 18, 0.72)',
  panelBorder: 'rgba(255,255,255,0.10)',
  blurIntensity: 28,
  blurTint: 'dark' as const,

  /** 検索バー */
  searchBg: 'rgba(16, 14, 13, 0.55)',
  searchBorder: 'rgba(255,255,255,0.08)',
  searchPlaceholder: 'rgba(255,255,255,0.45)',
  searchText: '#FFFFFF',

  /** ピル（非選択） */
  pillBg: 'rgba(16, 14, 13, 0.55)',
  pillBorder: 'rgba(255,255,255,0.08)',
  /** ピル（選択）— Google は白っぽいハイライト */
  pillActiveBg: 'rgba(255,255,255,0.20)',
  pillActiveBorder: 'rgba(255,255,255,0.22)',

  /** テキスト階層 */
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.78)',
  textMuted: 'rgba(255,255,255,0.50)',
  textKicker: 'rgba(255,255,255,0.55)',

  /** チップ */
  chipBg: 'rgba(16, 14, 13, 0.50)',
  chipBorder: 'rgba(255,255,255,0.08)',

  /** 角丸・余白 */
  radiusPill: 999,
  radiusPanel: 22,
  radiusSearch: 28,
  padH: 20,
  gapSection: 14,
  gapCard: 10,
} as const
