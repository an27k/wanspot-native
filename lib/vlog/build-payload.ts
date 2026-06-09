import type { VisitPlate } from '@/lib/visits-memories'
import { buildEDL, formatMonthLabel, type EDLDocument } from '@/lib/vlog/edl'
import {
  collectCandidates,
  countRescueCuts,
  countUsableCuts,
  selectCutsTwoLayerGate,
} from '@/lib/vlog/quality-gate'

export type VlogRenderPayload = {
  edl: EDLDocument
  meta: {
    usableCutCount: number
    rescueCutCount: number
    spotCount: number
  }
}

export function buildVlogRenderPayload(plates: VisitPlate[], dogName: string): VlogRenderPayload {
  const candidates = collectCandidates(plates)
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
