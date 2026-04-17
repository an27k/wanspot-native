import { Platform } from 'react-native'

function parseIOSMajor(version: unknown): number | null {
  if (typeof version === 'string') {
    const m = version.match(/^(\d+)/)
    if (!m) return null
    const n = Number(m[1])
    return Number.isFinite(n) ? n : null
  }
  if (typeof version === 'number') {
    const n = Math.floor(version)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * 端末・OS による広告のオンオフ。
 * 以前は iOS 26 + Hermes 向けにオフにしていたが、JSC 利用と iOS 18 側の検証を踏まえ iOS 26 も含めて有効化した。
 */
export function adsEnabledForDevice(): boolean {
  return true
}

/**
 * iOS 26+ で Hermes 利用時に console / ErrorUtils が stack 生成で落ちる事例があるため、
 * ルートで安全な logging に差し替える（広告のオンオフとは独立）。
 */
export function iosUsesSafeConsoleGuards(): boolean {
  if (Platform.OS !== 'ios') return false
  const major = parseIOSMajor(Platform.Version)
  return major != null && major >= 26
}
