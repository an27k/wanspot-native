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
  target_prefectures?: string[] | null
  target_municipalities?: string[] | null
  target_walk_area_tags?: string[] | null
  dog_size_tags?: string[] | null
  topic_tags?: string[] | null
  segment_level?: ArticleSegmentLevel | null
  /** blocks/spot_links から DB トリガーで自動抽出された軽量カラム（一覧では blocks 全体を転送しないため優先的に使う） */
  linked_spot_refs?: string[] | null
  blocks?: unknown
  spot_links?: unknown
}

type LatLng = { lat: number; lng: number }
type ArticleSegmentLevel = 'municipality' | 'walk_area' | 'prefecture' | 'region' | 'national'

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

function normalizeList(list: string[] | null | undefined): string[] {
  return uniqStrings((Array.isArray(list) ? list : []).map((v) => (typeof v === 'string' ? v.trim() : '')))
}

function normalizedSet(list: string[]): Set<string> {
  return new Set(list.map((v) => v.replace(/\s/g, '')).filter(Boolean))
}

function intersectsNormalized(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  const bSet = normalizedSet(b)
  return a.some((v) => bSet.has(v.replace(/\s/g, '')))
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
  // linked_spot_refs（DBトリガーで blocks/spot_links から事前計算）があれば、
  // blocks 全体を持たない軽量な一覧取得でもスポット参照を取り出せる
  if (Array.isArray(a.linked_spot_refs) && a.linked_spot_refs.length > 0) {
    return uniqStrings(a.linked_spot_refs)
  }
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
  if (distKm < 3) return 45
  if (distKm < 10) return 34
  if (distKm < 30) return 22
  if (distKm < 100) return 4
  return -24
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
    if (normalized.includes(tag.replace(/\s/g, ''))) score += 55
    const cityIdx = tag.indexOf('市')
    if (cityIdx > 0 && cityIdx < tag.length - 1) {
      const afterCity = tag.slice(cityIdx + 1)
      if (afterCity.length >= 2 && normalized.includes(afterCity.replace(/\s/g, ''))) score += 25
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
    if (muni && tagSet.has(muni)) score += 60
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
  let best = Number.NEGATIVE_INFINITY
  for (const tag of tags) {
    const entry = catalogEntryByLabel(tag.trim())
    if (!entry) continue
    for (const spot of spots) {
      if (spot.lat == null || spot.lng == null) continue
      const dKm = calcDistanceMeters(entry.lat, entry.lng, spot.lat, spot.lng) / 1000
      best = Math.max(best, distanceBoostKm(dKm) + 18)
    }
    if (userLocation) {
      const dUserKm = calcDistanceMeters(userLocation.lat, userLocation.lng, entry.lat, entry.lng) / 1000
      best = Math.max(best, distanceBoostKm(dUserKm) * 0.4)
    }
  }
  return Number.isFinite(best) ? best : 0
}

function segmentLevelRank(level: ArticleSegmentLevel | null | undefined): number {
  switch (level) {
    case 'municipality':
      return 0
    case 'walk_area':
      return 1
    case 'prefecture':
      return 2
    case 'region':
      return 3
    case 'national':
      return 4
    default:
      return 3
  }
}

function articleHasExplicitSegments(article: ArticleForFeed): boolean {
  return (
    normalizeList(article.target_municipalities).length > 0 ||
    normalizeList(article.target_walk_area_tags).length > 0 ||
    normalizeList(article.target_prefectures).length > 0
  )
}

function articleSegmentTier({
  article,
  articleSpots,
  nearestDistanceKm,
  userPrefecture,
  userMunicipality,
  walkAreaTags,
}: {
  article: ArticleForFeed
  articleSpots: SpotRow[]
  nearestDistanceKm: number
  userPrefecture: string | null
  userMunicipality: string | null
  walkAreaTags: string[]
}): number {
  const targetPrefectures = normalizeList(article.target_prefectures)
  const targetMunicipalities = normalizeList(article.target_municipalities)
  const targetWalkAreas = normalizeList(article.target_walk_area_tags)
  const userMuniTags = uniqStrings([userMunicipality ?? '', ...walkAreaTags])
  const hasUserArea = userMuniTags.length > 0 || !!userPrefecture
  const hasExplicitSegments = articleHasExplicitSegments(article)

  if (!hasUserArea) return segmentLevelRank(article.segment_level)

  const exactAreaMatch =
    intersectsNormalized(targetMunicipalities, userMuniTags) ||
    intersectsNormalized(targetWalkAreas, walkAreaTags) ||
    articleSpots.some((spot) => {
      const muni = spot.municipality?.trim()
      return !!muni && intersectsNormalized([muni], userMuniTags)
    })
  if (exactAreaMatch) return 0

  const prefectureMatch =
    (!!userPrefecture && intersectsNormalized(targetPrefectures, [userPrefecture])) ||
    (!!userPrefecture && articleSpots.some((spot) => spot.prefecture === userPrefecture))
  if (prefectureMatch) return 1

  if (Number.isFinite(nearestDistanceKm)) {
    if (nearestDistanceKm < 30) return 1
    if (nearestDistanceKm < 100) return 2
  }

  if (!hasExplicitSegments || article.segment_level === 'region' || article.segment_level === 'national') return 3
  return 4
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

  // getUser() はネットワーク検証が走るため、ローカル保存のセッションを使う（並べ替え用途には十分）
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData?.session?.user?.id as string | undefined

  const allSpotRefs = uniqStrings(articles.flatMap((a) => extractSpotIdsFromArticle(a)))
  const uuidRefs = allSpotRefs.filter(isUuid)
  const placeRefs = allSpotRefs.filter((s) => !isUuid(s))

  const spotsById = new Map<string, SpotRow>()
  const spotsByPlaceId = new Map<string, SpotRow>()
  const spotRows: SpotRow[] = []

  const SELECT = 'id, place_id, lat, lng, municipality, prefecture'
  // id / place_id 双方のチャンクを並列取得
  const spotQueries = [
    ...chunkArray(uuidRefs, 200).map((chunk) => supabase.from('spots').select(SELECT).in('id', chunk)),
    ...chunkArray(placeRefs, 200).map((chunk) => supabase.from('spots').select(SELECT).in('place_id', chunk)),
  ]
  const spotResults = await Promise.all(spotQueries)
  for (const { data } of spotResults) {
    for (const r of (data ?? []) as SpotRow[]) {
      if (!r?.id || spotsById.has(r.id)) continue
      spotRows.push(r)
      spotsById.set(r.id, r)
      if (r.place_id) spotsByPlaceId.set(r.place_id, r)
    }
  }

  const articleSpotIdSet = new Set(spotRows.map((r) => r.id))
  const likedCreatedAtBySpotId = new Map<string, string>()
  const checkedCreatedAtBySpotId = new Map<string, string>()

  if (userId && articleSpotIdSet.size > 0) {
    const articleSpotIds = [...articleSpotIdSet]
    // いいね・チェックインのチャンクを全て並列取得
    const likeQueries = chunkArray(articleSpotIds, 300).map((chunk) =>
      supabase.from('spot_likes').select('spot_id, created_at').eq('user_id', userId).in('spot_id', chunk)
    )
    const checkQueries = chunkArray(articleSpotIds, 300).map((chunk) =>
      supabase.from('check_ins').select('spot_id, created_at').eq('user_id', userId).in('spot_id', chunk)
    )
    const [likeResults, checkResults] = await Promise.all([
      Promise.all(likeQueries),
      Promise.all(checkQueries),
    ])
    for (const { data: likedRows } of likeResults) {
      for (const row of likedRows ?? []) {
        const sid = (row as { spot_id?: string }).spot_id
        const createdAt = (row as { created_at?: string }).created_at
        if (!sid || !createdAt) continue
        const prev = likedCreatedAtBySpotId.get(sid)
        if (!prev || prev < createdAt) likedCreatedAtBySpotId.set(sid, createdAt)
      }
    }
    for (const { data: checkedRows } of checkResults) {
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

  type Scored = { article: T; segmentTier: number; segmentRank: number; score: number; tieRand: number }

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

      if (userPrefecture && spot.prefecture === userPrefecture) score += 18
      if (userMunicipality && spot.municipality === userMunicipality) score += 45

      const likedAt = likedCreatedAtBySpotId.get(spot.id)
      if (likedAt) retentionScore += 1.6 * recencyFactor(likedAt, nowMs)
      const checkedAt = checkedCreatedAtBySpotId.get(spot.id)
      if (checkedAt) retentionScore += 0.9 * recencyFactor(checkedAt, nowMs)
    }

    distancesKm.sort((a, b) => a - b)
    const k = Math.min(3, distancesKm.length)
    const nearestDistanceKm = distancesKm[0] ?? Number.POSITIVE_INFINITY
    if (k > 0) {
      score += distanceBoostKm(avg(distancesKm.slice(0, k)))
    }

    score += scoreWalkAreaSpots(articleSpots, walkAreaTags)
    score += scoreCatalogProximity(articleSpots, userLocation, walkAreaTags)

    // --- Phase 2: 行動シグナル（いいね・チェックインが増えるほど効く） ---
    score += retentionScore * 12

    if (recentSet.has(article.id)) score -= 12

    const segmentTier = articleSegmentTier({
      article,
      articleSpots,
      nearestDistanceKm,
      userPrefecture,
      userMunicipality,
      walkAreaTags,
    })
    const segmentRank = segmentLevelRank(article.segment_level)
    const tieRand = rand01FromString(`${seedBase}|${article.id}`)
    scored.push({ article, segmentTier, segmentRank, score, tieRand })
  }

  scored.sort((a, b) => {
    if (a.segmentTier !== b.segmentTier) return a.segmentTier - b.segmentTier
    if (a.segmentRank !== b.segmentRank) return a.segmentRank - b.segmentRank
    if (b.score !== a.score) return b.score - a.score
    return a.tieRand - b.tieRand
  })

  return scored.map((s) => s.article)
}
