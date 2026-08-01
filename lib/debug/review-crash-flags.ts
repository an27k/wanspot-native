/**
 * レビュータブ build 138 クラッシュ切り分け用フラグ。
 * .env: EXPO_PUBLIC_DISABLE_TUTORIAL_VIDEO=1 等
 */
// 注意: EXPO_PUBLIC_* はビルド時に静的置換されるため、
// process.env[key] の動的アクセスでは値が取れない。必ず静的に参照する。
function envFlag(v: string | undefined): boolean {
  return v === '1' || v === 'true'
}

/** Step3-A: チュートリアル動画（expo-video）を無効化 */
export const DISABLE_TUTORIAL_VIDEO = envFlag(process.env.EXPO_PUBLIC_DISABLE_TUTORIAL_VIDEO)

/** Step3-B: Skia 液体ゲージを無効化 */
export const DISABLE_LIQUID_GAUGE = envFlag(process.env.EXPO_PUBLIC_DISABLE_LIQUID_GAUGE)
