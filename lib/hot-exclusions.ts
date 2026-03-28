/**
 * 検索「ホット」用：犬カフェ・アニマルカフェ系は除外（Web の hot-exclusions と同じ基準）
 */
const DOG_CAFE_RE =
  /犬カフェ|ドッグカフェ|ドックカフェ|わんこカフェ|ワンコカフェ|dog\s*caf[eé]|dog\s*cafe/i
const ANIMAL_CAFE_RE = /アニマルカフェ|animal\s*caf[eé]/i

export function isExcludedHotSpotName(name: string): boolean {
  const n = name.trim()
  if (!n) return false
  if (DOG_CAFE_RE.test(n) || ANIMAL_CAFE_RE.test(n)) return true
  if (/サモエド/i.test(n) && /カフェ|cafe|CAFE/i.test(n)) return true
  return false
}

export function filterHotSpotResults<T extends { name: string }>(spots: T[]): T[] {
  return spots.filter((s) => !isExcludedHotSpotName(s.name))
}
