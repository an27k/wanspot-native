/**
 * 生成可否判定（readiness）— エピソードが「受け取って嬉しい完成品」になるかを
 * 既存の2層品質ゲートを流用して見積もる。SetLog の E2（自動報酬）を成立させる要:
 * 提案した以上は必ず見られる品質で返すため、提案前にここで落とす。
 * 純関数のみ。クラウド解析前のヒューリスティックスコアで判定し、
 * 生成実行時に build-payload 側でクラウドスコアに置き換わる前提。
 */
import { estimateVlogDurationSec } from '@/lib/vlog/duration'
import {
  collectCandidates,
  countRescueCuts,
  countUsableCuts,
  selectCutsTwoLayerGate,
} from '@/lib/vlog/quality-gate'
import {
  MIN_CUTS_TO_OFFER,
  READY_AVG_RANK,
  READY_CUT_COUNT,
} from '@/lib/vlog-auto/constants'
import type { VlogEpisode } from '@/lib/vlog-auto/episode'

export type VlogReadinessGrade = 'ready' | 'almost' | 'insufficient'

export type VlogReadiness = {
  grade: VlogReadinessGrade
  /** 0-1。提案の優先度タイブレークと「あと少し」ナッジ文言に使う */
  score: number
  usableCutCount: number
  rescueCutCount: number
  /** ユニット数（スポット or 日次ログ単位） */
  unitCount: number
  estimatedDurationSec: number
  /** insufficient / almost の理由（ナッジ表示用） */
  shortfall: 'no_media' | 'need_more_media' | 'low_quality' | null
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function assessEpisodeReadiness(episode: VlogEpisode): VlogReadiness {
  const candidates = collectCandidates(episode.plates)
  if (candidates.length === 0) {
    return {
      grade: 'insufficient',
      score: 0,
      usableCutCount: 0,
      rescueCutCount: 0,
      unitCount: 0,
      estimatedDurationSec: 0,
      shortfall: 'no_media',
    }
  }

  const selections = selectCutsTwoLayerGate(candidates)
  const usable = countUsableCuts(selections)
  const rescue = countRescueCuts(selections)
  const unitCount = selections.length
  const estimatedDurationSec = estimateVlogDurationSec(usable)

  const ranks = selections.flatMap((s) => s.cuts.map((c) => c.setLog.rankScore))
  const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0

  // 量（カット数）・質（平均rank）・多様性（ユニット数）の合成。重みは較正対象
  const volume = clamp01(usable / 6)
  const diversity = clamp01(unitCount / 4)
  const score = clamp01(volume * 0.4 + avgRank * 0.4 + diversity * 0.2)

  if (usable < MIN_CUTS_TO_OFFER) {
    return {
      grade: 'insufficient',
      score,
      usableCutCount: usable,
      rescueCutCount: rescue,
      unitCount,
      estimatedDurationSec,
      shortfall: 'need_more_media',
    }
  }

  // 全カットが救済 or 平均rankが低い → 「あと1枚」ナッジ止まりにする
  const allRescue = usable > 0 && rescue === usable
  if (usable < READY_CUT_COUNT || avgRank < READY_AVG_RANK || allRescue) {
    return {
      grade: 'almost',
      score,
      usableCutCount: usable,
      rescueCutCount: rescue,
      unitCount,
      estimatedDurationSec,
      shortfall: avgRank < READY_AVG_RANK || allRescue ? 'low_quality' : 'need_more_media',
    }
  }

  return {
    grade: 'ready',
    score,
    usableCutCount: usable,
    rescueCutCount: rescue,
    unitCount,
    estimatedDurationSec,
    shortfall: null,
  }
}
