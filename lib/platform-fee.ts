/**
 * 表示用: Next の PLATFORM_FEE_PERCENT と揃える（.env の EXPO_PUBLIC_PLATFORM_FEE_PERCENT）
 */
export function getPlatformFeePercent(): number {
  const raw = process.env.EXPO_PUBLIC_PLATFORM_FEE_PERCENT ?? '0'
  const n = parseFloat(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}
