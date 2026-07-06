/**
 * レビュータブ build 138 クラッシュ切り分け用フラグ。
 * .env: EXPO_PUBLIC_DISABLE_TUTORIAL_VIDEO=1 等
 */
// 注意: EXPO_PUBLIC_* はビルド時に静的置換されるため、
// process.env[key] の動的アクセスでは値が取れない。必ず静的に参照する。
import { Platform } from 'react-native'

function envFlag(v: string | undefined): boolean {
  return v === '1' || v === 'true'
}

function ios26OrLater(): boolean {
  if (Platform.OS !== 'ios') return false
  const v = Platform.Version
  const major = typeof v === 'string' ? Number(v.split('.')[0]) : typeof v === 'number' ? Math.floor(v) : NaN
  return Number.isFinite(major) && major >= 26
}

/** Step3-A: チュートリアル動画（expo-video）を無効化 */
export const DISABLE_TUTORIAL_VIDEO = envFlag(process.env.EXPO_PUBLIC_DISABLE_TUTORIAL_VIDEO)

/** Step3-B: Skia 液体ゲージを無効化 */
export const DISABLE_LIQUID_GAUGE = envFlag(process.env.EXPO_PUBLIC_DISABLE_LIQUID_GAUGE)

/** Step3-B: スクロール連動タブバー（reanimated）を無効化 — iOS 26 では既定 ON */
export const DISABLE_TABBAR_SCROLL =
  envFlag(process.env.EXPO_PUBLIC_DISABLE_TABBAR_SCROLL) ||
  (envFlag(process.env.EXPO_PUBLIC_ENABLE_TABBAR_SCROLL) ? false : ios26OrLater())
