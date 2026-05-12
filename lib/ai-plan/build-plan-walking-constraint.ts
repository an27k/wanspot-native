import { classifySpot, type SpotStayType } from '@/lib/ai-plan/spotClassification'
import { estimateWalkingMinutes } from '@/lib/ai-plan/walkingTime'

/** サーバの `CandidateSpotRow` と同じ想定（プラン用に最小フィールド） */
export type PlanSpot = {
  id: string
  lat: number
  lng: number
  category: string | null
}

export const MIN_PLAN_SPOTS = 2
export const STAY_FOLLOWING_MAX_WALKING_MIN_DEFAULT = 15
export const STAY_FOLLOWING_MAX_WALKING_MIN_RELAXED = 20

/**
 * 候補配列（スコア高い順）から徒歩制約付きの順路を作る（生成は Next API。ここはロジック共有用）。
 */
export function buildPlanWithWalkingConstraint(
  candidateSpots: PlanSpot[],
  startLocation: { lat: number; lng: number },
  maxSpots: number = 4,
  maxWalkingMinutesForStay: number = STAY_FOLLOWING_MAX_WALKING_MIN_DEFAULT
): PlanSpot[] {
  const plan: PlanSpot[] = []
  let currentLocation = { ...startLocation }
  let previousSpotType: SpotStayType = 'pass_through'

  const remainingCandidates = [...candidateSpots]

  while (plan.length < maxSpots && remainingCandidates.length > 0) {
    const candidatesWithTime = remainingCandidates.map((spot) => ({
      spot,
      walkingMinutes: estimateWalkingMinutes(
        currentLocation.lat,
        currentLocation.lng,
        spot.lat,
        spot.lng
      ),
    }))

    const filtered =
      previousSpotType === 'stay'
        ? candidatesWithTime.filter((c) => c.walkingMinutes <= maxWalkingMinutesForStay)
        : candidatesWithTime

    if (filtered.length === 0) {
      break
    }

    const next = filtered[0]
    plan.push(next.spot)
    currentLocation = { lat: next.spot.lat, lng: next.spot.lng }
    previousSpotType = classifySpot(next.spot.category)

    const index = remainingCandidates.findIndex((s) => s.id === next.spot.id)
    if (index >= 0) remainingCandidates.splice(index, 1)
  }

  return plan
}
