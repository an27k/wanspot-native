import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle, Path, Polygon, Text as SvgTextNode } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArticleRemoteImage } from '@/components/articles/ArticleRemoteImage'
import { RunningDog } from '@/components/DogStates'
import { colors } from '@/constants/colors'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { supabase } from '@/lib/supabase'
import { spotPhotoUrl, wanspotFetch, wanspotFetchJson } from '@/lib/wanspot-api'
import type { PlaceCardEnrichment } from '@/lib/user-spot-list-utils'

type Block =
  | { type: 'text'; content: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'spot'; spot_id: string; spot_name: string; description: string }

type SpotRow = {
  id: string
  place_id: string
  name: string
  category: string
  address: string | null
}

function isUuid(s: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(s.trim())
}

function normalizePriceLevel(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(4, Math.round(n)))
}

/** `/api/spots/detail` のレスポンス（フラット or result）から spots 行用ペイロードを組み立てる */
function buildSpotUpsertFromDetailJson(json: unknown, placeId: string, fallbackName: string): Record<string, unknown> | null {
  if (!json || typeof json !== 'object') return null
  const root = json as Record<string, unknown>
  if (typeof root.error === 'string' && root.error.length > 0) return null
  const o = (root.result && typeof root.result === 'object' ? root.result : root) as Record<string, unknown>
  const name =
    (typeof o.name === 'string' && o.name.trim()) ||
    (fallbackName.trim() || 'スポット')
  const addr =
    (typeof o.formatted_address === 'string' && o.formatted_address.trim()) ||
    (typeof o.vicinity === 'string' && o.vicinity.trim()) ||
    null
  const geom = o.geometry as { location?: { lat?: number; lng?: number } } | undefined
  const lat = typeof geom?.location?.lat === 'number' ? geom.location.lat : null
  const lng = typeof geom?.location?.lng === 'number' ? geom.location.lng : null
  const rating = typeof o.rating === 'number' && Number.isFinite(o.rating) ? o.rating : null
  const price_level = normalizePriceLevel(o.price_level ?? o.priceLevel)
  let category = 'establishment'
  const types = o.types
  const typeStrings = Array.isArray(types)
    ? types.filter((t): t is string => typeof t === 'string')
    : []
  if (typeStrings.length > 0) {
    category = typeStrings[0]
  }
  return {
    place_id: placeId,
    name,
    category,
    address: addr,
    lat,
    lng,
    rating,
    price_level,
    ...(typeStrings.length > 0 ? { google_types: typeStrings } : {}),
  }
}

async function ensureSpotRowFromPlaceId(placeId: string, fallbackName: string): Promise<SpotRow | null> {
  const res = await wanspotFetch(`/api/spots/detail?place_id=${encodeURIComponent(placeId)}`)
  if (!res.ok) return null
  let json: unknown
  try {
    json = await res.json()
  } catch {
    return null
  }
  const payload = buildSpotUpsertFromDetailJson(json, placeId, fallbackName)
  if (!payload) return null
  const { data, error } = await supabase
    .from('spots')
    .upsert(payload, { onConflict: 'place_id' })
    .select('id, place_id, name, category, address')
    .single()
  if (error || !data) return null
  return data as SpotRow
}

/** CMS 由来の JSON で camelCase や表記ゆれを吸収 */
function normalizeArticleBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return []
  const out: Block[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const typeRaw = String(o.type ?? '').toLowerCase()
    if (typeRaw === 'spot') {
      const sid =
        (typeof o.spot_id === 'string' && o.spot_id.trim()) ||
        (typeof o.spotId === 'string' && o.spotId.trim()) ||
        ''
      const name =
        (typeof o.spot_name === 'string' && o.spot_name) ||
        (typeof o.spotName === 'string' && o.spotName) ||
        ''
      const desc = typeof o.description === 'string' ? o.description : ''
      if (!sid) continue
      out.push({ type: 'spot', spot_id: sid.trim(), spot_name: name, description: desc })
      continue
    }
    if (typeRaw === 'image') {
      const url = typeof o.url === 'string' ? o.url : ''
      if (!url) continue
      out.push({
        type: 'image',
        url,
        caption: typeof o.caption === 'string' ? o.caption : undefined,
      })
      continue
    }
    if (typeRaw === 'text') {
      const content = typeof o.content === 'string' ? o.content : ''
      if (content) out.push({ type: 'text', content })
    }
  }
  return out
}

