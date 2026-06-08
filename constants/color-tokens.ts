// wanspot カラートークン v7 — 暖色グラデ・ブランド刷新（native / web 記事で共有）
export const TOKENS = {
  gradient: {
    sunset: ['#FF5E8A', '#FF7E5F', '#FEB47B'] as const,
  },
  brand: {
    primary: '#FB6B53',
    accent: '#FF5E8A',
    gold: '#FFB347',
    tintWeak: '#FFF0EC',
    tintStrong: '#FFE3DA',
    /** @deprecated 旧 yellow — primary へ */
    yellow: '#FB6B53',
    /** @deprecated 旧 yellowLight — tintWeak へ */
    yellowLight: '#FFF0EC',
  },
  text: {
    primary: '#2A2522',
    secondary: '#7A726B',
    tertiary: '#9a9792',
    meta: '#bbb8b2',
    hint: '#d9d6d0',
    disabled: '#ccc',
  },
  surface: {
    paper: '#FBF7F2',
    primary: '#FFFFFF',
    secondary: '#FBF7F2',
    tertiary: '#faf9f6',
    alt: '#f3f2ef',
    mapMuted: '#e8e5df',
  },
  border: {
    default: '#EFE7DE',
    emphasis: '#e0e0e0',
    subtle: '#f0eee9',
  },
  category: {
    park: '#c8ddb0',
    food: '#ead8c5',
    retail: '#e2d5e8',
    fallback: '#f3f2ef',
  },
  semantic: {
    error: '#E84335',
    success: '#2FA56A',
    successMutedBg: '#F0FDF4',
  },
} as const
