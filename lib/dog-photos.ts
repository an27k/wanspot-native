import { invalidateCache } from '@/lib/client-cache'
import { supabase } from '@/lib/supabase'
import type { PickedImage } from '@/lib/image-picker'

/** アルバム保存期間（日）。無料プランは直近この期間のみ表示・保持。 */
export const ALBUM_RETENTION_DAYS = 30

/** 1日に保存できる枚数（無料プラン）。希少性のため 1 枚。 */
export const DAILY_PHOTO_LIMIT = 1

const BUCKET = 'dog-photos'
const TABLE = 'dog_photos'

export type DogPhoto = {
  id: string
  user_id: string
  image_url: string
  storage_path: string
  /** 撮影した端末ローカル日（YYYY-MM-DD）。1日1枚制限のキー。 */
  taken_on: string
  created_at: string
}

const PHOTO_COLUMNS = 'id, user_id, image_url, storage_path, taken_on, created_at'

/** 端末ローカル日付の YYYY-MM-DD */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 保存期間内（直近 N 日）の写真一覧。新しい順。 */
export async function fetchAlbumPhotos(userId: string): Promise<DogPhoto[]> {
  const since = new Date()
  since.setDate(since.getDate() - ALBUM_RETENTION_DAYS)
  const { data, error } = await supabase
    .from(TABLE)
    .select(PHOTO_COLUMNS)
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as DogPhoto[]
}

/** 今日すでに保存済みの1枚（なければ null）。1日1枚制限の判定に使用。 */
export async function fetchTodayPhoto(userId: string): Promise<DogPhoto | null> {
  const { data } = await supabase
    .from(TABLE)
    .select(PHOTO_COLUMNS)
    .eq('user_id', userId)
    .eq('taken_on', localDateKey())
    .maybeSingle()
  return (data as DogPhoto | null) ?? null
}

export type SaveResult =
  | { ok: true; photo: DogPhoto }
  | { ok: false; reason: 'already_today' | 'upload_failed' | 'db_failed' }

/**
 * 「今日の1枚」を保存する。
 * - 同日の保存があれば already_today で拒否（DB の一意制約でも二重防止）。
 * - ストレージへアップロード → dog_photos へ insert。
 */
export async function saveDailyPhoto(userId: string, image: PickedImage): Promise<SaveResult> {
  const existing = await fetchTodayPhoto(userId)
  if (existing) return { ok: false, reason: 'already_today' }

  const takenOn = localDateKey()
  const path = `${userId}/${takenOn}-${Date.now()}.jpg`

  const res = await fetch(image.uri)
  const buf = await res.arrayBuffer()
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'image/jpeg', upsert: false })
  if (upErr) return { ok: false, reason: 'upload_failed' }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const imageUrl = urlData.publicUrl

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, image_url: imageUrl, storage_path: path, taken_on: takenOn })
    .select(PHOTO_COLUMNS)
    .single()

  if (error || !data) {
    // 一意制約違反（同日に既に存在）は「本日撮影済み」として扱う
    await supabase.storage.from(BUCKET).remove([path])
    if ((error as { code?: string } | null)?.code === '23505') {
      return { ok: false, reason: 'already_today' }
    }
    return { ok: false, reason: 'db_failed' }
  }
  invalidateCache(`dog:today:${userId}:${takenOn}`)
  invalidateCache(`dog:album:${userId}`)
  return { ok: true, photo: data as DogPhoto }
}

/** 本日分を上書き（撮り直し用）。ストレージ・DB の既存行を削除してから保存。 */
export async function replaceTodayPhoto(userId: string, image: PickedImage): Promise<SaveResult> {
  const existing = await fetchTodayPhoto(userId)
  if (existing) {
    await supabase.storage.from(BUCKET).remove([existing.storage_path])
    await supabase.from(TABLE).delete().eq('id', existing.id)
    const takenOn = localDateKey()
    invalidateCache(`dog:today:${userId}:${takenOn}`)
    invalidateCache(`dog:album:${userId}`)
  }
  return saveDailyPhoto(userId, image)
}
