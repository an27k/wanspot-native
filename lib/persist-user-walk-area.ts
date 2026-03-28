import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isWalkAreaTagsColumnUnavailable,
  walkAreaLegacyTextForDb,
  walkAreaTagsForUpsert,
} from '@/lib/walk-area-tags'

type OwnerUpsertRow = {
  id: string
  name: string
  parent_type: string
  birthday: string
  bio: string | null
  walkAreaTags: string[]
}

/** オンボーディング完了時の users upsert（walk_area_tags 無し DB では walk_area に JSON で保存） */
export async function upsertUserWithWalkAreas(
  supabase: SupabaseClient,
  row: OwnerUpsertRow
): Promise<{ error: { message: string } | null }> {
  const tagsSaved = walkAreaTagsForUpsert(row.walkAreaTags)
  const { walkAreaTags: _, ...rest } = row
  const withTags = { ...rest, walk_area_tags: tagsSaved }
  const first = await supabase.from('users').upsert(withTags)
  if (!first.error) return { error: null }
  if (!isWalkAreaTagsColumnUnavailable(first.error)) return { error: first.error }

  const legacy = walkAreaLegacyTextForDb(tagsSaved)
  const second = await supabase.from('users').upsert({
    ...rest,
    walk_area: legacy,
  })
  return { error: second.error }
}

type OwnerUpdateFields = {
  name: string
  parent_type: string
  bio: string | null
  birthday: string
  photo_url: string | null
}

/** マイページの users update（同上フォールバック） */
export async function updateUserWithWalkAreas(
  supabase: SupabaseClient,
  userId: string,
  fields: OwnerUpdateFields,
  walkAreaTags: string[]
): Promise<{ error: { message: string } | null }> {
  const tagsSaved = walkAreaTagsForUpsert(walkAreaTags)
  const base = { ...fields }
  const first = await supabase.from('users').update({ ...base, walk_area_tags: tagsSaved }).eq('id', userId)
  if (!first.error) return { error: null }
  if (!isWalkAreaTagsColumnUnavailable(first.error)) return { error: first.error }

  const second = await supabase
    .from('users')
    .update({ ...base, walk_area: walkAreaLegacyTextForDb(tagsSaved) })
    .eq('id', userId)
  return { error: second.error }
}
