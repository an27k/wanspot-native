import type { VisitPlate } from '@/lib/visits-memories'
import { buildEDL, formatMonthLabel, type EDLDocument } from '@/lib/vlog/edl'
import { fetchCloudQualityScores, type CloudQualityResult } from '@/lib/vlog/quality-client'
import {
  collectCandidates,
  countRescueCuts,
  countUsableCuts,
  selectCutsTwoLayerGate,
  type SpotCutSelection,
  type VlogMediaCandidate,
} from '@/lib/vlog/quality-gate'
import { computeRankScore } from '@/lib/vlog/set-log'

export type VlogRenderPayload = {
  edl: EDLDocument
  meta: {
    usableCutCount: number
    rescueCutCount: number
    spotCount: number
    /** 生成後の品質ログ用: 採用カットの平均品質スコア(0-1) */
    avgQualityScore: number
  }
}

function averageQualityScore(selections: SpotCutSelection[]): number {
  const scores = selections.flatMap((s) => s.cuts.map((c) => c.qualityScore))
  if (scores.length === 0) return 0
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000
}

/** サーバー実測のSet logパッチ＋qualityScoreをローカル候補にマージし、rankScoreを再計算 */
function applyCloudScores(
  candidates: VlogMediaCandidate[],
  scores: Map<string, CloudQualityResult>
): VlogMediaCandidate[] {
  if (scores.size === 0) return candidates
  return candidates.map((c) => {
    const cloud = scores.get(c.id)
    if (!cloud) return c

    const patch = cloud.setLog
    const setLog = patch
      ? {
          ...c.setLog,
          blurScore: patch.blurScore ?? c.setLog.blurScore,
          brightnessScore: patch.brightnessScore ?? c.setLog.brightnessScore,
          cropFitScore: patch.cropFitScore ?? c.setLog.cropFitScore,
          emotionScore: patch.emotionScore ?? c.setLog.emotionScore,
          subjectDetected: patch.subjectDetected ?? c.setLog.subjectDetected,
          analysisSource: patch.analysisSource ?? c.setLog.analysisSource,
        }
      : c.setLog

    const rankScore = computeRankScore({
      qualityScore: cloud.qualityScore,
      motionScore: setLog.motionScore,
      emotionScore: setLog.emotionScore,
      cropFitScore: setLog.cropFitScore,
      subjectDetected: setLog.subjectDetected,
    })

    return { ...c, qualityScore: cloud.qualityScore, setLog: { ...setLog, rankScore } }
  })
}

export function buildVlogRenderPayload(plates: VisitPlate[], dogName: string): VlogRenderPayload {
  const candidates = collectCandidates(plates)
  return buildPayloadFromCandidates(plates, dogName, candidates)
}

/** クラウド品質スコア適用後に EDL を組み立て */
export async function buildVlogRenderPayloadAsync(
  plates: VisitPlate[],
  dogName: string
): Promise<VlogRenderPayload> {
  const base = collectCandidates(plates)
  const items = base.map((c) => ({
    mediaId: c.id,
    storagePath: c.storagePath,
    mediaType: c.mediaType,
    rating: c.rating,
  }))
  const scores = await fetchCloudQualityScores(items)
  const candidates = applyCloudScores(base, scores)
  return buildPayloadFromCandidates(plates, dogName, candidates)
}

function buildPayloadFromCandidates(
  plates: VisitPlate[],
  dogName: string,
  candidates: VlogMediaCandidate[]
): VlogRenderPayload {
  const selections = selectCutsTwoLayerGate(candidates)

  const diaryBySpot = new Map<string, string>()
  for (const plate of plates) {
    const text = plate.comment?.trim()
    if (text) diaryBySpot.set(plate.spot_id, text)
  }

  const edl = buildEDL({
    selections,
    dogName: dogName.trim() || '愛犬',
    monthLabel: formatMonthLabel(),
    diaryBySpot,
  })

  return {
    edl,
    meta: {
      usableCutCount: countUsableCuts(selections),
      rescueCutCount: countRescueCuts(selections),
      spotCount: selections.length,
      avgQualityScore: averageQualityScore(selections),
    },
  }
}
