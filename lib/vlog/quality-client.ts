import { wanspotFetch } from '@/lib/wanspot-api'

export type CloudQualityResult = {
  mediaId: string
  qualityScore: number
  source: 'cloud' | 'heuristic' | 'rejected'
}

type QualityApiResponse = {
  results: CloudQualityResult[]
}

/** クラウド品質解析 — 失敗時は空（呼び出し側でヒューリスティックへ） */
export async function fetchCloudQualityScores(
  items: Array<{
    mediaId: string
    storagePath: string
    mediaType: 'image' | 'video'
    rating?: number | null
  }>
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (items.length === 0) return out

  try {
    const res = await wanspotFetch('/api/vlog/quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) return out
    const json = (await res.json()) as QualityApiResponse
    for (const row of json.results ?? []) {
      if (row.source !== 'rejected') out.set(row.mediaId, row.qualityScore)
    }
  } catch (e) {
    console.warn('[fetchCloudQualityScores]', e)
  }
  return out
}
