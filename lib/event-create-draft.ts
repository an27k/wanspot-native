import AsyncStorage from '@react-native-async-storage/async-storage'

export const EVENT_CREATE_DRAFT_KEY = 'wanspot_event_create_draft_v1'

export type EventCreateDraftV1 = {
  v: 1
  title: string
  description: string
  location_name: string
  area: string
  event_at: string
  capacity: number | null
  tags: string[]
  feeKind: 'free' | 'paid'
  paidAmountYen: string
  thumbnail_url: string | null
}

export async function saveEventCreateDraft(draft: EventCreateDraftV1): Promise<void> {
  await AsyncStorage.setItem(EVENT_CREATE_DRAFT_KEY, JSON.stringify(draft))
}

export async function loadEventCreateDraft(): Promise<EventCreateDraftV1 | null> {
  const raw = await AsyncStorage.getItem(EVENT_CREATE_DRAFT_KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as EventCreateDraftV1
    if (p?.v !== 1) return null
    return p
  } catch {
    return null
  }
}

export async function clearEventCreateDraft(): Promise<void> {
  await AsyncStorage.removeItem(EVENT_CREATE_DRAFT_KEY)
}
