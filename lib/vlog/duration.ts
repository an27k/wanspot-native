import { DURATION_CLAMP, DURATION_FORMULA } from '@/lib/vlog/constants'

/** clamp(4 + Σusable×1.5 + 2, 10, 35) */
export function estimateVlogDurationSec(usableCutCount: number): number {
  const raw =
    DURATION_FORMULA.base + usableCutCount * DURATION_FORMULA.perUsable + DURATION_FORMULA.tail
  return Math.max(DURATION_CLAMP.min, Math.min(DURATION_CLAMP.max, raw))
}

export function durationSecToBeats(sec: number, beatSec: number): number {
  return Math.round(sec / beatSec)
}
