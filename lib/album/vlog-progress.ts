/** 初回 VLOG 完成に必要なレビュー済みスポット数 */
export const VLOG_COMPLETION_TARGET = 5

export type VlogProgress = {
  progress: number
  remaining: number
  current: number
  target: number
}

/** レビュー済みスポット数（ユニーク spot_id）から VLOG 進捗を算出 */
export function computeVlogProgress(reviewedSpotCount: number, target = VLOG_COMPLETION_TARGET): VlogProgress {
  const safeTarget = Math.max(1, target)
  const current = Math.max(0, Math.min(reviewedSpotCount, safeTarget))
  return {
    progress: current / safeTarget,
    remaining: Math.max(0, safeTarget - reviewedSpotCount),
    current,
    target: safeTarget,
  }
}

/** VisitPlate 配列からユニークスポット数を数える */
export function countReviewedSpots(plates: { spot_id: string }[]): number {
  return new Set(plates.map((p) => p.spot_id)).size
}
