export function formatDuration(seconds: number): string {
  const min = Math.ceil(seconds / 60)
  if (min < 60) return `${min}分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

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
