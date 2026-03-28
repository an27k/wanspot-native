import type { SupabaseClient } from '@supabase/supabase-js'
import { walkAreaTagsForUpsert, walkTagsFromUserRow } from '@/lib/walk-area-tags'

/** ログインユーザーの「よく散歩するエリア」タグ（正規化済み・最大8件） */
export async function fetchUserWalkAreaTags(client: SupabaseClient): Promise<string[]> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return []
  return fetchUserWalkAreaTagsByUserId(client, user.id)
}

export async function fetchUserWalkAreaTagsByUserId(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await client.from('users').select('walk_area_tags, walk_area').eq('id', userId).maybeSingle()
  return walkAreaTagsForUpsert(walkTagsFromUserRow(data))
}
