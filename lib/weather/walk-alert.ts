/**
 * お散歩アラート: 気温(℃)からワンちゃんのお散歩リスク段階を判定する。
 * 段階・配色は参考デザイン（じんじん〜中止）に準拠。
 */
export type WalkAlertKey =
  | 'numb' // じんじん（凍える寒さ）
  | 'sting' // ひりひり（厳しい寒さ）
  | 'chilly' // ひんやり（涼しい）
  | 'comfortable' // 快適
  | 'caution' // 警戒（暑さ注意）
  | 'danger' // 危険（熱中症の危険）
  | 'stop' // 中止

export type WalkAlertLevel = {
  key: WalkAlertKey
  label: string
  /** リング・気温文字に使う色 */
  color: string
  /** 表示用の気温レンジ説明 */
  rangeLabel: string
  /** ワンちゃん向けの一言アドバイス */
  advice: string
}

/** 寒い→暑い の順（スケール表示もこの順） */
export const WALK_ALERT_LEVELS: WalkAlertLevel[] = [
  {
    key: 'numb',
    label: 'じんじん',
    color: '#8e5bd0',
    rangeLabel: '0℃以下',
    advice: '足先が凍えるほどの寒さ。お散歩は短時間にして、肉球の保護や防寒を。',
  },
  {
    key: 'sting',
    label: 'ひりひり',
    color: '#4a90d9',
    rangeLabel: '1〜7℃',
    advice: 'かなり冷え込みます。ワンちゃんの様子を見ながら短めのお散歩を。',
  },
  {
    key: 'chilly',
    label: 'ひんやり',
    color: '#3fb6d6',
    rangeLabel: '8〜15℃',
    advice: 'ひんやり快適。シニアや子犬には防寒があると安心です。',
  },
  {
    key: 'comfortable',
    label: '快適',
    color: '#34A853',
    rangeLabel: '16〜30℃',
    advice: 'お散歩日和。たっぷり楽しめます。水分はこまめに。',
  },
  {
    key: 'caution',
    label: '警戒',
    color: '#F5A300',
    rangeLabel: '31〜39℃',
    advice: '暑さに注意。アスファルトの熱に気をつけ、水分補給を忘れずに。',
  },
  {
    key: 'danger',
    label: '危険',
    color: '#EF7D22',
    rangeLabel: '40〜45℃',
    advice: '熱中症の危険大。日中は避け、早朝・夜の涼しい時間にお散歩を。',
  },
  {
    key: 'stop',
    label: '中止',
    color: '#E84335',
    rangeLabel: '46℃以上',
    advice: 'お散歩は中止を。室内で涼しく過ごしましょう。',
  },
]

const BY_KEY: Record<WalkAlertKey, WalkAlertLevel> = WALK_ALERT_LEVELS.reduce(
  (acc, lv) => {
    acc[lv.key] = lv
    return acc
  },
  {} as Record<WalkAlertKey, WalkAlertLevel>
)

export function walkAlertLevel(key: WalkAlertKey): WalkAlertLevel {
  return BY_KEY[key]
}

/** 気温(℃)→お散歩アラート段階 */
export function walkAlertFromTemp(tempC: number): WalkAlertLevel {
  if (tempC <= 0) return BY_KEY.numb
  if (tempC <= 7) return BY_KEY.sting
  if (tempC <= 15) return BY_KEY.chilly
  if (tempC <= 30) return BY_KEY.comfortable
  if (tempC <= 39) return BY_KEY.caution
  if (tempC <= 45) return BY_KEY.danger
  return BY_KEY.stop
}
