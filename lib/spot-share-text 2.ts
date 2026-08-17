/**
 * スポット共有文。犬の名前・サイズは入れない（飼い主の明示指示）。
 * Web の buildSpotShareText と同じ規則。
 */
export function buildSpotShareText(name: string, highlights: string[]): string {
  const n = name.trim() || 'スポット'
  const attrs = highlights.filter((h) => h.trim().length > 0).slice(0, 3)
  if (attrs.length > 0) return `${n}｜${attrs.join('・')} #wanspot`
  return `${n}｜ワンちゃんと行けるスポット見つけた🐾 #wanspot`
}
