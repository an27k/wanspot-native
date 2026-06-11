/**
 * レビュータブ build 138 クラッシュ切り分け用フラグ。
 * .env: EXPO_PUBLIC_DISABLE_TUTORIAL_VIDEO=1 等
 */
function envFlag(key: string): boolean {
  const v = process.env[key]
  return v === '1' || v === 'true'
}

/** Step3-A: チュートリアル動画（expo-video）を無効化 */
export const DISABLE_TUTORIAL_VIDEO = envFlag('EXPO_PUBLIC_DISABLE_TUTORIAL_VIDEO')

/** Step3-B: Skia 液体ゲージを無効化 */
export const DISABLE_LIQUID_GAUGE = envFlag('EXPO_PUBLIC_DISABLE_LIQUID_GAUGE')

/** Step3-B: スクロール連動タブバー（reanimated）を無効化 */
export const DISABLE_TABBAR_SCROLL = envFlag('EXPO_PUBLIC_DISABLE_TABBAR_SCROLL')
