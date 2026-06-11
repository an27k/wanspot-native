import {
  BEAT_SEC,
  BPM,
  CUT_BEATS_MAX,
  CUT_BEATS_MIN,
  DIARY_CAPTION_MAX_RATIO,
  INTRO_BEATS,
  OUTRO_BEATS,
  RESCUE_CUT_BEATS,
} from '@/lib/vlog/constants'
import { durationSecToBeats, estimateVlogDurationSec } from '@/lib/vlog/duration'
import { pickMusicTrack, type VlogMusicTrack } from '@/lib/vlog/music-tracks'
import type { SelectedVlogCut, SpotCutSelection } from '@/lib/vlog/quality-gate'

export type KenBurnsSpec = {
  zoom: 'in' | 'out'
  panX: number
  panY: number
}

export type EDLCut = {
  spotId: string
  spotName: string
  mediaId: string
  mediaType: 'image' | 'video'
  storagePath: string
  startBeat: number
  durationBeats: number
  isRescue: boolean
  transitionIn: 'none' | 'white_flash_2f'
  kenBurns: KenBurnsSpec | null
  spotChip: { name: string; rating: number | null } | null
  diaryCaption: string | null
  stabilizeStrength: number
  cropStrength: number
  smartCrop: 'dog_center_9_16'
  colorGrade: 'warm_lut_lifted_blacks'
}

export type EDLDocument = {
  version: 'v9.5'
  bpm: number
  beatSec: number
  track: VlogMusicTrack
  totalBeats: number
  totalSec: number
  intro: {
    durationBeats: number
    dogName: string
    monthLabel: string
    subtitle: string
  }
  outro: {
    durationBeats: number
    message: string
  }
  peakSpotId: string
  peakStartBeat: number
  peakLengthBeats: number
  cuts: EDLCut[]
}

function kenBurnsForCut(index: number): KenBurnsSpec {
  return {
    zoom: index % 2 === 0 ? 'in' : 'out',
    panX: index % 3 === 0 ? -0.06 : index % 3 === 1 ? 0.05 : 0,
    panY: index % 2 === 0 ? -0.04 : 0.04,
  }
}

function starWeight(rating: number | null): number {
  return Math.max(1, rating ?? 3)
}

function allocateBeats(totalBeats: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (totalBeats * w) / sum)
  const floors = raw.map((v) => Math.floor(v))
  let leftover = totalBeats - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  const out = [...floors]
  for (const { i } of order) {
    if (leftover <= 0) break
    out[i] += 1
    leftover -= 1
  }
  return out.map((b) => Math.max(CUT_BEATS_MIN, b))
}

function splitSpotBeatsIntoCuts(spotBeats: number, pool: SelectedVlogCut[]): SelectedVlogCut[] {
  const chosen: SelectedVlogCut[] = []
  let remaining = spotBeats
  let idx = 0

  while (remaining >= CUT_BEATS_MIN && idx < pool.length) {
    const cut = pool[idx]
    idx += 1
    const beats =
      cut.isRescue && cut.durationBeats < CUT_BEATS_MIN
        ? RESCUE_CUT_BEATS
        : Math.min(CUT_BEATS_MAX, Math.max(CUT_BEATS_MIN, Math.min(remaining, cut.durationBeats)))
    chosen.push({ ...cut, durationBeats: beats })
    remaining -= beats
  }

  if (chosen.length === 0 && pool.length > 0) {
    const rescue = pool[0]
    chosen.push({
      ...rescue,
      durationBeats: Math.min(rescue.durationBeats, Math.max(RESCUE_CUT_BEATS, spotBeats)),
    })
  }

  return chosen
}

function pickDiarySpots(
  selections: SpotCutSelection[],
  diaryBySpot: Map<string, string>,
  maxCaptions: number
): Map<string, string> {
  const withDiary = selections.filter((s) => s.hasDiary && diaryBySpot.has(s.spotId))
  const picked = new Map<string, string>()
  for (const s of withDiary.slice(0, maxCaptions)) {
    picked.set(s.spotId, diaryBySpot.get(s.spotId)!)
  }
  return picked
}

