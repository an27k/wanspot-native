import { wanspotFetch } from '@/lib/wanspot-api'

/** サーバー実測値でクライアントのMediaSetLogにマージするパッチ（全項目optional） */
export type CloudSetLogPatch = {
  blurScore?: number
  brightnessScore?: number
  cropFitScore?: number
  emotionScore?: number
  subjectDetected?: boolean
  analysisSource?: 'cloud_image' | 'cv_hybrid'
}

export type CloudQualityResult = {
  mediaId: string
  qualityScore: number
  source: 'cloud' | 'heuristic' | 'rejected'
  setLog?: CloudSetLogPatch
}

type QualityApiResponse = {
  results: CloudQualityResult[]
}

/** クラウド品質解析 — 失敗時は空（呼び出し側でヒューリスティックへ） */
export async function fetchCloudQualityScores(
  items: {
    mediaId: string
    storagePath: string
    mediaType: 'image' | 'video'
    rating?: number | null
  }[]
): Promise<Map<string, CloudQualityResult>> {
  const out = new Map<string, CloudQualityResult>()
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
      if (row.source !== 'rejected') out.set(row.mediaId, row)
    }
  } catch (e) {
    console.warn('[fetchCloudQualityScores]', e)
  }
  return out
}
