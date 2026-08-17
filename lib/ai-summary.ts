import { CACHE_TTL, fetchWithCache } from '@/lib/client-cache'
import { wanspotFetchJson } from '@/lib/wanspot-api'

/** スポット詳細・各種カードで共通の「ワンスポAIレビュー」呼び出し（重複リクエスト・再訪問時の再生成を抑止） */
export type AiSummaryResult = {
  keywords: string[]
  summary: string
  /** うちの子向けの一言。サーバ側で毎回算出され、共有キャッシュには載らない */
  personalNote?: string
  wanspotRating?: { avg: number; count: number }
  /**
   * 'pending' = 浅い版（Web検索が不発のまま表示中。サーバが裏で検索つきに昇格中）。
   * 表示側は「さらにくわしい情報を調べています」を小さく添える。
   * 'done' または未定義（旧サーバ）は確定版として扱い、注釈を出さない
   */
  searchState?: 'done' | 'pending'
}

/**
 * レビューが出せなかった理由。
 *
 * サーバーが空を返す条件は5つあり、「ネット上に情報が無い」はそのうち1つだけ。
 * 残りは閲覧枠の上限・件数枠の上限・レート制限・他リクエストの処理中で、どれも
 * 運用側の都合。情報があるスポットでも、その瞬間に開いた人には空が返る。
 *
 * したがって既定は 'busy'（非断定）にする。emptyReason が無い旧サーバーや、
 * 将来増えた未知の理由も自動的に安全側へ倒れる。'no_information' を明示的に
 * 受け取ったときだけ「見つかりませんでした」と言い切る。
 */
export type AiSummaryEmptyReason = 'no_information' | 'busy'

export type AiSummaryEmpty = { empty: true; reason: AiSummaryEmptyReason }

export function isAiSummaryEmpty(v: AiSummaryResult | AiSummaryEmpty | null): v is AiSummaryEmpty {
  return v !== null && 'empty' in v
}

/** 空応答をキャッシュに載せないため、理由を例外で運ぶ */
class AiSummaryEmptyError extends Error {
  constructor(readonly reason: AiSummaryEmptyReason) {
    super(`ai-summary empty: ${reason}`)
  }
}

function toEmptyReason(raw: unknown): AiSummaryEmptyReason {
  return raw === 'no_information' ? 'no_information' : 'busy'
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
  dogName?: string
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
): Promise<AiSummaryResult | AiSummaryEmpty | null> {
  try {
    const { data } = await fetchWithCache(
      aiSummaryCacheKey(req),
      CACHE_TTL.AI_SUMMARY_MS,
      async () => {
        const json = await wanspotFetchJson<{
          keywords?: string[]
          summary?: string
          personalNote?: string
          wanspotRating?: { avg: number; count: number }
          searchState?: 'done' | 'pending'
          emptyReason?: string
        }>('/api/ai-summary', { method: 'POST', json: req })
        if (!json.keywords || !json.summary) {
          // 例外にすることで fetchWithCache に載らない。一時的な混雑が TTL の間
          // 張り付くと、待っても直らないように見える
          throw new AiSummaryEmptyError(toEmptyReason(json.emptyReason))
        }
        return {
          keywords: json.keywords,
          summary: json.summary,
          personalNote: json.personalNote,
          wanspotRating: json.wanspotRating,
          searchState: json.searchState,
        }
      },
      opts
    )
    return data
  } catch (e) {
    if (e instanceof AiSummaryEmptyError) return { empty: true, reason: e.reason }
    return null
  }
}
