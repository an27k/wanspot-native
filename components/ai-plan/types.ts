export type AiPlanMood = 'active' | 'relaxed'
export type AiPlanTravelMode = 'walking' | 'driving'

export type AiPlanStop = {
  spot_id: string
  name: string | null
  category: string | null
  dwell_minutes: number
  note: string | null
}

export type AiPlanLeg = {
  index: number
  origin_spot_id: string
  destination_spot_id: string
  duration_seconds: number
  distance_meters: number
}

export type AiPlanCore = {
  title: string
  summary: string
  stops: AiPlanStop[]
}

export type AiPlanGenerated = AiPlanCore & {
  legs?: AiPlanLeg[]
  mood?: AiPlanMood
  prefecture?: string
  municipality?: string
  travel_mode?: AiPlanTravelMode
}

export type AiPlanHistoryRow = {
  id: string
  created_at: string
  input_params: any
  generated_plan: AiPlanGenerated
}

export type AiPlanSseEvent =
  | { type: 'phase'; phase: string }
  | { type: 'candidates'; count: number }
  | { type: 'plan'; plan: AiPlanCore }
  | { type: 'leg'; leg: any }
  | { type: 'saved'; id: string }
  | { type: 'error'; code: string; message?: string }
  | { type: 'done' }
