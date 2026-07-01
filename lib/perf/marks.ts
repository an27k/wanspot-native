/** 起動・API・タブ表示の簡易計測（__DEV__ のみ console 出力） */

const marks = new Map<string, number>()
const origin = typeof performance !== 'undefined' ? performance.timeOrigin : Date.now()

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now() - origin
}

export function perfMark(label: string): void {
  marks.set(label, nowMs())
  if (__DEV__) console.log(`[perf] mark  ${label}`)
}

export async function perfAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = nowMs()
  try {
    return await fn()
  } finally {
    const ms = Math.round(nowMs() - t0)
    if (__DEV__) console.log(`[perf] ${label}: ${ms}ms`)
  }
}