type SpotLink = { spot_name: string; spot_id: string | null; description: string }

type Article = {
  id: string
  title: string
  slug: string
  body: string
  summary: string
  keywords: string[]
  blocks: Block[] | null
  spot_links: SpotLink[] | null
  category: string
  image_url: string | null
}

const IconChevron = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
)

const IconStarSm = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="#FFD84D" stroke="#FFD84D" strokeWidth={1.5}>
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
)

function PriceLevel({ level }: { level: number | null }) {
  if (level === null || level === undefined) {
    return <Text style={styles.plQ}>?</Text>
  }
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4].map((i) => (
        <Svg key={i} width={10} height={10} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill={i <= level ? '#FFD84D' : '#e8e8e8'} />
          <SvgTextNode x={12} y={16} textAnchor="middle" fontSize={12} fill={i <= level ? '#1a1a1a' : '#bbb'} fontWeight="bold">
            ¥
          </SvgTextNode>
        </Svg>
      ))}
    </View>
  )
}

const IconGoogle = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
)

function isTextBlockSectionTitle(content: string): boolean {
  const t = content.trim()
  if (!t) return false
  if (t.startsWith('【') || t.startsWith('■')) return true
  if (t.length <= 20) return true
  return false
}

function ArticleSpotCard({
  description,
  row,
  enrichment,
  onOpen,
  photoRecyclingKey,
}: {
  description: string
  row: SpotRow
  enrichment: PlaceCardEnrichment | undefined
  onOpen: () => void
  photoRecyclingKey: string
}) {
  const photoRef = enrichment?.photo_ref ?? null
  const photoUrl = spotPhotoUrl(photoRef, 320)
  const displayRating = enrichment?.rating ?? null
  const priceLevel = enrichment?.price_level ?? null
  const address =
    (enrichment?.formatted_address && enrichment.formatted_address.trim()) ||
    (enrichment?.vicinity && enrichment.vicinity.trim()) ||
    row.address ||
    '—'
  const showRatingRow = displayRating != null && displayRating > 0

  return (
    <View style={styles.spotCard}>
      <View style={styles.spotImgWrap}>
        {photoUrl ? (
          <ArticleRemoteImage uri={photoUrl} style={styles.spotImg} recyclingKey={photoRecyclingKey} priority="normal" />
        ) : null}
      </View>
      <View style={styles.spotBody}>
        <View style={styles.spotTop}>
          <View style={styles.catPill}>
            <Text style={styles.catPillTxt}>{row.category}</Text>
          </View>
          {showRatingRow ? (
            <View style={styles.rateMini}>
              <IconGoogle />
              <IconStarSm />
              <Text style={styles.rateMiniTxt}>{displayRating}</Text>
              <PriceLevel level={priceLevel} />
            </View>
          ) : null}
        </View>
        <Text style={styles.spotName}>{row.name}</Text>
        <Text style={styles.spotAddr}>{address}</Text>
        {description ? <Text style={styles.spotDesc}>{description}</Text> : null}
        <Pressable style={styles.spotCta} onPress={onOpen}>
          <Text style={styles.spotCtaTxt}>→ スポットを見る</Text>
        </Pressable>
      </View>
    </View>
  )
}

