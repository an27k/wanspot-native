import { CACHE_TTL, fetchWithCache } from '@/lib/client-cache'
import { wanspotFetchJson } from '@/lib/wanspot-api'

/** スポット詳細・各種カードで共通の「ワンスポAIレビュー」呼び出し（重複リクエスト・再訪問時の再生成を抑止） */
export type AiSummaryResult = {
  keywords: string[]
  summary: string
  wanspotRating?: { avg: number; count: number }
}

export type AiSummaryRequest = {
  place_id: string
  spot_id?: string
  name: string
  category: string
  rating?: number | null
  address?: string | null
  reviews?: string[]
  dogSize?: string
  dogBreed?: string
  userContext?: {
    walkAreaTags: string[]
    lat: number | null
    lng: number | null
  }
}

function aiSummaryCacheKey(req: AiSummaryRequest): string {
  const dogKey = `${req.dogSize ?? 'none'}:${req.dogBreed ?? 'none'}`
  const reviewsKey = req.reviews && req.reviews.length > 0 ? 'withReviews' : 'noReviews'
  // v2: サーバ側プロンプト改訂（飼い主目線・検証済みペット可否の注入）に合わせて旧キャッシュを無効化
  return `ai-summary:v2:${req.place_id}:${dogKey}:${reviewsKey}`
}

/**
 * `/api/ai-summary` をキャッシュ付きで呼ぶ。同一スポット・同一犬プロフィールの組み合わせは
 * TTL 内は再生成せず即返却し、同時に複数箇所（詳細画面・各カード）から呼ばれても1回にまとめる。
 * 失敗時は null を返す（呼び出し側で任意のフォールバック表示を行う）。
 */
export async function fetchAiSummary(
  req: AiSummaryRequest,
  opts?: { force?: boolean }
): Promise<AiSummaryResult | null> {
  try {
    const { data } = await fetchWithCache(
      aiSummaryCacheKey(req),
      CACHE_TTL.AI_SUMMARY_MS,
      async () => {
        const json = await wanspotFetchJson<{
          keywords?: string[]
          summary?: string
          wanspotRating?: { avg: number; count: number }
        }>('/api/ai-summary', { method: 'POST', json: req })
        if (!json.keywords || !json.summary) {
          throw new Error('ai-summary: invalid response')
        }
        return { keywords: json.keywords, summary: json.summary, wanspotRating: json.wanspotRating }
      },
      opts
    )
    return data
  } catch {
    return null
  }
}
