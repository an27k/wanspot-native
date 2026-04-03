import type { SupabaseClient } from '@supabase/supabase-js'
import { calcDistanceMeters } from '@/lib/user-spot-list-utils'

export type ArticleForFeed = {
  id: string
  title: string
  summary: string
  slug: string
  category: string
  keywords: string[]
  image_url: string | null
  created_at: string
  published_at?: string | null
  /** CMS 由来（jsonb） */
  blocks?: unknown
  /** CMS 由来（jsonb） */
  spot_links?: unknown
}

type LatLng = { lat: number; lng: number }

type SpotRow = {
  id: string
  place_id: string | null
  lat: number | null
  lng: number | null
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
    if (!s) continue
    if (seen.has(s)) continue
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
    const typeRaw = String(o.type ?? '').trim().toLowerCase()
    if (typeRaw !== 'spot') continue
    const spotId = typeof o.spot_id === 'string' ? o.spot_id : typeof (o as any).spotId === 'string' ? (o as any).spotId : null
    if (typeof spotId === 'string' && spotId.trim().length > 0) out.push(spotId.trim())
  }
  return out
}

function extractSpotIdsFromSpotLinks(spotLinks: unknown): string[] {
  if (!Array.isArray(spotLinks)) return []
  const out: string[] = []
  for (const sl of spotLinks) {
    if (!sl || typeof sl !== 'object') continue
    const o = sl as Record<string, unknown>
    const spotId = typeof o.spot_id === 'string' ? o.spot_id : typeof (o as any).spotId === 'string' ? (o as any).spotId : null
    if (typeof spotId === 'string' && spotId.trim().length > 0) out.push(spotId.trim())
  }
  return out
}

function extractSpotIdsFromArticle(a: ArticleForFeed): string[] {
  return uniqStrings([...extractSpotIdsFromBlocks(a.blocks), ...extractSpotIdsFromSpotLinks(a.spot_links)])
}

// FNV-1a (deterministic)
function fnv1aU32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash >>> 0
}

function rand01FromString(s: string): number {
  // [0,1)
  const h = fnv1aU32(s)
  return h / 4294967296
}

function recencyFactor(createdAt: string | Date, nowMs: number): number {
  const dt = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const t = dt.getTime()
  if (!Number.isFinite(t)) return 0
  const ageDays = Math.max(0, (nowMs - t) / 86_400_000)
  // 90日でだいたい1/e
  return Math.exp(-ageDays / 90)
}

