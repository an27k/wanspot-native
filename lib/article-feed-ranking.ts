import type { SupabaseClient } from '@supabase/supabase-js'
import { catalogEntryByLabel } from '@/lib/walk-area-catalog'
import {
  buildArticleSearchText,
  scoreArticleFreshness,
  scoreArticleRegion,
  scoreArticleSeason,
} from '@/lib/articles/scoring'
import { calcDistanceMeters } from '@/lib/user-spot-list-utils'

export type ArticleForFeed = {
  id: string
  title: string
  summary: string
  slug: string
  category: string
  theme?: string | null
  keywords: string[]
  image_url: string | null
  created_at: string
  published_at?: string | null
  blocks?: unknown
  spot_links?: unknown
}

type LatLng = { lat: number; lng: number }

type SpotRow = {
  id: string
  place_id: string | null
  lat: number | null
  lng: number | null
  municipality: string | null
  prefecture: string | null
}

export type PersonalizeArticlesContext = {
  userLocation: LatLng | null
  userPrefecture?: string | null
  userMunicipality?: string | null
  walkAreaTags?: string[]
  recentArticleIds: string[]
  nowMs?: number
}

const UUID_RE = /^[0-9a-f-]{36}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test((s ?? '').trim())
}

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += chunkSize) out.push(arr.slice(i, i + chunkSize))
  return out
}

function uniqStrings(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of list) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function extractSpotIdsFromBlocks(blocks: unknown): string[] {
  if (!Array.isArray(blocks)) return []
  const out: string[] = []
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue
    const o = b as Record<string, unknown>
    if (String(o.type ?? '').trim().toLowerCase() !== 'spot') continue
    const spotId =
      typeof o.spot_id === 'string' ? o.spot_id : typeof (o as { spotId?: string }).spotId === 'string' ? (o as { spotId: string }).spotId : null
    if (spotId?.trim()) out.push(spotId.trim())
  }
  return out
}

function extractSpotIdsFromSpotLinks(spotLinks: unknown): string[] {
  if (!Array.isArray(spotLinks)) return []
  const out: string[] = []
  for (const sl of spotLinks) {
    if (!sl || typeof sl !== 'object') continue
    const o = sl as Record<string, unknown>
    const spotId =
      typeof o.spot_id === 'string' ? o.spot_id : typeof (o as { spotId?: string }).spotId === 'string' ? (o as { spotId: string }).spotId : null
    if (spotId?.trim()) out.push(spotId.trim())
  }
  return out
}

function extractSpotIdsFromArticle(a: ArticleForFeed): string[] {
  return uniqStrings([...extractSpotIdsFromBlocks(a.blocks), ...extractSpotIdsFromSpotLinks(a.spot_links)])
}

function fnv1aU32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash >>> 0
}

function rand01FromString(s: string): number {
  return fnv1aU32(s) / 4294967296
}

function recencyFactor(createdAt: string, nowMs: number): number {
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return 0
  const ageDays = Math.max(0, (nowMs - t) / 86_400_000)
  return Math.exp(-ageDays / 90)
}

/** AIレコメンドの距離ブーストと同じ段階 */
function distanceBoostKm(distKm: number): number {
  if (distKm < 3) return 20
  if (distKm < 10) return 15
  if (distKm < 30) return 10
  if (distKm < 100) return 3
  return -10
}

