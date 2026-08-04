import { wanspotFetch } from '@/lib/wanspot-api'

/**
 * スポットをサーバ経由で引く。
 *
 * アプリから spots テーブルを直接読んでいた箇所をここに集約する。
 * anon キーはアプリのバンドル（IPA 内 EXConstants.bundle/app.config）に平文で
 * 含まれており実質公開情報なので、直読みを許すと $0.02/件で生成した判定列が
 * ページングで全件抜ける（実測で19,786件が取得可能だった）。
 *
 * 列はサーバ側で用途ごとに固定してある。クライアントが列名を指定できると
 * 結局 select('*') 相当を許すことになるため、用途名だけを渡す。
 */
export type SpotColumnSet = 'list' | 'card' | 'geo' | 'minimal'

/** サーバ側の上限と揃える。超える分は呼び出し側で分割すること */
export const SPOTS_BY_IDS_MAX = 200

export async function fetchSpotsByIds(params: {
  ids?: string[]
  placeIds?: string[]
  columns: SpotColumnSet
}): Promise<Record<string, unknown>[]> {
  const ids = params.ids?.filter(Boolean) ?? []
  const placeIds = params.placeIds?.filter(Boolean) ?? []
  if (ids.length === 0 && placeIds.length === 0) return []

  // 上限を超える分はチャンクに割って全部取る。呼び出し側が件数を気にせず使えるように
  const chunks: { ids: string[]; placeIds: string[] }[] = []
  for (let i = 0; i < Math.max(ids.length, 1); i += SPOTS_BY_IDS_MAX) {
    const idChunk = ids.slice(i, i + SPOTS_BY_IDS_MAX)
    if (idChunk.length > 0) chunks.push({ ids: idChunk, placeIds: [] })
  }
  for (let i = 0; i < placeIds.length; i += SPOTS_BY_IDS_MAX) {
    chunks.push({ ids: [], placeIds: placeIds.slice(i, i + SPOTS_BY_IDS_MAX) })
  }
  if (chunks.length === 0) return []

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await wanspotFetch('/api/spots/by-ids', {
          method: 'POST',
          json: { ids: chunk.ids, placeIds: chunk.placeIds, columns: params.columns },
        })
        if (!res.ok) return []
        const json = (await res.json()) as { spots?: Record<string, unknown>[] }
        return json.spots ?? []
      } catch {
        return []
      }
    })
  )

  // id / place_id の両方で引いたときの重複を落とす
  const seen = new Set<string>()
  const out: Record<string, unknown>[] = []
  for (const row of results.flat()) {
    const key = String(row.id ?? row.place_id ?? '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}
