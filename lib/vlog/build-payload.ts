import type { VisitPlate } from '@/lib/visits-memories'
import { buildEDL, formatMonthLabel, type EDLDocument } from '@/lib/vlog/edl'
import { fetchCloudQualityScores } from '@/lib/vlog/quality-client'
import {
  collectCandidates,
  countRescueCuts,
  countUsableCuts,
  selectCutsTwoLayerGate,
  type VlogMediaCandidate,
} from '@/lib/vlog/quality-gate'

export type VlogRenderPayload = {
  edl: EDLDocument
  meta: {
    usableCutCount: number
    rescueCutCount: number
    spotCount: number
  }
}

function applyCloudScores(
  candidates: VlogMediaCandidate[],
  scores: Map<string, number>
): VlogMediaCandidate[] {
  if (scores.size === 0) return candidates
  return candidates.map((c) => {
    const cloud = scores.get(c.id)
    return cloud != null ? { ...c, qualityScore: cloud } : c
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
    },
  }
}
