// wanspot カラートークン v10 — warm editorial / warm dark
export type ColorTokens = {
  gradient: {
    sunset: readonly [string, string, string]
  }
  brand: {
    primary: string
    onPrimary: string
    pillText: string
    accent: string
    gold: string
    tintWeak: string
    tintStrong: string
    vessel: string
    yellow: string
    yellowLight: string
  }
  text: {
    primary: string
    secondary: string
    tertiary: string
    meta: string
    hint: string
    disabled: string
    inverse: string
  }
  surface: {
    paper: string
    primary: string
    secondary: string
    tertiary: string
    raised: string
    alt: string
    input: string
    mapMuted: string
  }
  border: {
    default: string
    emphasis: string
    subtle: string
  }
  category: {
    park: string
    food: string
    retail: string
    fallback: string
  }
  semantic: {
    error: string
    errorMutedBg: string
    success: string
    successMutedBg: string
    warning: string
  }
  overlay: {
    scrim: string
    subtle: string
  }
  shadow: {
    default: string
  }
}

export const LIGHT_TOKENS = {
  gradient: {
    /** 液体・アバターリングのみ */
    sunset: ['#FF5E8A', '#FF7E5F', '#FEB47B'] as const,
  },
  brand: {
    primary: '#FF6757',
    onPrimary: '#FFFFFF',
    /** pill 等の濃いコーラル文字 */
    pillText: '#B23A28',
    accent: '#FF5E8A',
    gold: '#FFB347',
    tintWeak: '#FFF1EE',
    tintStrong: '#FFE3DE',
    /** VLOG カード（ダークの器） */
    vessel: '#1E1B19',
    /** @deprecated 旧 yellow — primary へ */
    yellow: '#FB6B53',
    /** @deprecated 旧 yellowLight — tintWeak へ */
    yellowLight: '#FFF0EC',
  },
  text: {
    primary: '#242220',
    secondary: '#77736D',
    tertiary: '#9A958E',
    meta: '#B7B1A9',
    hint: '#D8D2CA',
    disabled: '#ccc',
    inverse: '#FFFFFF',
  },
  surface: {
    paper: '#F8F6F1',
    primary: '#FFFFFF',
    secondary: '#F8F6F1',
    tertiary: '#FCFBF8',
    raised: '#FFFFFF',
    alt: '#F1EEE8',
    input: '#FFFFFF',
    mapMuted: '#E7E2DA',
  },
  border: {
    default: '#E7E2DA',
    emphasis: '#D8D2CA',
    subtle: '#F0ECE6',
  },
  category: {
    park: '#c8ddb0',
    food: '#ead8c5',
    retail: '#e2d5e8',
    fallback: '#f3f2ef',
  },
  semantic: {
    error: '#E84335',
    errorMutedBg: '#FFF0EE',
    success: '#2FA56A',
    successMutedBg: '#F0FDF4',
    warning: '#C87516',
  },
  overlay: {
    scrim: 'rgba(43,42,40,0.42)',
    subtle: 'rgba(36,34,32,0.08)',
  },
  shadow: {
    default: '#000000',
  },
} as const satisfies ColorTokens

export const DARK_TOKENS = {
  gradient: {
    /** ブランドグラデはモードをまたいで同じ色相を保つ */
    sunset: ['#FF5E8A', '#FF7E5F', '#FEB47B'] as const,
  },
  brand: {
    primary: '#FF7A68',
    /** 明るいコーラル面では濃色文字の方が読みやすい */
    onPrimary: '#241512',
    pillText: '#FFAA9D',
    accent: '#FF78A0',
    gold: '#FFC064',
    tintWeak: '#3A2420',
    tintStrong: '#4A2A25',
    /** VLOG カード（ダークの器） */
    vessel: '#1E1B19',
    /** @deprecated 旧 yellow — primary へ */
    yellow: '#FF7A68',
    /** @deprecated 旧 yellowLight — tintWeak へ */
    yellowLight: '#3A2420',
  },
  text: {
    primary: '#F7F2EC',
    secondary: '#BDB5AC',
    tertiary: '#918980',
    meta: '#766F68',
    hint: '#5F5852',
    disabled: '#6E6760',
    inverse: '#241512',
  },
  surface: {
    paper: '#151311',
    primary: '#201D1A',
    secondary: '#191715',
    tertiary: '#25211E',
    raised: '#292522',
    alt: '#302B27',
    input: '#28231F',
    mapMuted: '#302C28',
  },
  border: {
    default: '#39332E',
    emphasis: '#514840',
    subtle: '#2D2925',
  },
  category: {
    park: '#273824',
    food: '#3B2E24',
    retail: '#352B3B',
    fallback: '#2B2825',
  },
  semantic: {
    error: '#FF766A',
    errorMutedBg: '#42231F',
    success: '#50C48A',
    successMutedBg: '#173326',
    warning: '#F1B65C',
  },
  overlay: {
    scrim: 'rgba(0,0,0,0.64)',
    subtle: 'rgba(255,255,255,0.08)',
  },
  shadow: {
    default: '#000000',
  },
} as const satisfies ColorTokens

/** @deprecated テーマ非対応コードの互換用。新規コードは useAppTheme().colors を使う。 */
export const TOKENS = LIGHT_TOKENS
