export type ArticleScoringContext = {
  userPrefecture?: string | null
  userMunicipality?: string | null
  userId?: string | null
  likedArticleIds?: string[]
  readArticleIds?: string[]
}

export type ArticleLike = {
  id: string
  title: string | null
  theme: string | null
  category: string | null
  summary: string | null
  keywords: string[] | null
  published_at: string | null
}

export function buildArticleSearchText(article: Pick<ArticleLike, 'title' | 'theme' | 'category' | 'summary' | 'keywords'>): string {
  return [article.title, article.theme, article.category, article.summary, ...(article.keywords || [])]
    .filter(Boolean)
    .join(' ')
}

/** 都道府県・市区町村のテキスト一致（位置情報のフォールバック） */
export function scoreArticleRegion(searchText: string, ctx: Pick<ArticleScoringContext, 'userPrefecture' | 'userMunicipality'>): number {
  let score = 0
  if (ctx.userPrefecture) {
    if (searchText.includes(ctx.userPrefecture)) score += 45
    const shortPref = ctx.userPrefecture.replace(/[都道府県]$/, '')
    if (shortPref && searchText.includes(shortPref)) score += 20
  }
  if (ctx.userMunicipality && searchText.includes(ctx.userMunicipality)) score += 50
  return score
}

/** 季節キーワード一致 */
export function scoreArticleSeason(searchText: string, nowMs = Date.now()): number {
  const month = new Date(nowMs).getMonth() + 1
  const currentSeason = getSeason(month)

  const seasonKeywords: Record<string, string[]> = {
    spring: ['春', '桜', 'お花見', '新緑', '入学'],
    summer: ['夏', '海', 'ビーチ', '浴衣', '花火', '盆', '海水浴'],
    autumn: ['秋', '紅葉', '秋祭り', 'ハロウィン', '読書'],
    winter: ['冬', 'クリスマス', 'イルミネーション', '年越し', '雪', '温泉'],
  }

  let score = 0
  const matchingSeasonWords = seasonKeywords[currentSeason].filter((w) => searchText.includes(w))
  if (matchingSeasonWords.length > 0) {
    score += 25 + Math.min(matchingSeasonWords.length * 5, 15)
  }
  for (const [season, words] of Object.entries(seasonKeywords)) {
    if (season === currentSeason) continue
    if (words.some((w) => searchText.includes(w))) {
      score -= 10
      break
    }
  }
  return score
}

/** 新着ブースト */
export function scoreArticleFreshness(publishedAt: string | null | undefined, nowMs = Date.now()): number {
  if (!publishedAt) return 0
  const daysOld = (nowMs - new Date(publishedAt).getTime()) / 86_400_000
  if (daysOld < 7) return 10
  if (daysOld < 30) return 5
  return 0
}

function getSeason(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}
