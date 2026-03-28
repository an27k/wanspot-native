/** DB の walk_area_tags（推奨: text[]。jsonb 配列や旧 walk_area 文字列も読み取り可能）とアプリ内 string[] の相互変換 */

export const MAX_WALK_AREA_TAGS = 8

export function normalizeWalkAreaTagsFromDb(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    const out: string[] = []
    const seen = new Set<string>()
    for (const x of raw) {
      if (typeof x !== 'string') continue
      const t = x.trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      out.push(t)
      if (out.length >= MAX_WALK_AREA_TAGS) break
    }
    return out
  }
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []
    // Postgres text[] の生文字列 "{a,b}" が届く環境向け
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1).trim()
      if (!inner) return []
      const parts = inner.split(',').map((p) => p.trim().replace(/^"(.*)"$/, '$1'))
      return normalizeWalkAreaTagsFromDb(parts)
    }
    if (s.startsWith('[')) {
      try {
        const p = JSON.parse(s) as unknown
        return normalizeWalkAreaTagsFromDb(p)
      } catch {
        return [s]
      }
    }
    return [s]
  }
  return []
}

export function walkAreaTagsForUpsert(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of tags) {
    const t = typeof x === 'string' ? x.trim() : ''
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= MAX_WALK_AREA_TAGS) break
  }
  return out
}

export function formatWalkAreaTagsDisplay(tags: string[]): string {
  const t = walkAreaTagsForUpsert(tags)
  if (t.length === 0) return ''
  return t.join('、')
}

/** 旧スキーマの text 列 walk_area へ書き込む値（タグ配列の JSON。空なら null） */
export function walkAreaLegacyTextForDb(tags: string[]): string | null {
  const t = walkAreaTagsForUpsert(tags)
  if (t.length === 0) return null
  return JSON.stringify(t)
}

/**
 * PostgREST / Supabase が「walk_area_tags 列がスキーマに無い」と返したとき true。
 * 未マイグレーション環境では walk_area（text）へフォールバックする。
 */
export function isWalkAreaTagsColumnUnavailable(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err?.message) return false
  const m = err.message
  if (!m.includes('walk_area_tags')) return false
  if (m.includes('schema cache')) return true
  if (m.includes('Could not find')) return true
  if (err.code === 'PGRST204') return true
  return false
}

/** DB 行からタグ配列を復元（jsonb 優先、無ければ旧 walk_area） */
export function walkTagsFromUserRow(row: { walk_area_tags?: unknown; walk_area?: unknown } | null | undefined): string[] {
  if (!row) return []
  const fromTags = normalizeWalkAreaTagsFromDb(row.walk_area_tags)
  if (fromTags.length > 0) return fromTags
  return normalizeWalkAreaTagsFromDb(row.walk_area)
}