export function buildEDL(params: {
  selections: SpotCutSelection[]
  dogName: string
  monthLabel: string
  diaryBySpot: Map<string, string>
}): EDLDocument {
  const { selections, dogName, monthLabel, diaryBySpot } = params
  const usableCount = selections.reduce((n, s) => n + s.cuts.length, 0)
  const totalSec = estimateVlogDurationSec(usableCount)
  const bodyBeats = durationSecToBeats(totalSec, BEAT_SEC) - INTRO_BEATS - OUTRO_BEATS
  const ratings = selections.map((s) => s.rating).filter((r): r is number => r != null)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 3
  const track = pickMusicTrack(avgRating)

  const peakSpot = selections[0]
  const weights = selections.map((s) => starWeight(s.rating))
  const spotBeatBudgets = allocateBeats(bodyBeats, weights)

  const flattened: (SelectedVlogCut & { spotIndex: number })[] = []
  selections.forEach((spot, spotIndex) => {
    const budget = spotBeatBudgets[spotIndex] ?? CUT_BEATS_MIN
    const cuts = splitSpotBeatsIntoCuts(budget, spot.cuts)
    cuts.forEach((c) => flattened.push({ ...c, spotIndex }))
  })

  const maxDiary = Math.floor(flattened.length * DIARY_CAPTION_MAX_RATIO)
  const diarySpots = pickDiarySpots(selections, diaryBySpot, maxDiary)

  let beatCursor = INTRO_BEATS
  let prevSpotId: string | null = null
  const edlCuts: EDLCut[] = []
  const spotCutCounts = new Map<string, number>()
  const diaryAssigned = new Set<string>()
  let diaryUsed = 0

  flattened.forEach((cut, globalIndex) => {
    const prevCount = spotCutCounts.get(cut.spotId) ?? 0
    spotCutCounts.set(cut.spotId, prevCount + 1)
    const isSpotStart = cut.spotId !== prevSpotId

    const spotTotal = flattened.filter((f) => f.spotId === cut.spotId).length
    const isMiddleCut = prevCount === Math.floor(spotTotal / 2)
    const canDiary =
      diaryUsed < maxDiary &&
      !diaryAssigned.has(cut.spotId) &&
      diarySpots.has(cut.spotId) &&
      isMiddleCut

    if (canDiary) {
      diaryAssigned.add(cut.spotId)
      diaryUsed += 1
    }

    edlCuts.push({
      spotId: cut.spotId,
      spotName: cut.spotName,
      mediaId: cut.mediaId,
      mediaType: cut.mediaType,
      storagePath: cut.storagePath,
      startBeat: beatCursor,
      durationBeats: cut.durationBeats,
      isRescue: cut.isRescue,
      transitionIn: isSpotStart && prevSpotId != null ? 'white_flash_2f' : 'none',
      kenBurns: cut.kenBurns ? kenBurnsForCut(globalIndex) : null,
      spotChip: isSpotStart ? { name: cut.spotName, rating: cut.rating } : null,
      diaryCaption: canDiary ? diarySpots.get(cut.spotId)! : null,
      stabilizeStrength: cut.stabilizeStrength,
      cropStrength: cut.cropStrength,
      smartCrop: 'dog_center_9_16',
      colorGrade: 'warm_lut_lifted_blacks',
    })

    beatCursor += cut.durationBeats
    prevSpotId = cut.spotId
  })

  const peakSpotStartBeat = edlCuts.find((c) => c.spotId === peakSpot.spotId)?.startBeat ?? INTRO_BEATS
  const totalBeats = beatCursor + OUTRO_BEATS

  return {
    version: 'v9.5',
    bpm: BPM,
    beatSec: BEAT_SEC,
    track,
    totalBeats,
    totalSec: totalBeats * BEAT_SEC,
    intro: {
      durationBeats: INTRO_BEATS,
      dogName,
      monthLabel,
      subtitle: '5スポットのおでかけ',
    },
    outro: {
      durationBeats: OUTRO_BEATS,
      message: 'また来月、あそぼうね',
    },
    peakSpotId: peakSpot.spotId,
    peakStartBeat: peakSpotStartBeat,
    peakLengthBeats: track.peakLengthBeats,
    cuts: edlCuts,
  }
}

export function formatMonthLabel(date = new Date()): string {
  return `${date.getMonth() + 1}月`
}
