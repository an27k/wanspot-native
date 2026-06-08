/** VLOG 完成に必要な思い出メディア数（後から差し替え可能） */
export const VLOG_COMPLETION_TARGET = 12

export type VlogProgress = {
  progress: number
  remaining: number
  current: number
  target: number
}

/** 思い出メディア数から VLOG 進捗を算出 */
export function computeVlogProgress(memoryCount: number, target = VLOG_COMPLETION_TARGET): VlogProgress {
  const safeTarget = Math.max(1, target)
  const current = Math.max(0, Math.min(memoryCount, safeTarget))
  return {
    progress: current / safeTarget,
    remaining: Math.max(0, safeTarget - memoryCount),
    current,
    target: safeTarget,
  }
}
