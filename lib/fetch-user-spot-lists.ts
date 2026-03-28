import type { SupabaseClient } from '@supabase/supabase-js'
import { wanspotFetch } from '@/lib/wanspot-api'

const BATCH_DETAILS_CHUNK = 40

type BatchDetailEntry = {
  photo_ref?: string | null
  rating?: number | null
  price_level?: number | null
  formatted_address?: string | null
  vicinity?: string | null
}

type BatchDetailsPayload = {
  details?: Record<string, BatchDetailEntry>
}

function normalizeSpotAddress(row: Record<string, unknown>): string | null {
  const keys = ['address', 'formatted_address', 'vicinity'] as const
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
}

function addressFromBatchDetail(detail: BatchDetailEntry | undefined): string | null {
  if (!detail || typeof detail !== 'object') return null
  const fa = detail.formatted_address
  const v = detail.vicinity
  if (typeof fa === 'string' && fa.trim().length > 0) return fa.trim()
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return null
}

async function fetchBatchDetailsMerged(placeIds: string[]): Promise<Record<string, BatchDetailEntry>> {
  const unique = [...new Set(placeIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  const merged: Record<string, BatchDetailEntry> = {}

  for (let i = 0; i < unique.length; i += BATCH_DETAILS_CHUNK) {
    const chunk = unique.slice(i, i + BATCH_DETAILS_CHUNK)
    try {
      const res = await wanspotFetch('/api/spots/batch-details', {
        method: 'POST',
        json: { place_ids: chunk },
      })
      if (!res.ok) continue
      const json = (await res.json()) as BatchDetailsPayload
      if (json.details) Object.assign(merged, json.details)
    } catch {
      /* ネットワーク失敗時はスキップ */
    }
  }

  return merged
}

async function overrideAddressesFromBatchDetails(spots: UserSpotRow[]): Promise<UserSpotRow[]> {
  if (spots.length === 0) return spots
  const details = await fetchBatchDetailsMerged(spots.map((s) => s.place_id))
  return spots.map((s) => {
    const line = addressFromBatchDetail(details[s.place_id])
    return line ? { ...s, address: line } : s
  })
}

export type UserSpotRow = {
  id: string
  place_id: string
  name: string
  category: string
  address: string | null
  lat: number | null
  lng: number | null
  likeCount: number
  savedAt: string | null
}

type FetchResult =
  | { ok: true; spots: UserSpotRow[] }
  | { ok: false; error: string; code?: string }

export async function fetchLikedSpotsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<FetchResult> {
  const { data: likes, error: likesError } = await supabase
    .from('spot_likes')
    .select('spot_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (likesError) {
    return { ok: false, error: likesError.message, code: likesError.code }
  }

  const orderedIds: string[] = []
  const seen = new Set<string>()
  const savedAtById = new Map<string, string | null>()
  for (const row of likes ?? []) {
    const sid = row.spot_id as string | undefined | null
    const at = typeof row.created_at === 'string' ? row.created_at : null
    if (typeof sid === 'string' && sid.length > 0 && !seen.has(sid)) {
      seen.add(sid)
      orderedIds.push(sid)
      savedAtById.set(sid, at)
    }
  }

  if (orderedIds.length === 0) {
    return { ok: true, spots: [] }
  }

  const { data: spotRows, error: spotsError } = await supabase.from('spots').select('*').in('id', orderedIds)

  if (spotsError) {
    return { ok: false, error: spotsError.message, code: spotsError.code }
  }

  const { data: likeRows } = await supabase.from('spot_likes').select('spot_id').in('spot_id', orderedIds)
  const likeCountBySpotId: Record<string, number> = {}
  for (const row of likeRows ?? []) {
    const sid = row.spot_id as string
    likeCountBySpotId[sid] = (likeCountBySpotId[sid] ?? 0) + 1
  }

  const byId = new Map(
    (spotRows ?? []).map((s) => {
      const raw = s as Record<string, unknown>
      const id = raw.id as string
      return [
        id,
        {
          id,
          place_id: raw.place_id as string,
          name: raw.name as string,
          category: raw.category as string,
          address: normalizeSpotAddress(raw),
          lat: (raw.lat as number | null) ?? null,
          lng: (raw.lng as number | null) ?? null,
          likeCount: likeCountBySpotId[id] ?? 0,
          savedAt: null as string | null,
        } satisfies Omit<UserSpotRow, 'savedAt'> & { savedAt: string | null },
      ]
    })
  )
  const spots: UserSpotRow[] = []
  for (const id of orderedIds) {
    const s = byId.get(id)
    if (s) spots.push({ ...s, savedAt: savedAtById.get(id) ?? null })
  }

  const withPlacesAddress = await overrideAddressesFromBatchDetails(spots)
  return { ok: true, spots: withPlacesAddress }
}

export async function fetchCheckedInSpotsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<FetchResult> {
  const { data: rows, error: ciError } = await supabase
    .from('check_ins')
    .select('spot_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (ciError) {
    return { ok: false, error: ciError.message, code: ciError.code }
  }

  const orderedIds: string[] = []
  const seen = new Set<string>()
  const savedAtById = new Map<string, string | null>()
  for (const row of rows ?? []) {
    const sid = row.spot_id as string | undefined | null
    const at = typeof row.created_at === 'string' ? row.created_at : null
    if (typeof sid === 'string' && sid.length > 0 && !seen.has(sid)) {
      seen.add(sid)
      orderedIds.push(sid)
      savedAtById.set(sid, at)
    }
  }

  if (orderedIds.length === 0) {
    return { ok: true, spots: [] }
  }

  const { data: spotRows, error: spotsError } = await supabase.from('spots').select('*').in('id', orderedIds)

  if (spotsError) {
    return { ok: false, error: spotsError.message, code: spotsError.code }
  }

  const { data: likeRows } = await supabase.from('spot_likes').select('spot_id').in('spot_id', orderedIds)
  const likeCountBySpotId: Record<string, number> = {}
  for (const row of likeRows ?? []) {
    const sid = row.spot_id as string
    likeCountBySpotId[sid] = (likeCountBySpotId[sid] ?? 0) + 1
  }

  const byId = new Map(
    (spotRows ?? []).map((s) => {
      const raw = s as Record<string, unknown>
      const id = raw.id as string
      return [
        id,
        {
          id,
          place_id: raw.place_id as string,
          name: raw.name as string,
          category: raw.category as string,
          address: normalizeSpotAddress(raw),
          lat: (raw.lat as number | null) ?? null,
          lng: (raw.lng as number | null) ?? null,
          likeCount: likeCountBySpotId[id] ?? 0,
          savedAt: null as string | null,
        } satisfies Omit<UserSpotRow, 'savedAt'> & { savedAt: string | null },
      ]
    })
  )
  const spots: UserSpotRow[] = []
  for (const id of orderedIds) {
    const s = byId.get(id)
    if (s) spots.push({ ...s, savedAt: savedAtById.get(id) ?? null })
  }

  const withPlacesAddress = await overrideAddressesFromBatchDetails(spots)
  return { ok: true, spots: withPlacesAddress }
}
