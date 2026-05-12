/** 0〜5 想定の星を文字列化（常に5文字） */
export function formatNativeAdStarString(rating: number | null): string | null {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null
  const filled = Math.min(5, Math.max(0, Math.round(rating)))
  return Array.from({ length: 5 }, (_, i) => (i < filled ? '★' : '☆')).join('')
}