function BlockRenderer({
  block,
  spotRow,
  enrichment,
  onOpenSpot,
  blockIndex,
  articleId,
  blockImageRecyclingKey,
}: {
  block: Block
  spotRow: SpotRow | undefined
  enrichment: PlaceCardEnrichment | undefined
  onOpenSpot: (id: string) => void
  blockIndex: number
  articleId: string
  blockImageRecyclingKey?: string
}) {
  if (block.type === 'image') {
    return (
      <View style={styles.imgBlock}>
        <ArticleRemoteImage
          uri={block.url}
          style={styles.imgBlockImg}
          recyclingKey={blockImageRecyclingKey ?? `${articleId}-img-${block.url}`}
          priority="normal"
        />
        {block.caption ? <Text style={styles.imgCap}>{block.caption}</Text> : null}
      </View>
    )
  }
  if (block.type === 'spot') {
    if (!spotRow) return null
    return (
      <ArticleSpotCard
        description={block.description}
        row={spotRow}
        enrichment={enrichment}
        onOpen={() => onOpenSpot(spotRow.id)}
        photoRecyclingKey={`${articleId}-spot-${spotRow.place_id}`}
      />
    )
  }
  if (block.type === 'text') {
    const section = isTextBlockSectionTitle(block.content)
    if (section) {
      return (
        <Text style={[styles.sectionTitle, blockIndex > 0 && styles.sectionTitleMt]}>{block.content.trim()}</Text>
      )
    }
    return <Text style={styles.textBlock}>{block.content}</Text>
  }
  return null
}

