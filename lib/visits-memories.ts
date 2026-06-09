import { supabase } from '@/lib/supabase'
import { compressImageToJpeg } from '@/lib/images/compress-image'

export const MEMORIES_BUCKET = 'memories'
const SIGNED_URL_TTL_SEC = 3600

export type VisitRow = {
  id: string
  user_id: string
  spot_id: string
  visited_at: string
  comment: string | null
  rating: number | null
  soft_deleted: boolean
  created_at: string
}

export type MemoryRow = {
  id: string
  user_id: string
  visit_id: string
  spot_id: string
  media_url: string
  media_type: 'image' | 'video'
  thumbnail_url: string | null
  soft_deleted: boolean
  created_at: string
}

export type SpotMini = {
  id: string
  name: string
  category: string
}

export type VisitPlate = VisitRow & {
  spot: SpotMini
  visitOrdinal: number
  memories: (MemoryRow & { signedUrl: string | null; thumbSignedUrl: string | null })[]
}

const VISIT_COLUMNS = 'id, user_id, spot_id, visited_at, comment, rating, soft_deleted, created_at'
const MEMORY_COLUMNS =
  'id, user_id, visit_id, spot_id, media_url, media_type, thumbnail_url, soft_deleted, created_at'

export type VisitRecordError = {
  table: string
  message: string
  code?: string
}

function toRecordError(table: string, error: { message?: string; code?: string } | null): VisitRecordError {
  return {
    table,
    message: error?.message ?? 'unknown error',
    code: error?.code,
  }
}

export function formatVisitRecordError(err: VisitRecordError): string {
  const code = err.code ? `[${err.code}] ` : ''
  return `${err.table}: ${code}${err.message}`
}

function localDayBounds(d: Date = new Date()): { start: string; end: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function signMemoryPath(path: string): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(MEMORIES_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SEC)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

async function attachSignedUrls(memories: MemoryRow[]): Promise<VisitPlate['memories']> {
  return Promise.all(
    memories.map(async (m) => {
      const signedUrl = await signMemoryPath(m.media_url)
      const thumbSignedUrl = m.thumbnail_url ? await signMemoryPath(m.thumbnail_url) : signedUrl
      return { ...m, signedUrl, thumbSignedUrl }
    })
  )
}

function computeOrdinals(visits: VisitRow[]): Map<string, number> {
  const bySpot = new Map<string, VisitRow[]>()
  for (const v of visits) {
    const list = bySpot.get(v.spot_id) ?? []
    list.push(v)
    bySpot.set(v.spot_id, list)
  }
  const ordinals = new Map<string, number>()
  for (const list of bySpot.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime()
    )
    sorted.forEach((v, i) => ordinals.set(v.id, i + 1))
  }
  return ordinals
}

export async function fetchVisitPlates(userId: string): Promise<VisitPlate[]> {
  const { data: visits, error: vErr } = await supabase
    .from('visits')
    .select(VISIT_COLUMNS)
    .eq('user_id', userId)
    .eq('soft_deleted', false)
    .order('visited_at', { ascending: false })

  if (vErr || !visits?.length) return []

  const visitRows = visits as VisitRow[]
  const spotIds = [...new Set(visitRows.map((v) => v.spot_id))]
  const { data: spots } = await supabase.from('spots').select('id, name, category').in('id', spotIds)
  const spotById = new Map((spots ?? []).map((s) => [s.id as string, s as SpotMini]))

  const visitIds = visitRows.map((v) => v.id)
  const { data: memRows } = await supabase
    .from('memories')
    .select(MEMORY_COLUMNS)
    .in('visit_id', visitIds)
    .eq('soft_deleted', false)
    .order('created_at', { ascending: true })

  const memByVisit = new Map<string, MemoryRow[]>()
  for (const m of (memRows ?? []) as MemoryRow[]) {
    const list = memByVisit.get(m.visit_id) ?? []
    list.push(m)
    memByVisit.set(m.visit_id, list)
  }

  const ordinals = computeOrdinals(visitRows)

  const plates: VisitPlate[] = []
  for (const v of visitRows) {
    const spot = spotById.get(v.spot_id)
    if (!spot) continue
    const memories = await attachSignedUrls(memByVisit.get(v.id) ?? [])
    plates.push({
      ...v,
      spot,
      visitOrdinal: ordinals.get(v.id) ?? 1,
      memories,
    })
  }
  return plates
}

export async function hasVisitForSpot(userId: string, spotId: string): Promise<boolean> {
  const { data } = await supabase
    .from('visits')
    .select('id')
    .eq('user_id', userId)
    .eq('spot_id', spotId)
    .eq('soft_deleted', false)
    .limit(1)
    .maybeSingle()
  return !!data
}

