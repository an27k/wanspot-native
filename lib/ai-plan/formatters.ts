export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0m'
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

/** 表示用: DB の名前が空なら「ワンちゃん」、それ以外は「○○ちゃん」 */
export function formatAiPlanDogDisplayName(raw: string): string {
  const t = typeof raw === 'string' ? raw.trim() : ''
  if (!t) return 'ワンちゃん'
  return t.endsWith('ちゃん') ? t : `${t}ちゃん`
}
