import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle, Path, Polygon, Text as SvgTextNode } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArticleRemoteImage } from '@/components/articles/ArticleRemoteImage'
import { AppHeader } from '@/components/AppHeader'
import { RunningDog } from '@/components/DogStates'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { resizePlacesImageUrl } from '@/lib/images/placesImage'
import { remoteImageAcceptHeaders } from '@/lib/images/remoteImageDefaults'
import { openSpotDetailFromPlace } from '@/lib/open-spot-detail'
import { fetchSpotsByIds } from '@/lib/fetch-spots-by-ids'
import { spotPhotoUrl, wanspotFetch, wanspotFetchJson, wanspotPublicUrl } from '@/lib/wanspot-api'
import { CACHE_TTL, fetchWithCache, readCache } from '@/lib/client-cache'
import type { PlaceCardEnrichment } from '@/lib/user-spot-list-utils'
import type { PlaceResult } from '@/types/places'

type Block =
  | { type: 'text'; content: string }
  | { type: 'heading'; content: string }
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

async function ensureSpotRowFromPlaceId(placeId: string): Promise<SpotRow | null> {
  // クライアントから spots へ直接 upsert していた。書き込み権限をクライアントに
  // 残すと、判定列（$0.02/件で生成）を第三者に上書きされうる。
  // サーバーへはplace_idだけ渡し、Google検証済みの値だけを保存する。
  const ensureRes = await wanspotFetch('/api/spots/ensure', {
    method: 'POST',
    json: { place_id: placeId },
  })
  if (!ensureRes.ok) return null
  try {
    const ensured = (await ensureRes.json()) as { spot?: Partial<SpotRow> }
    const row = ensured.spot
    if (
      !row ||
      typeof row.id !== 'string' ||
      typeof row.place_id !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.category !== 'string'
    ) {
      return null
    }
    return {
      id: row.id,
      place_id: row.place_id,
      name: row.name,
      category: row.category,
      address: typeof row.address === 'string' ? row.address : null,
    }
  } catch {
    return null
  }
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
    // 見出しは見出しとして出す。イベントまとめ記事はイベント名が見出しになり、
    // ここを落とすとどのイベントの話か分からなくなる
    if (typeRaw === 'heading') {
      const content =
        (typeof o.content === 'string' && o.content) || (typeof o.text === 'string' && o.text) || ''
      if (content) out.push({ type: 'heading', content })
      continue
    }
    // paragraph は保存形式が text と同じ。サーバ側の記事は両方を使う
    if (typeRaw === 'text' || typeRaw === 'paragraph') {
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

const IconShare = () => {
  const { colors } = useAppTheme()
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round">
      <Circle cx={18} cy={5} r={3} />
      <Circle cx={6} cy={12} r={3} />
      <Circle cx={18} cy={19} r={3} />
      <Path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" />
    </Svg>
  )
}

const IconX = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
    <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </Svg>
)

const IconCopy = () => {
  const { colors } = useAppTheme()
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round">
      <Path d="M9 9h10v10H9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </Svg>
  )
}

const IconStarSm = () => {
  const { colors } = useAppTheme()
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill={colors.primary} stroke={colors.primary} strokeWidth={1.5}>
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Svg>
  )
}

