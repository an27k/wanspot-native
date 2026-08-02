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

/**
 * 寒い→暑い の順（スケール表示もこの順）。
 * 配色はアプリのグラデ（vlog: ミント/ラベンダー/ピンク、sunset: ピンク/コーラル/ピーチ）に
 * 調和する中間トーンに統一。原色を避けつつ、白背景上のテキストでも読める明度を確保。
 */
export const WALK_ALERT_LEVELS: WalkAlertLevel[] = [
  {
    key: 'numb',
    label: 'じんじん',
    color: '#8A8FE0',
    rangeLabel: '0℃以下',
    advice: '足先が凍えるほどの寒さ。お散歩は短時間にして、肉球の保護や防寒を。',
  },
  {
    key: 'sting',
    label: 'ひりひり',
    color: '#6AA7E5',
    rangeLabel: '1〜7℃',
    advice: 'かなり冷え込みます。ワンちゃんの様子を見ながら短めのお散歩を。',
  },
  {
    key: 'chilly',
    label: 'ひんやり',
    color: '#45C2C9',
    rangeLabel: '8〜15℃',
    advice: 'ひんやり快適。シニアや子犬には防寒があると安心です。',
  },
  {
    key: 'comfortable',
    label: '快適',
    color: '#3FCB97',
    rangeLabel: '16〜24℃',
    advice: 'お散歩しやすい気温です。日なたではこまめに休憩と水分補給を。',
  },
  {
    key: 'caution',
    label: '暑さ注意',
    color: '#F4A74A',
    rangeLabel: '25〜31℃',
    advice: '熱中症に注意。日なたとアスファルトの熱を避け、短めのお散歩に。',
  },
  {
    key: 'danger',
    label: '危険',
    color: '#FB7E5D',
    rangeLabel: '32〜34℃',
    advice: '熱中症の危険大。日中は避け、早朝・夜の涼しい時間だけにしましょう。',
  },
  {
    key: 'stop',
    label: '中止',
    color: '#F65A78',
    rangeLabel: '35℃以上 / 体感38℃以上',
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

/**
 * 気温(℃)→お散歩アラート段階。
 * 湿度・体感温度が渡された場合は安全側に補正する（未指定なら従来どおり気温のみで判定）。
 * - 気温35℃以上 または 体感38℃以上は「中止」
 * - 湿度65%以上かつ気温25℃以上は1段階厳しく判定（暑さ注意→危険、危険→中止）
 */
export function walkAlertFromTemp(
  tempC: number,
  opts?: {
    humidityPct?: number | null
    feelsLikeC?: number | null
    /**
     * 犬種の暑さへの弱さ（0〜2）。breedHeatSensitivity() の戻り値をそのまま渡す。
     * 短頭種は同じ気温でも熱中症リスクが明確に高いため、この分だけ閾値を下げる。
     * 犬種を聞いておきながら判定に効かせないのは、飼い主に対して不誠実になる。
     */
    heatSensitivity?: number | null
  }
): WalkAlertLevel {
  const feelsLikeC = opts?.feelsLikeC
  const humidityPct = opts?.humidityPct
  /**
   * 1段階につき 2℃ 早く警戒に入る。短頭種(2)なら 4℃ 手前から。
   *
   * ただし「快適→注意」の境目だけは補正を半分にする。ここを 4℃ 下げると
   * 22℃でも「暑さ注意」になり、空振りの警告で信頼を失う。危険側の取りこぼしと
   * 空振りは対称ではなく、鳴りすぎたアラートは次から読まれなくなる。
   */
  const shift = Math.max(0, Math.min(2, Math.round(opts?.heatSensitivity ?? 0))) * 2
  const mildShift = Math.round(shift / 2)

  if (tempC >= 35 - shift || (typeof feelsLikeC === 'number' && feelsLikeC >= 38 - shift)) return BY_KEY.stop

  let level: WalkAlertLevel
  if (tempC <= 0) level = BY_KEY.numb
  else if (tempC <= 7) level = BY_KEY.sting
  else if (tempC <= 15) level = BY_KEY.chilly
  else if (tempC <= 24 - mildShift) level = BY_KEY.comfortable
  else if (tempC <= 31 - shift) level = BY_KEY.caution
  else level = BY_KEY.danger

  // 蒸し暑い日はワンちゃんの体に熱がこもりやすいので、1段階厳しく見る
  if (typeof humidityPct === 'number' && humidityPct >= 65 && tempC >= 25 - mildShift) {
    if (level.key === 'caution') return BY_KEY.danger
    if (level.key === 'danger') return BY_KEY.stop
  }
  return level
}
