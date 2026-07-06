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

function shouldGuard(): boolean {
  if (Platform.OS !== 'ios') return false
  const major = parseIOSMajor(Platform.Version)
  return major != null && major >= 26
}

function safeToString(v: unknown): string {
  if (v instanceof Error) return v.message || 'Error'
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

let installed = false

/** iOS 26 + Hermes: Error.stack 参照で落ちる事例への対策。useEffect より前に同期実行する。 */
export function installIosSafeConsoleGuards(): void {
  if (installed || !shouldGuard()) return
  installed = true

  const origWarn = console.warn
  const origError = console.error

  console.warn = (...args: unknown[]) => origWarn(args.map(safeToString).join(' '))
  console.error = (...args: unknown[]) => origError(args.map(safeToString).join(' '))

  const anyGlobal = globalThis as {
    ErrorUtils?: { getGlobalHandler?: () => unknown; setGlobalHandler?: (h: unknown) => void }
  }
  const errorUtils = anyGlobal.ErrorUtils
  const prevHandler = errorUtils?.getGlobalHandler?.()
  if (errorUtils?.setGlobalHandler) {
    errorUtils.setGlobalHandler((err: unknown, isFatal?: boolean) => {
      const msg = safeToString(err)
      origError(`[globalError] fatal=${String(isFatal ?? false)} ${msg}`)
      if (typeof prevHandler === 'function') {
        try {
          ;(prevHandler as (e: unknown, f?: boolean) => void)(err, isFatal)
        } catch {
          // ignore
        }
      }
    })
  }
}

installIosSafeConsoleGuards()
