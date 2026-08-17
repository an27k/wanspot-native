const DEFAULT_DOG_NAME = 'わんこ'

function hashSpotId(spotId: string): number {
  let hash = 0
  for (let i = 0; i < spotId.length; i++) {
    hash = (hash * 31 + spotId.charCodeAt(i)) >>> 0
  }
  return hash
}

function buildVariants(name: string): string[] {
  return [
    `${name}、今日はずっとしっぽを振ってた`,
    `${name}がくつろいでた、また来たい`,
    `${name}とゆっくり過ごせた`,
    `${name}、初めて来たけどすぐ馴染んでた`,
    `${name}が嬉しそうに走り回ってた`,
    `${name}と一緒にのんびりできた`,
    `${name}、ここが気に入ったみたい`,
  ]
}

/** スポットごとに安定したプレースホルダー文言を1つ選ぶ */
export function pickSpotReviewMemoPlaceholder(dogName: string | null | undefined, spotId: string): string {
  const name = dogName?.trim() || DEFAULT_DOG_NAME
  const variants = buildVariants(name)
  return variants[hashSpotId(spotId) % variants.length]
}