function avg(nums: number[]): number {
  if (nums.length === 0) return Number.POSITIVE_INFINITY
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** 登録エリアタグ × 記事テキスト（AIレコメンドの walkAreaTags 相当） */
function scoreWalkAreaText(searchText: string, tags: string[]): number {
  const normalized = searchText.replace(/\s/g, '')
  let score = 0
  for (const t of tags) {
    const tag = t.trim()
    if (!tag) continue
    if (normalized.includes(tag.replace(/\s/g, ''))) score += 15
    const cityIdx = tag.indexOf('市')
    if (cityIdx > 0 && cityIdx < tag.length - 1) {
      const afterCity = tag.slice(cityIdx + 1)
      if (afterCity.length >= 2 && normalized.includes(afterCity.replace(/\s/g, ''))) score += 10
    }
  }
  return score
}

/** 記事内スポットの市区町村が登録エリアと一致 */
function scoreWalkAreaSpots(spots: SpotRow[], tags: string[]): number {
  if (tags.length === 0) return 0
  const tagSet = new Set(tags.map((t) => t.trim()).filter(Boolean))
  let score = 0
  for (const spot of spots) {
    const muni = spot.municipality?.trim()
    if (muni && tagSet.has(muni)) score += 15
  }
  return score
}

/** カタログ代表座標との距離（discover-spot-ranking 相当） */
function scoreCatalogProximity(
  spots: SpotRow[],
  userLocation: LatLng | null,
  tags: string[]
): number {
  if (tags.length === 0) return 0
  let best = 0
  for (const tag of tags) {
    const entry = catalogEntryByLabel(tag.trim())
    if (!entry) continue
    for (const spot of spots) {
      if (spot.lat == null || spot.lng == null) continue
      const d = calcDistanceMeters(entry.lat, entry.lng, spot.lat, spot.lng)
      best = Math.max(best, -d / 650)
    }
    if (userLocation) {
      const dUser = calcDistanceMeters(userLocation.lat, userLocation.lng, entry.lat, entry.lng)
      best = Math.max(best, -dUser / 450)
    }
  }
  return best
}

export type RankArticlesFeedArgs<T extends ArticleForFeed> = {
  supabase: SupabaseClient
  articles: T[]
  userLocation: LatLng | null
  recentArticleIds: string[]
  userPrefecture?: string | null
  userMunicipality?: string | null
  walkAreaTags?: string[]
  topN?: number
  nowMs?: number
}

/**
 * まとめ記事のパーソナライズ並び替え。
 *
 * Phase 1（今）: 現在地・都道府県・登録エリアで地域優先（AIレコメンドと同系統）
 * Phase 2（データが溜まるほど）: 記事内スポットへのいいね・チェックインで精度アップ
 */
export async function personalizeArticlesFeed<T extends ArticleForFeed>(
  supabase: SupabaseClient,
  articles: T[],
  ctx: PersonalizeArticlesContext
): Promise<T[]> {
  return rankArticlesFeed({
    supabase,
    articles,
    userLocation: ctx.userLocation,
    recentArticleIds: ctx.recentArticleIds,
    userPrefecture: ctx.userPrefecture,
    userMunicipality: ctx.userMunicipality,
    walkAreaTags: ctx.walkAreaTags,
    nowMs: ctx.nowMs,
  })
}

export async function rankArticlesFeed<T extends ArticleForFeed>({
  supabase,
  articles,
  userLocation,
  recentArticleIds,
  userPrefecture = null,
  userMunicipality = null,
  walkAreaTags = [],
  nowMs = Date.now(),
}: RankArticlesFeedArgs<T>): Promise<T[]> {
  if (articles.length <= 1) return articles

  const locKey = userLocation ? `${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}` : 'noloc'
  const dayKey = new Date(nowMs).toISOString().slice(0, 10)
  const tagsKey = [...walkAreaTags].sort().join('|') || 'notags'

  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id as string | undefined

  const allSpotRefs = uniqStrings(articles.flatMap((a) => extractSpotIdsFromArticle(a)))
  const uuidRefs = allSpotRefs.filter(isUuid)
  const placeRefs = allSpotRefs.filter((s) => !isUuid(s))

  const spotsById = new Map<string, SpotRow>()
  const spotsByPlaceId = new Map<string, SpotRow>()
  const spotRows: SpotRow[] = []

  const SELECT = 'id, place_id, lat, lng, municipality, prefecture'
  for (const chunk of chunkArray(uuidRefs, 200)) {
    const { data } = await supabase.from('spots').select(SELECT).in('id', chunk)
    for (const r of (data ?? []) as SpotRow[]) {
      if (!r?.id) continue
      spotRows.push(r)
      spotsById.set(r.id, r)
      if (r.place_id) spotsByPlaceId.set(r.place_id, r)
    }
  }
  for (const chunk of chunkArray(placeRefs, 200)) {
    const { data } = await supabase.from('spots').select(SELECT).in('place_id', chunk)
    for (const r of (data ?? []) as SpotRow[]) {
      if (!r?.place_id) continue
      spotRows.push(r)
      spotsById.set(r.id, r)
      spotsByPlaceId.set(r.place_id, r)
    }
  }

  const articleSpotIdSet = new Set(spotRows.map((r) => r.id))
  const likedCreatedAtBySpotId = new Map<string, string>()
  const checkedCreatedAtBySpotId = new Map<string, string>()

  if (userId && articleSpotIdSet.size > 0) {
    const articleSpotIds = [...articleSpotIdSet]
    for (const chunk of chunkArray(articleSpotIds, 300)) {
      const { data: likedRows } = await supabase
        .from('spot_likes')
        .select('spot_id, created_at')
        .eq('user_id', userId)
        .in('spot_id', chunk)
      for (const row of likedRows ?? []) {
        const sid = (row as { spot_id?: string }).spot_id
        const createdAt = (row as { created_at?: string }).created_at
        if (!sid || !createdAt) continue
        const prev = likedCreatedAtBySpotId.get(sid)
        if (!prev || prev < createdAt) likedCreatedAtBySpotId.set(sid, createdAt)
      }
    }
    for (const chunk of chunkArray(articleSpotIds, 300)) {
      const { data: checkedRows } = await supabase
        .from('check_ins')
        .select('spot_id, created_at')
        .eq('user_id', userId)
        .in('spot_id', chunk)
      for (const row of checkedRows ?? []) {
        const sid = (row as { spot_id?: string }).spot_id
        const createdAt = (row as { created_at?: string }).created_at
        if (!sid || !createdAt) continue
        const prev = checkedCreatedAtBySpotId.get(sid)
        if (!prev || prev < createdAt) checkedCreatedAtBySpotId.set(sid, createdAt)
      }
    }
  }

  const recentSet = new Set(recentArticleIds)
  const seedBase = `${userId ?? 'anon'}|${dayKey}|${locKey}|${tagsKey}`

  type Scored = { article: T; score: number; tieRand: number }

  const scored: Scored[] = []

  for (const article of articles) {
    const searchText = buildArticleSearchText({
      title: article.title,
      theme: article.theme ?? null,
      category: article.category,
      summary: article.summary,
      keywords: article.keywords,
    })

    let score = 50

    // --- Phase 1: 位置情報ベース ---
    score += scoreArticleRegion(searchText, { userPrefecture, userMunicipality })
    score += scoreWalkAreaText(searchText, walkAreaTags)
    score += scoreArticleSeason(searchText, nowMs)
    score += scoreArticleFreshness(article.published_at, nowMs)

    const spotRefs = extractSpotIdsFromArticle(article)
    const articleSpots: SpotRow[] = []
    const distancesKm: number[] = []
    let retentionScore = 0
    const seenSpotIds = new Set<string>()

    for (const ref of spotRefs) {
      const spot = isUuid(ref) ? spotsById.get(ref) : spotsByPlaceId.get(ref)
      if (!spot || seenSpotIds.has(spot.id)) continue
      seenSpotIds.add(spot.id)
      articleSpots.push(spot)

      if (userLocation && spot.lat != null && spot.lng != null) {
        const dM = calcDistanceMeters(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
        distancesKm.push(dM / 1000)
      }

      if (userPrefecture && spot.prefecture === userPrefecture) score += 5

      const likedAt = likedCreatedAtBySpotId.get(spot.id)
      if (likedAt) retentionScore += 1.6 * recencyFactor(likedAt, nowMs)
      const checkedAt = checkedCreatedAtBySpotId.get(spot.id)
      if (checkedAt) retentionScore += 0.9 * recencyFactor(checkedAt, nowMs)
    }

    distancesKm.sort((a, b) => a - b)
    const k = Math.min(3, distancesKm.length)
    if (k > 0) {
      score += distanceBoostKm(avg(distancesKm.slice(0, k)))
    }

    score += scoreWalkAreaSpots(articleSpots, walkAreaTags)
    score += scoreCatalogProximity(articleSpots, userLocation, walkAreaTags)

    // --- Phase 2: 行動シグナル（いいね・チェックインが増えるほど効く） ---
    score += retentionScore * 12

    if (recentSet.has(article.id)) score -= 12

    const tieRand = rand01FromString(`${seedBase}|${article.id}`)
    scored.push({ article, score, tieRand })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.tieRand - b.tieRand
  })

  return scored.map((s) => s.article)
}
