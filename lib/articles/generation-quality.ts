export type ArticleGenerationSegment = {
  prefecture?: string | null
  municipality?: string | null
  walkAreaTag?: string | null
  dogSizeTag?: string | null
  topicTag: string
}

export type ArticleGenerationSpot = {
  name: string
  placeId: string
  prefecture?: string | null
  municipality?: string | null
  sourceConfidence?: number | null
  facts?: string[]
}

export type ArticleGenerationMaterialPack = {
  segment: ArticleGenerationSegment
  spots: ArticleGenerationSpot[]
  sourceCount: number
  officialSourceCount: number
}

export type GeneratedArticleDraft = {
  title: string
  summary: string
  body: string
  keywords: string[]
  target_prefectures?: string[]
  target_municipalities?: string[]
  target_walk_area_tags?: string[]
  dog_size_tags?: string[]
  topic_tags?: string[]
  blocks?: unknown
}

export type QualityGateIssue = {
  key: string
  severity: 'blocker' | 'warning'
  message: string
}

export type ArticleQualityReport = {
  score: number
  publishable: boolean
  needsReview: boolean
  issues: QualityGateIssue[]
  checks: Record<string, boolean>
}

const OVERCLAIM_PATTERNS = [
  /絶対/,
  /必ず(入れる|利用できる|同伴できる|OK)/,
  /全犬種OK/,
  /公式確認済み/,
  /完全対応/,
]

const OWNER_PERSPECTIVE_PATTERNS = [
  /飼い主/,
  /来店前/,
  /公式/,
  /確認/,
  /リード/,
  /水分/,
  /休憩/,
  /足元/,
  /お腹/,
  /無理/,
]

function normalize(s: string | null | undefined): string {
  return (s ?? '').replace(/\s/g, '').trim()
}

function includesAny(haystack: string, needles: Array<string | null | undefined>): boolean {
  const h = normalize(haystack)
  return needles.some((n) => {
    const v = normalize(n)
    return !!v && h.includes(v)
  })
}

function uniqueStrings(values: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values ?? []) {
    const v = value.trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function addIssue(issues: QualityGateIssue[], severity: QualityGateIssue['severity'], key: string, message: string) {
  issues.push({ key, severity, message })
}

export function evaluateGeneratedArticleQuality(
  draft: GeneratedArticleDraft,
  material: ArticleGenerationMaterialPack
): ArticleQualityReport {
  const issues: QualityGateIssue[] = []
  const fullText = [draft.title, draft.summary, draft.body, ...(draft.keywords ?? [])].join('\n')
  const targetText = [
    ...(draft.target_prefectures ?? []),
    ...(draft.target_municipalities ?? []),
    ...(draft.target_walk_area_tags ?? []),
    ...(draft.topic_tags ?? []),
  ].join('\n')

  const titleOk = draft.title.trim().length >= 16 && draft.title.trim().length <= 44
  const summaryOk = draft.summary.trim().length >= 40 && draft.summary.trim().length <= 140
  const bodyOk = draft.body.trim().length >= 500
  const keywordOk = uniqueStrings(draft.keywords).length >= 4
  const segment = material.segment
  const areaOk = includesAny(fullText + targetText, [segment.municipality, segment.walkAreaTag, segment.prefecture])
  const topicOk = includesAny(fullText + targetText, [segment.topicTag])
  const dogSizeOk = !segment.dogSizeTag || includesAny(fullText + targetText, [segment.dogSizeTag])
  const spots = material.spots
  const validSpots = spots.filter((spot) => spot.placeId && !spot.placeId.startsWith('__FILL_'))
  const spotCountOk = validSpots.length >= 3
  const spotAreaOk =
    validSpots.length === 0 ||
    validSpots.every((spot) => {
      if (segment.municipality && spot.municipality) return normalize(spot.municipality) === normalize(segment.municipality)
      if (segment.prefecture && spot.prefecture) return normalize(spot.prefecture) === normalize(segment.prefecture)
      return true
    })
  const sourcesOk = material.sourceCount >= validSpots.length && material.officialSourceCount >= Math.min(2, validSpots.length)
  const overclaimOk = !OVERCLAIM_PATTERNS.some((pattern) => pattern.test(fullText))
  const ownerPerspectiveOk = OWNER_PERSPECTIVE_PATTERNS.filter((pattern) => pattern.test(fullText)).length >= 3
  const safetyOk = /同伴条件|公式|ワクチン|リード|水分|休憩|暑|雨|足|路面|アスファルト/.test(fullText)

  if (!titleOk) addIssue(issues, 'warning', 'title_length', 'タイトルは16〜44文字に収めてください。')
  if (!summaryOk) addIssue(issues, 'warning', 'summary_length', 'summaryは40〜140文字に収めてください。')
  if (!bodyOk) addIssue(issues, 'blocker', 'body_length', '本文が短すぎます。最低500文字を目安にしてください。')
  if (!keywordOk) addIssue(issues, 'warning', 'keywords', 'keywordsは地域・犬サイズ・テーマを含めて4件以上必要です。')
  if (!areaOk) addIssue(issues, 'blocker', 'area_match', '記事本文またはセグメント列に対象エリアが含まれていません。')
  if (!topicOk) addIssue(issues, 'blocker', 'topic_match', '記事本文またはセグメント列に対象テーマが含まれていません。')
  if (!dogSizeOk) addIssue(issues, 'warning', 'dog_size_match', '犬サイズ対象の記事なのにサイズ文脈が弱いです。')
  if (!spotCountOk) addIssue(issues, 'blocker', 'spot_count', '実在place_id付きスポットが3件未満です。')
  if (!spotAreaOk) addIssue(issues, 'blocker', 'spot_area', '記事内スポットが対象エリアから外れています。')
  if (!sourcesOk) addIssue(issues, 'warning', 'sources', 'スポット数に対して根拠ソースが不足しています。')
  if (!overclaimOk) addIssue(issues, 'blocker', 'overclaim', '犬同伴条件や対応範囲を断定しすぎています。')
  if (!ownerPerspectiveOk) addIssue(issues, 'warning', 'owner_perspective', '飼い主が何を確認/判断するかの文脈が不足しています。')
  if (!safetyOk) addIssue(issues, 'warning', 'safety_note', '同伴条件・天候・路面・安全注意のいずれかを自然に入れてください。')

  const checks = {
    titleOk,
    summaryOk,
    bodyOk,
    keywordOk,
    areaOk,
    topicOk,
    dogSizeOk,
    spotCountOk,
    spotAreaOk,
    sourcesOk,
    overclaimOk,
    ownerPerspectiveOk,
    safetyOk,
  }

  const score = Math.max(
    0,
    100 -
      issues.reduce((sum, issue) => {
        return sum + (issue.severity === 'blocker' ? 18 : 7)
      }, 0)
  )
  const hasBlocker = issues.some((issue) => issue.severity === 'blocker')

  return {
    score,
    publishable: score >= 80 && !hasBlocker,
    needsReview: score < 90 || hasBlocker,
    issues,
    checks,
  }
}
