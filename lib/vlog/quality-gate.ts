import type { VisitPlate } from '@/lib/visits-memories'
import {
  ABSOLUTE_QUALITY_THRESHOLD,
  RESCUE_CUT_BEATS,
} from '@/lib/vlog/constants'

export type VlogMediaCandidate = {
  id: string
  spotId: string
  spotName: string
  mediaType: 'image' | 'video'
  /** 0–1 品質スコア（クラウド解析 or ヒューリスティック） */
  qualityScore: number
  rating: number | null
  hasDiary: boolean
  storagePath: string
}

export type SelectedVlogCut = {
  mediaId: string
  spotId: string
  spotName: string
  mediaType: 'image' | 'video'
  qualityScore: number
  rating: number | null
  hasDiary: boolean
  storagePath: string
  /** 層1救済カット（絶対ゲート未達でも採用） */
  isRescue: boolean
  durationBeats: number
  /** 救済: 写真優先 Ken Burns / 強クロップ・スタビ */
  kenBurns: boolean
  stabilizeStrength: number
  cropStrength: number
}

export type SpotCutSelection = {
  spotId: string
  spotName: string
  rating: number | null
  hasDiary: boolean
  cuts: SelectedVlogCut[]
}

function hashUnit(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

/** 端末側プレースホルダー — 本番はクラウド品質解析に差し替え */
export function scoreMediaHeuristic(
  memory: VisitPlate['memories'][number],
  plate: VisitPlate
): VlogMediaCandidate {
  const jitter = hashUnit(memory.id)
  const base = memory.media_type === 'image' ? 0.62 : 0.52
  const ratingBoost = plate.rating ? (plate.rating - 3) * 0.04 : 0
  const qualityScore = Math.max(0, Math.min(1, base + jitter * 0.28 + ratingBoost))

  return {
    id: memory.id,
    spotId: plate.spot_id,
    spotName: plate.spot.name,
    mediaType: memory.media_type,
    qualityScore,
    rating: plate.rating,
    hasDiary: Boolean(plate.comment?.trim()),
    storagePath: memory.media_url,
  }
}

export function collectCandidates(plates: VisitPlate[]): VlogMediaCandidate[] {
  return plates.flatMap((plate) =>
    plate.memories.map((m) => scoreMediaHeuristic(m, plate))
  )
}

function rescueCutParams(candidate: VlogMediaCandidate): Pick<
  SelectedVlogCut,
  'durationBeats' | 'kenBurns' | 'stabilizeStrength' | 'cropStrength'
> {
  const preferPhoto = candidate.mediaType === 'image'
  return {
    durationBeats: RESCUE_CUT_BEATS,
    kenBurns: preferPhoto || candidate.mediaType === 'image',
    stabilizeStrength: 0.85,
    cropStrength: 0.8,
  }
}

function standardCutParams(candidate: VlogMediaCandidate): Pick<
  SelectedVlogCut,
  'durationBeats' | 'kenBurns' | 'stabilizeStrength' | 'cropStrength'
> {
  return {
    durationBeats: 2.5,
    kenBurns: candidate.mediaType === 'image',
    stabilizeStrength: candidate.mediaType === 'video' ? 0.45 : 0.2,
    cropStrength: 0.55,
  }
}

/**
 * v9.5 2層ゲート
 * - 層1: 各スポット best-of 1本を必ず採用（救済可）
 * - 層2: 2本目以降は ABSOLUTE_QUALITY_THRESHOLD のみ
 */
export function selectCutsTwoLayerGate(
  candidates: VlogMediaCandidate[],
  threshold = ABSOLUTE_QUALITY_THRESHOLD
): SpotCutSelection[] {
  const bySpot = new Map<string, VlogMediaCandidate[]>()
  for (const c of candidates) {
    const list = bySpot.get(c.spotId) ?? []
    list.push(c)
    bySpot.set(c.spotId, list)
  }

  const selections: SpotCutSelection[] = []

  for (const [spotId, list] of bySpot) {
    const sorted = [...list].sort((a, b) => b.qualityScore - a.qualityScore)
    if (sorted.length === 0) continue

    const best = sorted[0]
    const isRescue = best.qualityScore < threshold
    const rescueParams = isRescue ? rescueCutParams(best) : standardCutParams(best)

    const cuts: SelectedVlogCut[] = [
      {
        mediaId: best.id,
        spotId: best.spotId,
        spotName: best.spotName,
        mediaType: best.mediaType,
        qualityScore: best.qualityScore,
        rating: best.rating,
        hasDiary: best.hasDiary,
        storagePath: best.storagePath,
        isRescue,
        ...rescueParams,
      },
    ]

    for (const extra of sorted.slice(1)) {
      if (extra.qualityScore < threshold) continue
      cuts.push({
        mediaId: extra.id,
        spotId: extra.spotId,
        spotName: extra.spotName,
        mediaType: extra.mediaType,
        qualityScore: extra.qualityScore,
        rating: extra.rating,
        hasDiary: extra.hasDiary,
        storagePath: extra.storagePath,
        isRescue: false,
        ...standardCutParams(extra),
      })
    }

    selections.push({
      spotId,
      spotName: best.spotName,
      rating: best.rating,
      hasDiary: best.hasDiary,
      cuts,
    })
  }

  return selections.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
}

export function countRescueCuts(selections: SpotCutSelection[]): number {
  return selections.reduce((n, s) => n + s.cuts.filter((c) => c.isRescue).length, 0)
}

export function countUsableCuts(selections: SpotCutSelection[]): number {
  return selections.reduce((n, s) => n + s.cuts.length, 0)
}
