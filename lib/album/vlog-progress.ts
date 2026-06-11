import type { VisitPlate } from '@/lib/visits-memories'
import { MIN_MEDIA_PER_UNIT, VLOG_COMPLETION_TARGET } from '@/lib/vlog/constants'

export { VLOG_COMPLETION_TARGET }

export type SpotVlogUnit = {
  spotId: string
  spotName: string
  memoryCount: number
  /** min(1, 添付数/2) */
  contribution: number
  isComplete: boolean
  needsOneMore: boolean
}

export type VlogProgress = {
  progress: number
  remaining: number
  current: number
  target: number
  totalContribution: number
  completeUnits: number
  units: SpotVlogUnit[]
  isUnlocked: boolean
  isNearUnlock: boolean
  nudgeSpot: SpotVlogUnit | null
}

function spotContribution(memoryCount: number): number {
  return Math.min(1, memoryCount / MIN_MEDIA_PER_UNIT)
}

/** スポット単位にメディア数を集約 */
export function aggregateSpotUnits(plates: VisitPlate[]): SpotVlogUnit[] {
  const bySpot = new Map<string, SpotVlogUnit>()

  for (const plate of plates) {
    const existing = bySpot.get(plate.spot_id)
    const memoryCount = (existing?.memoryCount ?? 0) + plate.memories.length
    bySpot.set(plate.spot_id, {
      spotId: plate.spot_id,
      spotName: plate.spot.name,
      memoryCount,
      contribution: spotContribution(memoryCount),
      isComplete: memoryCount >= MIN_MEDIA_PER_UNIT,
      needsOneMore: memoryCount === 1,
    })
  }

  return [...bySpot.values()].sort((a, b) => b.contribution - a.contribution)
}

/** @deprecated aggregateSpotUnits + computeVlogProgressFromPlates を使用 */
export function countReviewedSpots(plates: { spot_id: string }[]): number {
  return new Set(plates.map((p) => p.spot_id)).size
}

export function computeVlogProgressFromPlates(
  plates: VisitPlate[],
  target = VLOG_COMPLETION_TARGET
): VlogProgress {
  const units = aggregateSpotUnits(plates)
  const safeTarget = Math.max(1, target)
  const totalContribution = units.reduce((sum, u) => sum + u.contribution, 0)
  const completeUnits = units.filter((u) => u.isComplete).length
  const current = Math.min(safeTarget, totalContribution)
  const nudgeCandidates = units.filter((u) => u.needsOneMore)
  const nudgeSpot =
    nudgeCandidates.length > 0
      ? nudgeCandidates.sort((a, b) => b.memoryCount - a.memoryCount)[0]
      : null

  return {
    progress: Math.min(1, totalContribution / safeTarget),
    remaining: Math.max(0, safeTarget - totalContribution),
    current: Math.floor(Math.min(safeTarget, totalContribution)),
    target: safeTarget,
    totalContribution,
    completeUnits,
    units,
    isUnlocked: totalContribution >= safeTarget,
    isNearUnlock: !totalContribution || totalContribution >= safeTarget ? false : completeUnits === safeTarget - 1,
    nudgeSpot,
  }
}

/** 後方互換: 整数スポット数ベース */
export function computeVlogProgress(reviewedSpotCount: number, target = VLOG_COMPLETION_TARGET): Omit<VlogProgress, 'units' | 'totalContribution' | 'completeUnits' | 'isUnlocked' | 'isNearUnlock' | 'nudgeSpot'> {
  const safeTarget = Math.max(1, target)
  const current = Math.max(0, Math.min(reviewedSpotCount, safeTarget))
  return {
    progress: current / safeTarget,
    remaining: Math.max(0, safeTarget - reviewedSpotCount),
    current,
    target: safeTarget,
  }
}