export default function ArticleDetailScreen({ articleId }: { articleId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [spotRowsById, setSpotRowsById] = useState<Record<string, SpotRow>>({})
  const [enrichmentByPlaceId, setEnrichmentByPlaceId] = useState<Record<string, PlaceCardEnrichment>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const isUuid = /^[0-9a-f-]{36}$/i.test(articleId)
    const base = supabase
      .from('articles')
      .select(
        'id,title,slug,body,summary,keywords,blocks,spot_links,category,image_url,status'
      )
      .eq('status', 'published')
    const { data } = isUuid ? await base.eq('id', articleId).maybeSingle() : await base.eq('slug', articleId).maybeSingle()
    setArticle(data as Article | null)
    setLoading(false)
  }, [articleId])

  useEffect(() => {
    void load()
  }, [load])

  /** ヒーロー・本文画像を先にキャッシュ（スクロール前の表示を短縮） */
  useEffect(() => {
    if (!article) return
    const urls: string[] = []
    if (article.image_url?.trim()) urls.push(article.image_url.trim())
    for (const b of normalizeArticleBlocks(article.blocks)) {
      if (b.type === 'image' && typeof b.url === 'string' && b.url.trim()) urls.push(b.url.trim())
    }
    if (urls.length === 0) return
    void Image.prefetch(urls, 'memory-disk')
  }, [article])

  const blocks: Block[] = useMemo(() => {
    if (!article) return []
    let list: Block[]
    const normalized = normalizeArticleBlocks(article.blocks)
    if (normalized.length > 0) {
      list = normalized
    } else if (Array.isArray(article.blocks) && article.blocks.length > 0) {
      list = article.blocks as Block[]
    } else {
      list = [{ type: 'text' as const, content: article.body }]
    }
    return list.map((b) => {
      if (b.type !== 'spot') return b
      const sid = (b.spot_id || (b as unknown as { spotId?: string }).spotId || '').trim()
      return { ...b, spot_id: sid }
    })
  }, [article])

  const spotIds = useMemo(() => {
    const ids = new Set<string>()
    for (const b of blocks) {
      if (b.type === 'spot' && b.spot_id) ids.add(b.spot_id)
    }
    return [...ids]
  }, [blocks])

  const spotNameByKey = useMemo(() => {
    const m: Record<string, string> = {}
    for (const b of blocks) {
      if (b.type === 'spot' && b.spot_id) m[b.spot_id] = b.spot_name ?? ''
    }
    return m
  }, [blocks])

  const spotHydrateKey = useMemo(() => `${spotIds.join('\u001e')}\u001e${JSON.stringify(spotNameByKey)}`, [spotIds, spotNameByKey])

  useEffect(() => {
    if (spotIds.length === 0) {
      setSpotRowsById({})
      setEnrichmentByPlaceId({})
      return
    }
    let cancelled = false
    void (async () => {
      const uuidKeys = spotIds.filter((s) => isUuid(s))
      const placeKeys = spotIds.filter((s) => !isUuid(s) && s.trim().length > 0)

      const [byUuidRes, byPlaceRes] = await Promise.all([
        uuidKeys.length > 0
          ? supabase.from('spots').select('id, place_id, name, category, address').in('id', uuidKeys)
          : Promise.resolve({ data: [] as SpotRow[] }),
        placeKeys.length > 0
          ? supabase.from('spots').select('id, place_id, name, category, address').in('place_id', placeKeys)
          : Promise.resolve({ data: [] as SpotRow[] }),
      ])

      if (cancelled) return

      const merged = new Map<string, SpotRow>()
      for (const r of [...(byUuidRes.data ?? []), ...(byPlaceRes.data ?? [])]) {
        const row = r as SpotRow
        merged.set(row.id, row)
        if (row.place_id) merged.set(row.place_id, row)
      }

      const byBlockKey: Record<string, SpotRow> = {}
      for (const key of spotIds) {
        const row = merged.get(key)
        if (row) byBlockKey[key] = row
      }

      const missingPlaceIds = spotIds.filter((k) => !byBlockKey[k] && !isUuid(k))
      if (missingPlaceIds.length > 0) {
        const ensured = await Promise.all(
          missingPlaceIds.map((pid) => ensureSpotRowFromPlaceId(pid, spotNameByKey[pid] ?? ''))
        )
        if (cancelled) return
        for (let i = 0; i < missingPlaceIds.length; i++) {
          const row = ensured[i]
          const key = missingPlaceIds[i]
          if (row) {
            byBlockKey[key] = row
            byBlockKey[row.id] = row
            if (row.place_id) byBlockKey[row.place_id] = row
          }
        }
      }

      setSpotRowsById(byBlockKey)

      const placeIdsForEnrich = [
        ...new Set(
          Object.values(byBlockKey)
            .map((r) => r.place_id)
            .filter(Boolean)
        ),
      ] as string[]
      if (placeIdsForEnrich.length === 0) {
        setEnrichmentByPlaceId({})
        return
      }
      const json = (await wanspotFetchJson<{ details?: Record<string, PlaceCardEnrichment> }>(
        '/api/spots/batch-details',
        { method: 'POST', json: { place_ids: placeIdsForEnrich } }
      ).catch(() => ({}))) as { details?: Record<string, PlaceCardEnrichment> }
      if (!cancelled) setEnrichmentByPlaceId(json.details ?? {})
    })()
    return () => {
      cancelled = true
    }
  }, [spotHydrateKey])

  /** スポットカード用サムネを batch-details 取得後に先読み */
  useEffect(() => {
    const urls = Object.values(enrichmentByPlaceId)
      .map((e) => spotPhotoUrl(e.photo_ref ?? null, 320))
      .filter((u): u is string => !!u)
    if (urls.length === 0) return
    void Image.prefetch(urls, 'memory-disk')
  }, [enrichmentByPlaceId])

  const onOpenSpot = useCallback(
    (id: string) => {
      router.push(`/spots/${id}?from=article`)
    },
    [router]
  )

  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 32

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.backRow, { paddingTop: Math.max(16, insets.top) }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <IconChevron />
            <Text style={styles.backTxt}>戻る</Text>
          </Pressable>
        </View>
        <RunningDog label="読み込み中..." />
      </View>
    )
  }

  if (!article) {
    return (
      <View style={styles.root}>
        <View style={[styles.backRow, { paddingTop: Math.max(16, insets.top) }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <IconChevron />
            <Text style={styles.backTxt}>戻る</Text>
          </Pressable>
        </View>
        <Text style={styles.empty}>記事が見つかりません</Text>
      </View>
    )
  }

  return (
    <View style={styles.rootWhite}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={[styles.backRow, { paddingTop: Math.max(16, insets.top) }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <IconChevron />
            <Text style={styles.backTxt}>戻る</Text>
          </Pressable>
        </View>
        {article.image_url ? (
          <ArticleRemoteImage
            uri={article.image_url}
            style={styles.hero}
            recyclingKey={`${article.id}-hero`}
            priority="high"
          />
        ) : null}
        <View style={styles.pad}>
          <Text style={styles.title}>{article.title}</Text>
          {article.keywords?.length > 0 ? (
            <View style={styles.kwBox}>
              {article.keywords.map((k) => (
                <Text key={k} style={styles.kwTag}>
                  #{k}
                </Text>
              ))}
            </View>
          ) : null}
          <View>
            {blocks.map((block, i) => {
              if (block.type === 'spot') {
                const row = spotRowsById[block.spot_id]
                const en = row ? enrichmentByPlaceId[row.place_id] : undefined
                return (
                  <BlockRenderer
                    key={`${block.spot_id}-${i}`}
                    block={block}
                    spotRow={row}
                    enrichment={en}
                    onOpenSpot={onOpenSpot}
                    blockIndex={i}
                    articleId={article.id}
                    blockImageRecyclingKey={undefined}
                  />
                )
              }
              return (
                <BlockRenderer
                  key={i}
                  block={block}
                  spotRow={undefined}
                  enrichment={undefined}
                  onOpenSpot={onOpenSpot}
                  blockIndex={i}
                  articleId={article.id}
                  blockImageRecyclingKey={block.type === 'image' ? `${article.id}-block-${i}` : undefined}
                />
              )
            })}
          </View>
          {article.spot_links && article.spot_links.length > 0 ? (
            <View style={styles.related}>
              <Text style={styles.relatedTitle}>関連スポット</Text>
              {article.spot_links.map((sl, i) => (
                <View key={i} style={styles.relatedCard}>
                  <Text style={styles.relatedName}>{sl.spot_name}</Text>
                  <Text style={styles.relatedDesc}>{sl.description}</Text>
                  {sl.spot_id ? (
                    <Pressable style={styles.relatedBtn} onPress={() => onOpenSpot(sl.spot_id!)}>
                      <Text style={styles.relatedBtnTxt}>→ スポットを見る</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.relatedNone}>スポット情報なし</Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  rootWhite: { flex: 1, backgroundColor: '#fff' },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  backRow: { paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backTxt: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  hero: { width: '100%', aspectRatio: 16 / 9 },
  pad: { paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 8, lineHeight: 30 },
  kwBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFF9E0',
    borderWidth: 1,
    borderColor: '#e8c84a',
  },
  kwTag: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 8 },
  sectionTitleMt: { marginTop: 24 },
  textBlock: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 20 },
  imgBlock: { marginVertical: 24 },
  imgBlockImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  imgCap: { fontSize: 12, textAlign: 'center', color: '#aaa', marginTop: 8 },
  spotCard: {
    marginVertical: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  spotImgWrap: { width: '100%', height: 144, backgroundColor: '#e8e4de' },
  spotImg: { width: '100%', height: '100%' },
  spotBody: { padding: 12, gap: 4 },
  spotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPill: { backgroundColor: '#FFF9E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  catPillTxt: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  rateMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateMiniTxt: { fontSize: 12, color: '#888' },
  spotName: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  spotAddr: { fontSize: 12, color: '#aaa' },
  spotDesc: { fontSize: 12, color: '#666', lineHeight: 18, marginTop: 8 },
  spotCta: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
  },
  spotCtaTxt: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  related: { marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#eee' },
  relatedTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  relatedCard: { borderRadius: 12, padding: 16, backgroundColor: '#f9f9f9', marginBottom: 12 },
  relatedName: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  relatedDesc: { fontSize: 12, color: '#888', marginBottom: 12 },
  relatedBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFD84D',
  },
  relatedBtnTxt: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  relatedNone: { fontSize: 12, color: '#bbb' },
  plQ: { fontSize: 12, color: '#ccc' },
})
