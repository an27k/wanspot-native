export const PLACE_ID_BLOCKLIST = new Set<string>([
  // 問題スポットが出たら追加: 'ChIJxxxxxxx', // スポット名（追加日）
])

export const NAME_BLOCK_PATTERNS: RegExp[] = [
  /銅像/,
  /ハチ公/,
  /記念碑/,
  /神社/,
  /寺$/,
  /(?<!道の)駅$/, // 道の駅は誤除外しない
  /タワー/,
]
