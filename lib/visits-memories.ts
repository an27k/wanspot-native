import { supabase } from '@/lib/supabase'
import {
  dailyLogSpotMini,
  isDailyLogVisit,
  type DailyLogContext,
  type DailyLogMood,
} from '@/lib/daily-log'
import { compressImageToJpeg } from '@/lib/images/compress-image'
import { logUserEvent } from '@/lib/user-events'

export const MEMORIES_BUCKET = 'memories'
const SIGNED_URL_TTL_SEC = 3600

export type VisitRow = {
  id: string
  user_id: string
  /** null = 日次ログ（きょうのログ）。spot に紐づかない記録 */
  spot_id: string | null
  visited_at: string
  comment: string | null
  rating: number | null
  /** 日次ログの記録コンテキスト。spot訪問は null */
  context: DailyLogContext | null
  /** 気分スタンプ（日次ログ用・任意） */
  mood: DailyLogMood | null
  soft_deleted: boolean
  created_at: string
}

export type MemoryRow = {
  id: string
  user_id: string
  visit_id: string
  /** null = 日次ログの memories */
  spot_id: string | null
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

const VISIT_COLUMNS =
  'id, user_id, spot_id, visited_at, comment, rating, context, mood, soft_deleted, created_at'
const MEMORY_COLUMNS =
  'id, user_id, visit_id, spot_id, media_url, media_type, thumbnail_url, soft_deleted, created_at'

export type VisitRecordSource = 'detail_button' | 'review' | 'checkin' | 'other'

export type VisitRecordError = {
  table: string
  message: string
  code?: string
  /** PGRST205 等 — テーブル未作成の可能性 */
  isSchemaError?: boolean
}

function toRecordError(table: string, error: { message?: string; code?: string } | null): VisitRecordError {
  const code = error?.code
  const message = error?.message ?? 'unknown error'
  return {
    table,
    message,
    code,
    isSchemaError: code === 'PGRST205' || /schema cache/i.test(message),
  }
}

export function formatVisitRecordError(err: VisitRecordError): string {
  const code = err.code ? `[${err.code}] ` : ''
  if (err.isSchemaError) {
    return `${err.table}: サーバー設定の更新が必要です。しばらくしてから再試行してください。`
  }
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

/** 「n回目」集計キー — 日次ログは同コンテキスト単位で数える */
function ordinalKey(v: VisitRow): string {
  return v.spot_id ?? `daily-log:${v.context ?? 'home'}`
}

function computeOrdinals(visits: VisitRow[]): Map<string, number> {
  const bySpot = new Map<string, VisitRow[]>()
  for (const v of visits) {
    const key = ordinalKey(v)
    const list = bySpot.get(key) ?? []
    list.push(v)
    bySpot.set(key, list)
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
  const spotIds = [...new Set(visitRows.map((v) => v.spot_id).filter((id): id is string => id != null))]
  const { data: spots } =
    spotIds.length > 0
      ? await supabase.from('spots').select('id, name, category').in('id', spotIds)
      : { data: [] }
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
    // 日次ログはコンテキストラベルの合成スポットで表示（アルバム/Vlog UIはスポット名の位置に出す）
    const spot = isDailyLogVisit(v) ? dailyLogSpotMini(v.context) : spotById.get(v.spot_id!)
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

/** 同日・同スポットの visit がなければ insert。check_ins は best-effort（失敗しても visits 成功なら OK）。 */
export async function recordSpotVisit(
  userId: string,
  spotId: string,
  source: VisitRecordSource = 'detail_button'
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
    void syncCheckInBestEffort(userId, spotId)
    return { ok: true, visitId: existing.id as string, created: false }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('visits')
    .insert({
      user_id: userId,
      spot_id: spotId,
      visited_at: new Date().toISOString(),
      source,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.warn('[recordSpotVisit] visits.insert', insertErr?.code, insertErr?.message)
    return { ok: false, error: toRecordError('visits', insertErr) }
  }

  const visitId = inserted.id as string
  void syncCheckInBestEffort(userId, spotId)
  logUserEvent({ eventType: 'visit', spotId, userId, props: { source, created: true } })

  return { ok: true, visitId, created: true }
}

/**
 * きょうのログ (P3) — 日次ログ visit の記録。
 * 「1日1コンテキスト1行」: 同日・同コンテキストの記録は同じ visits 行に memories を追記する
 * （recordSpotVisit の「同日・同スポット1回」と同じ流儀）。mood は最後に押したスタンプで上書き。
 */
export async function recordDailyLog(
  userId: string,
  context: DailyLogContext,
  mood: DailyLogMood | null
): Promise<{ ok: boolean; visitId?: string; created?: boolean; error?: VisitRecordError }> {
  const { start, end } = localDayBounds()
  const { data: existing, error: existingErr } = await supabase
    .from('visits')
    .select('id')
    .eq('user_id', userId)
    .is('spot_id', null)
    .eq('context', context)
    .eq('soft_deleted', false)
    .gte('visited_at', start)
    .lte('visited_at', end)
    .maybeSingle()

  if (existingErr) {
    console.warn('[recordDailyLog] visits.select', existingErr.code, existingErr.message)
    return { ok: false, error: toRecordError('visits', existingErr) }
  }

  if (existing?.id) {
    if (mood) {
      await supabase.from('visits').update({ mood }).eq('id', existing.id)
    }
    return { ok: true, visitId: existing.id as string, created: false }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('visits')
    .insert({
      user_id: userId,
      spot_id: null,
      context,
      mood,
      visited_at: new Date().toISOString(),
      source: 'other',
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.warn('[recordDailyLog] visits.insert', insertErr?.code, insertErr?.message)
    return { ok: false, error: toRecordError('visits', insertErr) }
  }

  const visitId = inserted.id as string
  logUserEvent({ eventType: 'visit', userId, props: { source: 'daily_log', context, created: true } })

  return { ok: true, visitId, created: true }
}

async function syncCheckInBestEffort(userId: string, spotId: string): Promise<void> {
  try {
    const { data: ci, error: ciSelErr } = await supabase
      .from('check_ins')
      .select('id')
      .eq('user_id', userId)
      .eq('spot_id', spotId)
      .maybeSingle()
    if (ciSelErr) {
      console.warn('[recordSpotVisit] check_ins.select', ciSelErr.code, ciSelErr.message)
      return
    }
    if (ci) return
    const { error: ciInsErr } = await supabase.from('check_ins').insert({ user_id: userId, spot_id: spotId })
    if (ciInsErr) {
      console.warn('[recordSpotVisit] check_ins.insert', ciInsErr.code, ciInsErr.message)
    }
  } catch (e) {
    console.warn('[recordSpotVisit] check_ins', e instanceof Error ? e.message : String(e))
  }
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

export type UploadMemoryResult =
  | { ok: true; path: string; mediaType: 'image' | 'video' }
  | { ok: false; message: string }

export async function uploadMemoryFile(
  userId: string,
  uri: string,
  mimeType: string,
  onProgress?: (ratio: number) => void
): Promise<UploadMemoryResult> {
  try {
    onProgress?.(0.1)
    let uploadUri = uri
    let uploadMime = mimeType

    if (!mimeType.startsWith('video/')) {
      const compressed = await compressImageToJpeg(uri, 1200)
      if (!compressed) return { ok: false, message: '画像の変換に失敗しました' }
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
    if (error) {
      console.warn('[uploadMemoryFile] storage.upload', error.message)
      return { ok: false, message: error.message }
    }
    return { ok: true, path, mediaType: uploadMime.startsWith('video/') ? 'video' : 'image' }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[uploadMemoryFile]', message)
    return { ok: false, message }
  }
}

export async function insertMemory(params: {
  userId: string
  visitId: string
  /** null = 日次ログ（spot に紐づかない memories） */
  spotId: string | null
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
