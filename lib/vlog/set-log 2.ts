/**
 * Set log — メディア1件ごとの「実況ログ」的な補助メタデータ。
 * 単純な qualityScore だけでは拾えない「動き・構図・感情」の観点を加え、
 * カット選定とピーク/導入文言の判断材料にする。
 */
/** どの経路でこのSet logが算出されたか（観測性用） */
export type MediaAnalysisSource = 'cloud_image' | 'cv_hybrid' | 'heuristic'

export type MediaSetLog = {
  motionScore: number
  blurScore: number
  brightnessScore: number
  cropFitScore: number
  emotionScore: number
  /** qualityScore + Set log補正の総合順位スコア。カット選定/ピーク判定に使用 */
  rankScore: number
  /** 動画のみ: 冒頭の構えブレ/迷いを避けて使い始める位置（素材尺に対する割合 0-1） */
  trimStartRatio: number | null
  /** 犬または人が視認できるか。クラウド解析が入るまではnull(未判定) */
  subjectDetected: boolean | null
  analysisSource: MediaAnalysisSource
}

/**
 * qualityScore + Set logの補助指標から総合順位スコアを算出。
 * 被写体不在(subjectDetected===false)が確定している場合は強めにペナルティを掛ける。
 */
export function computeRankScore(input: {
  qualityScore: number
  motionScore: number
  emotionScore: number
  cropFitScore: number
  subjectDetected?: boolean | null
}): number {
  const base = clamp01(
    input.qualityScore * 0.55 + input.emotionScore * 0.25 + input.motionScore * 0.12 + input.cropFitScore * 0.08
  )
  return input.subjectDetected === false ? clamp01(base * 0.6) : base
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function hashUnit(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

export function buildMediaSetLog(input: {
  mediaId: string
  mediaType: 'image' | 'video'
  qualityScore: number
  rating: number | null
  hasDiary: boolean
}): MediaSetLog {
  const { mediaId, mediaType, qualityScore, rating, hasDiary } = input
  const ratingBoost = rating != null ? (rating - 3) * 0.05 : 0

  const motionScore =
    mediaType === 'video'
      ? clamp01(0.55 + hashUnit(`${mediaId}:motion`) * 0.35)
      : clamp01(0.25 + hashUnit(`${mediaId}:motion`) * 0.25)
  const blurScore = clamp01(qualityScore * 0.7 + hashUnit(`${mediaId}:blur`) * 0.3)
  const brightnessScore = clamp01(qualityScore * 0.6 + hashUnit(`${mediaId}:bright`) * 0.4)
  const cropFitScore = clamp01(0.55 + hashUnit(`${mediaId}:crop`) * 0.35)
  const emotionScore = clamp01(0.4 + (hasDiary ? 0.28 : 0) + ratingBoost + hashUnit(`${mediaId}:emotion`) * 0.22)

  const rankScore = computeRankScore({ qualityScore, motionScore, emotionScore, cropFitScore })

  // 動画: 構えた直後のブレ/迷いを避け、素材尺の8〜22%地点から使う
  const trimStartRatio =
    mediaType === 'video' ? Math.round((0.08 + hashUnit(`${mediaId}:trim`) * 0.14) * 100) / 100 : null

  return {
    motionScore,
    blurScore,
    brightnessScore,
    cropFitScore,
    emotionScore,
    rankScore,
    trimStartRatio,
    subjectDetected: null,
    analysisSource: 'heuristic',
  }
}