function computeDistanceMeters(userLocation: LatLng, spot: Pick<SpotRow, 'lat' | 'lng'>): number | null {
  if (spot.lat == null || spot.lng == null) return null
  return calcDistanceMeters(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
}

function avg(nums: number[]): number {
  if (nums.length === 0) return Number.POSITIVE_INFINITY
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export type RankArticlesFeedArgs<T extends ArticleForFeed> = {
  supabase: SupabaseClient
  articles: T[]
  userLocation: LatLng | null
  recentArticleIds: string[]
  topN?: number
  nowMs?: number
}

/**
 * 要件:
 * - 上位 `topN` は「現在地に近い」ものを距離で優先
 * - 残りは「ランダム」＋「ユーザーのリテンションが上がる（いいね/チェックイン一致）」で並べる
 *
 * 注意:
 * - 記事は blocks / spot_links の spot_id を辿ってスポット座標を引くため、記事数が増えるほどクエリ負荷が上がります。
 */
export async function rankArticlesFeed<T extends ArticleForFeed>({
  supabase,
  articles,
  userLocation,
  recentArticleIds,
  topN = 10,
  nowMs = Date.now(),
}: RankArticlesFeedArgs<T>): Promise<T[]> {
  if (articles.length <= 1) return articles

  const locKey = userLocation ? `${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}` : 'noloc'
  const dayKey = new Date(nowMs).toISOString().slice(0, 10)

  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id as string | undefined

  // まず記事内の全スポット参照を収集して、まとめて座標を引く
  const allSpotRefs = uniqStrings(articles.flatMap((a) => extractSpotIdsFromArticle(a)))
  const uuidRefs = allSpotRefs.filter(isUuid)
  const placeRefs = allSpotRefs.filter((s) => !isUuid(s))

  const spotRows: SpotRow[] = []
  const spotsById = new Map<string, SpotRow>()
  const spotsByPlaceId = new Map<string, SpotRow>()

  const SELECT = 'id, place_id, lat, lng'
  // UUID を引く
  if (uuidRefs.length > 0) {
    for (const chunk of chunkArray(uuidRefs, 200)) {
      const { data } = await supabase.from('spots').select(SELECT).in('id', chunk)
      const rows = (data ?? []) as unknown as SpotRow[]
      for (const r of rows) {
        if (!r?.id) continue
        spotRows.push(r)
        spotsById.set(r.id, r)
        if (r.place_id) spotsByPlaceId.set(r.place_id, r)
      }
    }
  }
  // place_id を引く
  if (placeRefs.length > 0) {
    for (const chunk of chunkArray(placeRefs, 200)) {
      const { data } = await supabase.from('spots').select(SELECT).in('place_id', chunk)
      const rows = (data ?? []) as unknown as SpotRow[]
      for (const r of rows) {
        if (!r?.place_id) continue
        spotRows.push(r)
        spotsById.set(r.id, r)
        spotsByPlaceId.set(r.place_id, r)
      }
    }
  }

  // ユーザーのいいね/チェックイン（記事に関係するスポットのみ）
  const articleSpotIdSet = new Set<string>(spotRows.map((r) => r.id).filter(Boolean))
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
        const sid = (row as any).spot_id as string | undefined
        const createdAt = (row as any).created_at as string | undefined
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
        const sid = (row as any).spot_id as string | undefined
        const createdAt = (row as any).created_at as string | undefined
        if (!sid || !createdAt) continue
        const prev = checkedCreatedAtBySpotId.get(sid)
        if (!prev || prev < createdAt) checkedCreatedAtBySpotId.set(sid, createdAt)
      }
    }
  }

  const recentSet = new Set<string>(recentArticleIds)
  const seedBase = `${userId ?? 'anon'}|${dayKey}|${locKey}`

  type Scored = {
    article: T
    distanceMeters: number
    retentionScore: number
    tieRand: number
  }

  const scored: Scored[] = []

  for (const article of articles) {
    const spotRefs = extractSpotIdsFromArticle(article)
    const spotIdSet = new Set<string>()
    const distances: number[] = []
    let retentionScore = 0

    for (const ref of spotRefs) {
      const spot = isUuid(ref) ? spotsById.get(ref) : spotsByPlaceId.get(ref)
      if (!spot) continue
      if (spotIdSet.has(spot.id)) continue
      spotIdSet.add(spot.id)

      const d = userLocation ? computeDistanceMeters(userLocation, spot) : null
      if (d != null && Number.isFinite(d)) distances.push(d)

      const likedAt = likedCreatedAtBySpotId.get(spot.id)
      if (likedAt) retentionScore += 1.6 * recencyFactor(likedAt, nowMs)
      const checkedAt = checkedCreatedAtBySpotId.get(spot.id)
      if (checkedAt) retentionScore += 0.9 * recencyFactor(checkedAt, nowMs)
    }

    distances.sort((a, b) => a - b)
    const k = Math.min(3, distances.length)
    const distanceMeters = distances.length > 0 ? avg(distances.slice(0, k)) : Number.POSITIVE_INFINITY

    // topN の同率ケース用（距離・リテンションだけで決まらない揺れを避ける）
    const tieRand = rand01FromString(`${seedBase}|${article.id}`)

    // recent は上位を壊さない程度に、主に残りのシャッフル重みで使う
    // ここでは保持は 0〜数点程度に留める
    if (recentSet.has(article.id)) retentionScore *= 0.85

    scored.push({ article, distanceMeters, retentionScore, tieRand })
  }

  // 1) 上位 topN は距離（可能なら）優先
  const distanceRank = [...scored].sort((a, b) => {
    if (userLocation) {
      if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters
    }
    if (b.retentionScore !== a.retentionScore) return b.retentionScore - a.retentionScore
    return a.tieRand - b.tieRand
  })

  const top = distanceRank.slice(0, Math.min(topN, distanceRank.length))
  const topIds = new Set<string>(top.map((x) => x.article.id))
  const rest = scored.filter((x) => !topIds.has(x.article.id))

  // 2) 残りは「ランダム」＋「リテンション/近さ」の重みづけでシャッフル（重みが大きいほど前に出やすい）
  const restSorted = [...rest]
    .map((x) => {
      const locality =
        userLocation && Number.isFinite(x.distanceMeters) && x.distanceMeters > 0
          ? 1 / (1 + x.distanceMeters / 1200) // 1.2km くらいで半減イメージ
          : 0

      // recent ペナルティは強め（残りにおける「新規性」を確保）
      const recentPenalty = recentSet.has(x.article.id) ? 0.22 : 1
      const weight = Math.max(0.001, (0.35 + x.retentionScore * 0.75 + locality * 0.25) * recentPenalty)

      // 重み付き無復元サンプル用キー
      const u = Math.max(1e-9, rand01FromString(`${seedBase}|rest|${x.article.id}`))
      const key = -Math.log(u) / weight
      return { x, key }
    })
    .sort((a, b) => a.key - b.key)
    .map((k) => k.x)

  return [...top.map((x) => x.article), ...restSorted.map((x) => x.article)]
}

