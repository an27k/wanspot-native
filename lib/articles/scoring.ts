export type ArticleScoringContext = {
  userPrefecture?: string | null
  userMunicipality?: string | null

  /** 将来：ログインユーザーID */
  userId?: string | null
  /** 将来：記事へのいいね済み ID（優先度アップ） */
  likedArticleIds?: string[]
  /** 直近で一覧から開いた記事など（重複表示をやや抑える） */
  readArticleIds?: string[]
}

export type ArticleLike = {
  id: string
  title: string | null
  keywords: string[] | null
  theme: string | null
  category: string | null
  summary: string | null
  published_at: string | null
}

/**
 * 記事の表示優先度スコア（高いほど上位）
 */
export function scoreArticle(article: ArticleLike, ctx: ArticleScoringContext): number {
  let score = 50

  const searchText = [
    article.title,
    article.theme,
    article.category,
    article.summary,
    ...(article.keywords || []),
  ]
    .filter(Boolean)
    .join(' ')

  // === A-3: 地域マッチ ===
  if (ctx.userPrefecture) {
    if (searchText.includes(ctx.userPrefecture)) {
      score += 30
    }
    const shortPref = ctx.userPrefecture.replace(/[都道府県]$/, '')
    if (shortPref && searchText.includes(shortPref)) {
      score += 15
    }
  }

  if (ctx.userMunicipality && searchText.includes(ctx.userMunicipality)) {
    score += 20
  }

  // === A-4: 季節マッチ ===
  const month = new Date().getMonth() + 1
  const currentSeason = getSeason(month)

  const seasonKeywords: Record<string, string[]> = {
    spring: ['春', '桜', 'お花見', '新緑', '入学'],
    summer: ['夏', '海', 'ビーチ', '浴衣', '花火', '盆'],
    autumn: ['秋', '紅葉', '秋祭り', 'ハロウィン', '読書'],
    winter: ['冬', 'クリスマス', 'イルミネーション', '年越し', '雪', '温泉'],
  }

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

  // === A-5: ユーザー行動（骨組み） ===
  if (ctx.likedArticleIds?.includes(article.id)) {
    score += 30
  }
  if (ctx.readArticleIds?.includes(article.id)) {
    score -= 15
  }

  // === 新着ブースト ===
  if (article.published_at) {
    const daysOld = (Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysOld < 7) score += 10
    else if (daysOld < 30) score += 5
  }

  return score
}

function getSeason(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function sortArticlesByScore<T extends ArticleLike>(articles: T[], ctx: ArticleScoringContext): T[] {
  return [...articles]
    .map((article) => ({ article, score: scoreArticle(article, ctx) }))
    .sort((a, b) => b.score - a.score)
    .map(({ article }) => article)
}