function PriceLevel({ level }: { level: number | null }) {
  const { colors } = useAppTheme()
  const styles = useThemedStyles(createStyles)

  if (level === null || level === undefined) {
    return <Text style={styles.plQ}>?</Text>
  }
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4].map((i) => (
        <Svg key={i} width={10} height={10} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill={i <= level ? colors.primary : colors.surfaceAlt} />
          <SvgTextNode x={12} y={16} textAnchor="middle" fontSize={12} fill={i <= level ? colors.textPrimary : colors.textMeta} fontWeight="bold">
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

const ArticleSpotCard = memo(function ArticleSpotCard({
  row,
  enrichment,
  onOpen,
  photoRecyclingKey,
}: {
  row: SpotRow
  enrichment: PlaceCardEnrichment | undefined
  onOpen: () => void
  photoRecyclingKey: string
}) {
  const styles = useThemedStyles(createStyles)
  const photoRef = enrichment?.photo_ref ?? null
  const photoUrl = spotPhotoUrl(photoRef)
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
        <Pressable style={styles.spotCta} onPress={onOpen}>
          <Text style={styles.spotCtaTxt}>→ スポットを見る</Text>
        </Pressable>
      </View>
    </View>
  )
})

const BlockRenderer = memo(function BlockRenderer({
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
  onOpenSpot: (row: SpotRow) => void
  blockIndex: number
  articleId: string
  blockImageRecyclingKey?: string
}) {
  const styles = useThemedStyles(createStyles)

  if (block.type === 'image') {
    return (
      <View style={styles.imgBlock}>
        <ArticleRemoteImage
          uri={resizePlacesImageUrl(block.url, 'card')}
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
        row={spotRow}
        enrichment={enrichment}
        onOpen={() => onOpenSpot(spotRow)}
        photoRecyclingKey={`${articleId}-spot-${spotRow.place_id}`}
      />
    )
  }
  if (block.type === 'heading') {
    // 【1】施設名 のような「項目の見出し」と、その上の節見出しを見分ける。
    // イベントまとめ記事はイベント名→「○○の前後に寄るなら」→施設名 の
    // 3階層になり、全部同じ大きさだと構造が読めない
    const isItem = block.content.trimStart().startsWith('【')
    return (
      <Text
        style={[
          isItem ? styles.itemTitle : styles.sectionTitle,
          blockIndex > 0 && (isItem ? styles.itemTitleMt : styles.sectionTitleMt),
        ]}
      >
        {block.content.trim()}
      </Text>
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
})

export default function ArticleDetailScreen({ articleId }: { articleId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const styles = useThemedStyles(createStyles)
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [spotRowsById, setSpotRowsById] = useState<Record<string, SpotRow>>({})
  const [enrichmentByPlaceId, setEnrichmentByPlaceId] = useState<Record<string, PlaceCardEnrichment>>({})

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const cacheKey = `articleDetail:${articleId}`
      const cached = !opts?.force ? readCache<Article | null>(cacheKey) : undefined
      setLoadError(null)
      // キャッシュがあれば即表示し、裏で最新化（記事の再訪問時に白画面/再読み込み待ちを防ぐ）
      if (cached !== undefined) {
        setArticle(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }
      try {
        const { data } = await fetchWithCache(
          cacheKey,
          CACHE_TTL.ARTICLE_DETAIL_MS,
          async () => {
            // articles を直読みしていた。anon キーはバンドルに平文で入っており
            // 実質公開情報なので、記事本文110件が全件取得できる状態だった。
            // サーバ経由にして articles のクライアント権限を剥がせるようにする
            const res = await wanspotFetch(
              `/api/articles/${encodeURIComponent(articleId)}`,
              { auth: false }
            )
            if (res.status === 404) return null
            if (!res.ok) throw new Error(`article detail failed with status ${res.status}`)
            const json = (await res.json()) as { article?: unknown }
            if (!json.article || typeof json.article !== 'object') {
              throw new Error('article detail returned an invalid payload')
            }
            return json.article as Article
          },
          { force: opts?.force }
        )
        setArticle(data)
      } catch (error) {
        console.warn('[ArticleDetailScreen] article load failed', error)
        if (cached === undefined) {
          setLoadError('記事を読み込めませんでした。通信環境を確認して再試行してください。')
        }
      } finally {
        setLoading(false)
      }
    },
    [articleId]
  )

  useEffect(() => {
    void load()
  }, [load])

  /** ヒーロー画像のみ先にキャッシュ（スクロール前の表示を短縮）。本文中の画像は実際に表示される
   *  幅に合わせた 'card' サイズで十分なため、hero(1600px) では先読みしない（帯域節約）。 */
  useEffect(() => {
    if (!article?.image_url?.trim()) return
    void Image.prefetch([resizePlacesImageUrl(article.image_url.trim(), 'hero')], {
      cachePolicy: 'memory-disk',
      headers: remoteImageAcceptHeaders,
    })
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

      // spots はサーバ経由で引く（anon キーでの直読みを塞ぐため）
      let rows: Record<string, unknown>[]
      try {
        rows = await fetchSpotsByIds({
          ids: uuidKeys,
          placeIds: placeKeys,
          columns: 'card',
        })
      } catch (error) {
        console.warn('[ArticleDetailScreen] spot hydration failed', error)
        return
      }

      if (cancelled) return

      const merged = new Map<string, SpotRow>()
      for (const r of rows) {
        const row = r as unknown as SpotRow
        merged.set(row.id, row)
        if (row.place_id) merged.set(row.place_id, row)
      }

      const byBlockKey: Record<string, SpotRow> = {}
      for (const key of spotIds) {
        const row = merged.get(key)
        if (row) byBlockKey[key] = row
      }

      // 既に DB に存在するスポットは、未登録スポットの ensure（外部API+upsert）を待たずに即表示。
      // 以前は1件でも未登録スポットがあると全カードの表示が ensure 完了まで止まっていた。
      setSpotRowsById(byBlockKey)

      const knownPlaceIds = [
        ...new Set(
          Object.values(byBlockKey)
            .map((r) => r.place_id)
            .filter(Boolean)
        ),
      ] as string[]
      const enrichKnownPromise =
        knownPlaceIds.length > 0
          ? (wanspotFetchJson<{ details?: Record<string, PlaceCardEnrichment> }>('/api/spots/batch-details', {
              method: 'POST',
              json: { place_ids: knownPlaceIds },
            }).catch(() => ({}) as { details?: Record<string, PlaceCardEnrichment> }))
          : Promise.resolve({} as { details?: Record<string, PlaceCardEnrichment> })

      // 未登録スポットの ensure は既知スポットの写真取得と並列に進める（直列待ちをなくす）
      const missingPlaceIds = spotIds.filter((k) => !byBlockKey[k] && !isUuid(k))
      const ensuredRows =
        missingPlaceIds.length > 0
          ? await Promise.all(missingPlaceIds.map((pid) => ensureSpotRowFromPlaceId(pid)))
          : []

      if (cancelled) return

      if (missingPlaceIds.length > 0) {
        const patch: Record<string, SpotRow> = {}
        for (let i = 0; i < missingPlaceIds.length; i++) {
          const row = ensuredRows[i]
          const key = missingPlaceIds[i]
          if (row) {
            patch[key] = row
            patch[row.id] = row
            if (row.place_id) patch[row.place_id] = row
          }
        }
        if (Object.keys(patch).length > 0) {
          setSpotRowsById((prev) => ({ ...prev, ...patch }))
        }
      }

      const enrichKnown = await enrichKnownPromise
      if (cancelled) return
      setEnrichmentByPlaceId(enrichKnown.details ?? {})

      const newlyKnownPlaceIds = [
        ...new Set(ensuredRows.filter((r): r is SpotRow => !!r).map((r) => r.place_id).filter(Boolean)),
      ] as string[]
      if (newlyKnownPlaceIds.length > 0) {
        const json2 = (await wanspotFetchJson<{ details?: Record<string, PlaceCardEnrichment> }>(
          '/api/spots/batch-details',
          { method: 'POST', json: { place_ids: newlyKnownPlaceIds } }
        ).catch(() => ({}))) as { details?: Record<string, PlaceCardEnrichment> }
        if (!cancelled) setEnrichmentByPlaceId((prev) => ({ ...prev, ...(json2.details ?? {}) }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [spotHydrateKey, spotIds])

  /** スポットカード用サムネを batch-details 取得後に先読み */
  useEffect(() => {
    const urls = Object.values(enrichmentByPlaceId)
      .map((e) => spotPhotoUrl(e.photo_ref ?? null))
      .filter((u): u is string => !!u)
    if (urls.length === 0) return
    // 描画側（ArticleRemoteImage）と同じヘッダで先読みする。Android の Glide は
    // ヘッダ込みでキャッシュキーが決まるため、ここが素のままだと先読みが空振りする
    void Image.prefetch(urls, { cachePolicy: 'memory-disk', headers: remoteImageAcceptHeaders })
  }, [enrichmentByPlaceId])

  const onOpenSpot = useCallback(
    (row: SpotRow) => {
      const place: PlaceResult = {
        place_id: row.place_id,
        name: row.name,
        category: row.category,
        address: row.address ?? '',
        lat: 0,
        lng: 0,
        photo_ref: null,
        rating: null,
        price_level: null,
        price_label: null,
        user_ratings_total: null,
      }
      openSpotDetailFromPlace(router, place, row.id)
    },
    [router]
  )

  const shareArticle = useCallback(
    async (platform: string) => {
      if (!article) return
      const url = wanspotPublicUrl(`/articles/${article.slug}`)
      const text = `${article.title}｜ワンちゃんと行けるスポットまとめ🐾 #wanspot`
      if (platform === 'x') {
        const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
        await Linking.openURL(u)
      } else if (platform === 'line') {
        await Linking.openURL(`https://line.me/R/msg/text/?${encodeURIComponent(`${text}\n${url}`)}`)
      } else if (platform === 'copy') {
        await Share.share({ message: `${text}\n${url}` })
      }
      setShowShareSheet(false)
    },
    [article]
  )

  const bottomPad = insets.bottom + 32

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" onBack={() => router.back()} />
        <View style={styles.loadingBody}>
          <RunningDog label="読み込み中..." />
        </View>
      </View>
    )
  }

  if (loadError && !article) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" onBack={() => router.back()} />
        <View style={styles.errorBody}>
          <Text style={styles.empty}>{loadError}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void load({ force: true })}
            accessibilityRole="button"
            accessibilityLabel="記事を再読み込み"
          >
            <Text style={styles.retryButtonText}>再試行</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  if (!article) {
    return (
      <View style={styles.root}>
        <AppHeader variant="back" onBack={() => router.back()} />
        <Text style={styles.empty}>記事が見つかりません</Text>
      </View>
    )
  }

  return (
    <View style={styles.rootWhite}>
      <AppHeader
        variant="back"
        onBack={() => router.back()}
        rightSlot={
          <Pressable
            style={styles.shareBtn}
            onPress={() => setShowShareSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="記事をシェア"
          >
            <IconShare />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {article.image_url ? (
          <ArticleRemoteImage
            // .trim() は先読み（396行）と URL を一致させるため必須。前後空白があると
            // render URL が壊れる上、先読みキャッシュにも当たらない
            uri={resizePlacesImageUrl(article.image_url.trim(), 'hero')}
            style={styles.hero}
            recyclingKey={`${article.id}-hero`}
            priority="high"
          />
        ) : null}
        <View style={styles.pad}>
          <View style={styles.articleIntro}>
            <Text style={styles.articleKicker}>WANSPOT ARTICLE</Text>
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
          </View>
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
                    <Pressable
                      style={styles.relatedBtn}
                      onPress={() => {
                        const row = spotRowsById[sl.spot_id!]
                        if (row) onOpenSpot(row)
                      }}
                    >
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

      <Modal visible={showShareSheet} transparent animationType="fade" onRequestClose={() => setShowShareSheet(false)}>
        <Pressable style={styles.shareOverlay} onPress={() => setShowShareSheet(false)}>
          <Pressable style={styles.shareBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.shareTitle}>シェアする</Text>
            <View style={styles.shareGrid}>
              <Pressable style={styles.shareX} onPress={() => void shareArticle('x')}>
                <IconX />
                <Text style={styles.shareLblW}>X</Text>
              </Pressable>
              <Pressable style={styles.shareLine} onPress={() => void shareArticle('line')}>
                <Text style={styles.shareLblW}>LINE</Text>
              </Pressable>
              <Pressable style={styles.shareCopy} onPress={() => void shareArticle('copy')}>
                <IconCopy />
                <Text style={styles.shareLbl}>コピー</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  rootWhite: { flex: 1, backgroundColor: colors.paper },
  loadingBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 40, ...type.body, color: colors.textMuted },
  errorBody: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  retryButtonText: { ...type.button, color: colors.onPrimary },
  shareBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { width: '100%', aspectRatio: 16 / 9 },
  pad: { paddingHorizontal: 20 },
  articleIntro: {
    paddingVertical: 20,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  articleKicker: {
    ...type.label,
    color: colors.primary,
    marginBottom: 8,
  },
  title: { ...type.title, color: colors.textPrimary },
  kwBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  kwTag: {
    ...type.label,
    color: colors.primary,
    backgroundColor: colors.tintWeak,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.tintStrong,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  sectionTitle: { ...type.heading, color: colors.textPrimary, marginBottom: 10 },
  sectionTitleMt: { marginTop: 24 },
  // 節見出し(20) と本文(16) の間の3階層目。サイズは行と同じ17まで落とし、
  // 見出しであることは heading と同じ太さ(800)で出す
  itemTitle: { ...type.heading, fontSize: 17, lineHeight: 23, color: colors.textPrimary, marginBottom: 8 },
  itemTitleMt: { marginTop: 16 },
  textBlock: { ...type.body, color: colors.textPrimary, marginBottom: 20 },
  imgBlock: { marginVertical: 24 },
  imgBlockImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  imgCap: { ...type.caption, textAlign: 'center', color: colors.textMuted, marginTop: 8 },
  spotCard: {
    marginVertical: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spotImgWrap: { width: '100%', height: 144, backgroundColor: colors.mapMuted },
  spotImg: { width: '100%', height: '100%' },
  spotBody: { padding: 12, gap: 4 },
  spotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPill: { backgroundColor: colors.tintWeak, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  catPillTxt: { ...type.label, color: colors.primary },
  rateMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // 評価値。11pxの星と10pxの料金マークに挟まれるので label のまま上げない
  rateMiniTxt: { ...type.label, color: colors.textSecondary },
  spotName: { ...type.row, fontWeight: '700' as const, color: colors.textPrimary },
  spotAddr: { ...type.caption, color: colors.textMuted },
  spotCta: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  spotCtaTxt: { ...type.button, color: colors.onPrimary },
  related: { marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  relatedTitle: { ...type.heading, color: colors.textPrimary, marginBottom: 16 },
  relatedCard: { borderRadius: 12, padding: 16, backgroundColor: colors.surfaceTertiary, marginBottom: 12 },
  relatedName: { ...type.row, fontWeight: '700' as const, color: colors.textPrimary, marginBottom: 4 },
  relatedDesc: { ...type.caption, color: colors.textSecondary, marginBottom: 12 },
  relatedBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  relatedBtnTxt: { ...type.button, color: colors.onPrimary },
  relatedNone: { ...type.caption, color: colors.textMeta },
  // 料金不明の「?」。隣の ¥ マークが10pxの円なので label で揃える
  plQ: { ...type.label, color: colors.textDisabled },
  shareOverlay: { flex: 1, backgroundColor: colors.overlayScrim, justifyContent: 'center', padding: 20 },
  shareBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 24,
    padding: 24,
    maxWidth: 340,
    alignSelf: 'center',
    width: '100%',
  },
  // 灰色・字間広めのマイクロラベルとして置かれている見出し。title(26) ではなく label
  shareTitle: { ...type.label, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
  shareGrid: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  shareX: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#000' },
  shareLine: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#06C755' },
  shareCopy: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.surfaceAlt },
  shareLbl: { ...type.label, color: colors.textPrimary },
  shareLblW: { ...type.label, color: '#fff' },
})