/** 同日・同スポットの visit がなければ insert。将来 check_ins 一本化前提で check_ins も最小 upsert。 */
export async function recordSpotVisit(
  userId: string,
  spotId: string
): Promise<{ ok: boolean; visitId?: string; created?: boolean; error?: VisitRecordError }> {
  const { start, end } = localDayBounds()
  const { data: existing, error: existingErr } = await supabase
    .from('visits')
    .select('id')
    .eq('user_id', userId)
    .eq('spot_id', spotId)
    .eq('soft_deleted', false)
    .gte('visited_at', start)
    .lte('visited_at', end)
    .maybeSingle()

  if (existingErr) {
    console.warn('[recordSpotVisit] visits.select', existingErr.code, existingErr.message)
    return { ok: false, error: toRecordError('visits', existingErr) }
  }

  if (existing?.id) {
    const { data: ci, error: ciSelErr } = await supabase
      .from('check_ins')
      .select('id')
      .eq('user_id', userId)
      .eq('spot_id', spotId)
      .maybeSingle()
    if (ciSelErr) {
      console.warn('[recordSpotVisit] check_ins.select', ciSelErr.code, ciSelErr.message)
    }
    if (!ci) {
      const { error: ciInsErr } = await supabase.from('check_ins').insert({ user_id: userId, spot_id: spotId })
      if (ciInsErr) {
        console.warn('[recordSpotVisit] check_ins.insert', ciInsErr.code, ciInsErr.message)
        return { ok: false, error: toRecordError('check_ins', ciInsErr) }
      }
    }
    return { ok: true, visitId: existing.id as string, created: false }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('visits')
    .insert({ user_id: userId, spot_id: spotId, visited_at: new Date().toISOString() })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.warn('[recordSpotVisit] visits.insert', insertErr?.code, insertErr?.message)
    return { ok: false, error: toRecordError('visits', insertErr) }
  }

  const visitId = inserted.id as string

  const { data: ci, error: ciSelErr } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('spot_id', spotId)
    .maybeSingle()
  if (ciSelErr) {
    console.warn('[recordSpotVisit] check_ins.select', ciSelErr.code, ciSelErr.message)
  }
  if (!ci) {
    const { error: ciInsErr } = await supabase.from('check_ins').insert({ user_id: userId, spot_id: spotId })
    if (ciInsErr) {
      console.warn('[recordSpotVisit] check_ins.insert', ciInsErr.code, ciInsErr.message)
      return { ok: false, error: toRecordError('check_ins', ciInsErr) }
    }
  }

  return { ok: true, visitId, created: true }
}

export async function createVisitForSpot(userId: string, spotId: string, visitedAt?: string): Promise<VisitRow | null> {
  const { data, error } = await supabase
    .from('visits')
    .insert({
      user_id: userId,
      spot_id: spotId,
      visited_at: visitedAt ?? new Date().toISOString(),
    })
    .select(VISIT_COLUMNS)
    .single()
  if (error || !data) return null
  return data as VisitRow
}

export async function updateVisit(
  visitId: string,
  patch: { comment?: string | null; rating?: number | null; visited_at?: string; spot_id?: string }
): Promise<boolean> {
  const { error } = await supabase.from('visits').update(patch).eq('id', visitId)
  return !error
}

export async function softDeleteVisit(visitId: string): Promise<boolean> {
  const { error: vErr } = await supabase.from('visits').update({ soft_deleted: true }).eq('id', visitId)
  if (vErr) return false
  await supabase.from('memories').update({ soft_deleted: true }).eq('visit_id', visitId)
  return true
}

export async function softDeleteMemory(memoryId: string): Promise<boolean> {
  const { error } = await supabase.from('memories').update({ soft_deleted: true }).eq('id', memoryId)
  return !error
}

export async function uploadMemoryFile(
  userId: string,
  uri: string,
  mimeType: string,
  onProgress?: (ratio: number) => void
): Promise<{ path: string; mediaType: 'image' | 'video' } | null> {
  onProgress?.(0.1)
  let uploadUri = uri
  let uploadMime = mimeType

  if (!mimeType.startsWith('video/')) {
    const compressed = await compressImageToJpeg(uri, 1200)
    if (!compressed) return null
    uploadUri = compressed.uri
    uploadMime = 'image/jpeg'
  }

  const ext = uploadMime.startsWith('video/') ? (uploadMime.includes('quicktime') ? 'mov' : 'mp4') : 'jpg'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const res = await fetch(uploadUri)
  const buf = await res.arrayBuffer()
  onProgress?.(0.4)
  const { error } = await supabase.storage.from(MEMORIES_BUCKET).upload(path, buf, {
    contentType: uploadMime,
    upsert: false,
  })
  onProgress?.(1)
  if (error) return null
  return { path, mediaType: uploadMime.startsWith('video/') ? 'video' : 'image' }
}

export async function insertMemory(params: {
  userId: string
  visitId: string
  spotId: string
  storagePath: string
  mediaType: 'image' | 'video'
}): Promise<{ row: MemoryRow | null; error?: VisitRecordError }> {
  const { data, error } = await supabase
    .from('memories')
    .insert({
      user_id: params.userId,
      visit_id: params.visitId,
      spot_id: params.spotId,
      media_url: params.storagePath,
      media_type: params.mediaType,
    })
    .select(MEMORY_COLUMNS)
    .single()
  if (error || !data) {
    console.warn('[insertMemory] memories.insert', error?.code, error?.message)
    return { row: null, error: toRecordError('memories', error) }
  }
  return { row: data as MemoryRow }
}

export function formatVisitDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
