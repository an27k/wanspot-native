export const featureFlags = {
  events: process.env.EXPO_PUBLIC_ENABLE_EVENTS === 'true',
} as const

/**
 * featureFlags のデバッグ用文字列出力
 * 開発時にログ確認用
 */
export function getFeatureFlagsDebugInfo(): string {
  return JSON.stringify(featureFlags, null, 2)
}
