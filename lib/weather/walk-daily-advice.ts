import {
  geoBucket,
  isCacheFresh,
  readCache,
  writeCache,
} from '@/lib/client-cache'
import { wanspotFetch, wanspotFetchJson } from '@/lib/wanspot-api'
import {
  fetchWalkEnvironment,
  walkAdviceDateKey,
  weatherConditionJa,
  type WalkEnvironment,
  type WalkHourlySlot,
} from '@/lib/weather/walk-environment'
import type { WeatherCondition } from '@/lib/weather/fetch-weather'
import { walkAlertFromTemp, type WalkAlertKey, type WalkAlertLevel } from '@/lib/weather/walk-alert'

const ADVICE_TTL_MS = 2 * 60 * 60_000
type DogSize = 'XS' | 'S' | 'M' | 'L' | 'XL'

export type WalkDailyAdvice = {
  text: string
  dateLabel: string
  areaLabel: string
  dateKey: string
  source: 'ai' | 'api' | 'local'
  /** 湿度・体感補正後のレベル。バッジ表示を本文のトーンと一致させるために使う */
  levelKey?: WalkAlertKey
}

function adviceCacheKey(
  lat: number,
  lng: number,
  dogName: string | null | undefined,
  dogSize: DogSize | null | undefined,
  tempC: number | null,
  condition: WeatherCondition | null | undefined
): string {
  const dog = dogName?.trim() ? dogName.trim() : '_'
  const size = dogSize ?? '_'
  const tempBucket = tempC == null ? '_' : String(Math.round(tempC / 3) * 3)
  // 本文が現在時刻（過去スロット除外）と湿度に依存するため、時間成分をキーに含めて毎時再生成する
  return `walk-advice:v6:${walkAdviceDateKey()}:h${currentHourInTokyo()}:${geoBucket(lat, lng)}:${dog}:${size}:${tempBucket}:${condition ?? '_'}`
}

function dogSubject(dogName: string | null | undefined): string {
  const n = dogName?.trim()
  return n ? `${n}ちゃん` : 'ワンちゃん'
}

function dogCarePoint(dogSize: DogSize | null | undefined): string {
  switch (dogSize) {
    case 'XS':
    case 'S':
      return '体が地面に近いぶん、雨はねやアスファルトの熱を受けやすいので、足元とお腹をいつもより丁寧に見てあげてください。'
    case 'M':
      return '歩くペースが上がりやすいので、飼い主さんが少し早めに休憩を入れてあげると安心です。'
    case 'L':
    case 'XL':
      return '体に熱がこもりやすいので、距離よりも涼しいルートと給水タイミングを優先してあげてください。'
    default:
      return 'いつもの様子と違う息づかい・足取りがあれば、予定より早めに切り上げてあげてください。'
  }
}

/** 快適域(12〜24℃)からの距離。0なら快適域内 */
function comfortDistance(tempC: number): number {
  if (tempC < 12) return 12 - tempC
  if (tempC > 24) return tempC - 24
  return 0
}

/** 現在時刻（Asia/Tokyo）の「時」 */
function currentHourInTokyo(): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(
      new Date()
    )
  )
}

/**
 * 今日の残り時間帯から、ワンちゃんが歩きやすい候補を1つ選ぶ。
 * 気温25℃超・雨系・降水50%以上・過去の時間帯は候補にせず、適合ゼロなら null（候補時間は表示しない）。
 * 複数候補は「快適域(12〜24℃)への近さ優先 → 同等なら降水確率が低い方」で選ぶ。
 */
function bestWalkHour(env: WalkEnvironment): WalkHourlySlot | null {
  const nowHour = currentHourInTokyo()
  return env.hourly.reduce<WalkHourlySlot | null>((best, slot) => {
    if (slot.hour < nowHour) return best
    if (slot.tempC > 25) return best
    if (slot.precipProb >= 50) return best
    if (slot.condition === 'rain' || slot.condition === 'thunder' || slot.condition === 'snow') return best
    if (!best) return slot
    const slotDist = comfortDistance(slot.tempC)
    const bestDist = comfortDistance(best.tempC)
    if (slotDist < bestDist) return slot
    if (slotDist === bestDist && slot.precipProb < best.precipProb) return slot
    return best
  }, null)
}

function isWetOrStormy(env: WalkEnvironment): boolean {
  return (
    env.current.condition === 'rain' ||
    env.current.condition === 'thunder' ||
    env.current.condition === 'snow' ||
    (env.current.precipMm ?? 0) > 0 ||
    (env.today.precipProbMax ?? 0) >= 50 ||
    env.hourly.some((slot) => slot.precipProb >= 60 || slot.condition === 'rain' || slot.condition === 'thunder')
  )
}

function isWindy(env: WalkEnvironment): boolean {
  return env.current.condition === 'wind' || (env.current.windKmh ?? 0) >= 28 || (env.today.windMaxKmh ?? 0) >= 35
}

function forecastLine(env: WalkEnvironment): string {
  const min = env.today.tempMinC
  const max = env.today.tempMaxC
  const weather = weatherConditionJa(env.today.condition)
  if (min != null && max != null) return `予想は${min}〜${max}℃・${weather}`
  return `${weather}の一日`
}

type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'

function seasonFromDateKey(dateKey: string): SeasonKey {
  const month = Number(dateKey.slice(5, 7))
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function seasonPhrase(season: SeasonKey): string {
  switch (season) {
    case 'spring':
      return '春の陽気'
    case 'summer':
      return '夏本番'
    case 'autumn':
      return '秋の空気'
    case 'winter':
      return '冬の冷え'
  }
}

/** 日付キーなどで安定して候補を選ぶ（同じ日は同じ文面、日が変わると別候補） */
function pickBySeed<T>(seed: string, items: readonly T[]): T {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return items[Math.abs(h) % items.length]!
}

/** 前日との気温差から、飼い主が「昨日との違い」を感じる一文 */
function yesterdayCompareLine(
  env: WalkEnvironment,
  subject: string,
  seed: string
): string | null {
  const yMax = env.yesterday?.tempMaxC
  const tMax = env.today.tempMaxC
  if (yMax == null || tMax == null) return null
  const delta = tMax - yMax

  if (delta >= 3) {
    return pickBySeed(seed + ':hotter', [
      `昨日より最高気温が${delta}℃ほど上がる見込み。体感の差が出やすいので、いつもよりペースを落としてあげてください。`,
      `きのうより${delta}℃暑い一日になりそう。同じコースでも${subject}への負担が変わります。`,
      `昨日より一段と暑さが乗りそうです（最高+${delta}℃）。「昨日大丈夫だったから」は今日は当てにしないで。`,
    ])
  }
  if (delta <= -3) {
    const cooler = Math.abs(delta)
    return pickBySeed(seed + ':cooler', [
      `昨日より最高で${cooler}℃ほど下がる見込み。涼しく感じても油断せず、${subject}の様子を見て調整を。`,
      `きのうより${cooler}℃涼しくなりそう。気温が下がっても路面の熱や風には注意してあげてください。`,
      `昨日より少し楽な気温帯に入りそうです（最高−${cooler}℃）。それでも無理は禁物です。`,
    ])
  }
  if (Math.abs(delta) <= 1) {
    return pickBySeed(seed + ':same', [
      `最高気温は昨日と同程度（${tMax}℃前後）。似たコンディションでも、時間帯で体感は変わります。`,
      `きのうと同じくらいの気温帯が続きそう。だからこそ、路面と息づかいで今日の判断をしてあげてください。`,
    ])
  }
  return null
}

/**
 * レベル×季節×日付シードでオープナーを選ぶ。
 * 「〇〇ちゃんには〜の日です」の定型を避け、飼い主が状況を想像できる言い回しにする。
 */
function pickOpener(
  env: WalkEnvironment,
  level: WalkAlertLevel,
  subject: string,
  season: SeasonKey,
  seed: string,
  wetOrStormy: boolean,
  windy: boolean
): string {
  const temp = env.current.tempC
  const forecast = forecastLine(env)
  const seasonBit = seasonPhrase(season)

  if (wetOrStormy && (level.key === 'comfortable' || level.key === 'chilly' || level.key === 'caution')) {
    return pickBySeed(seed + ':wet', [
      `気温だけ見ると${level.label}寄りですが、雨の気配がある一日。${subject}の足先が濡れないよう、合間の短時間が安心です。今${temp}℃、${forecast}。`,
      `きょうは${seasonBit}でも空模様が気がかり。${subject}との外出は小雨の合間に切り上げるつもりで。今${temp}℃、${forecast}。`,
      `傘が欲しくなる予報です。${subject}には冷たい雨はねが負担なので、短め・乾いたルート優先で。今${temp}℃。`,
    ])
  }

  if (windy && (level.key === 'comfortable' || level.key === 'chilly')) {
    return pickBySeed(seed + ':wind', [
      `気温は歩きやすめでも風が強め。${subject}が落ち着いて歩けるルートに寄せてあげてください。今${temp}℃、${forecast}。`,
      `きょうは風が顔に当たる一日。${subject}が嫌がるようなら早めに切り上げて大丈夫です。今${temp}℃。`,
    ])
  }

  const byLevel: Record<WalkAlertKey, readonly string[]> = {
    comfortable: [
      `${seasonBit}のなか、${subject}には歩きやすい気温帯。今${temp}℃で${forecast}。飼い主さんがペースを合わせれば、気持ちよく過ごせそうです。`,
      `きょうの外気は${subject}にとってちょうどよさそう。今${temp}℃・${forecast}。におい嗅ぎの余裕も作ってあげてください。`,
      `${subject}と出かけやすいコンディションです。今${temp}℃、${forecast}。暑くなり始める前に回るのがおすすめ。`,
    ],
    chilly: [
      `${subject}には少しひんやりする空気。${forecast}。寒がるようなら服や短めコースで調整してあげてください。`,
      `朝晩は冷えやすい一日。${subject}の足先と震えを見ながら、いつもより短くても十分です。${forecast}。`,
      `${seasonBit}らしい涼しさ。${subject}が元気でも、風の通り道は避けてあげてください。今${temp}℃。`,
    ],
    sting: [
      `冷え込みが強めの一日。${subject}の足先や震えを見ながら、排泄中心の短時間が安心です。`,
      `外気は${subject}にはかなり厳しい温度帯。今${temp}℃。長居せず、帰ったら体を温めてあげてください。`,
      `きょうは寒さが主役。${subject}との外出は必要最低限にして、室内で満足感を補ってあげましょう。`,
    ],
    numb: [
      `凍えるような外気です。${subject}の肉球と体を守るなら、きょうは短時間の排泄だけが正解に近いです。`,
      `かなり冷たい一日。${subject}を外に長く出さず、帰ったらしっかり温めてあげてください。今${temp}℃。`,
      `${seasonBit}でも今日は厳しすぎる冷え。${subject}の様子を最優先に、予定を大胆に削って大丈夫です。`,
    ],
    caution: [
      `${seasonBit}の暑さが乗ってきました。${subject}には日なたと路面の熱が負担。早朝か夕方に短く寄せてあげてください。今${temp}℃、${forecast}。`,
      `きょうは「普通に歩ける」気温を超え始めています。${subject}の息が荒くなったら即帰宅で。今${temp}℃。`,
      `暑さ注意のライン。${subject}とのお散歩は影の多いルートへ。アスファルトは手の甲で5秒チェックを。今${temp}℃、${forecast}。`,
    ],
    danger: [
      `熱がこもりやすい危険寄りの気温。${subject}には距離を伸ばさず、いちばん涼しい時間の最低限が安心です。今${temp}℃、${forecast}。`,
      `きょうの外は${subject}にとって厳しすぎる暑さ。日中は避けて、早朝の短時間だけ考えてあげてください。今${temp}℃。`,
      `${seasonBit}のピーク級。${subject}の熱中症を防ぐなら、「歩かない選択」も立派なケアです。今${temp}℃。`,
    ],
    stop: [
      `外歩きは負担が大きすぎる一日。${subject}には室内遊びやノーズワークで満足感を作ってあげましょう。今${temp}℃、${forecast}。`,
      `きょうは散歩を休む日、で正解です。${subject}と家のなかでクールダウンしながら過ごしてあげてください。今${temp}℃。`,
      `${seasonBit}の猛暑日。${subject}を外に連れ出すより、涼しい部屋で頭と鼻を使う遊びを。今${temp}℃。`,
    ],
  }

  return pickBySeed(seed + ':' + level.key, byLevel[level.key])
}

function pickActionLine(
  env: WalkEnvironment,
  level: WalkAlertLevel,
  subject: string,
  seed: string,
  hour: WalkHourlySlot | null
): string | null {
  if (level.key === 'stop') {
    return pickBySeed(seed + ':act-stop', [
      `どうしても外に出るなら、早朝の数分・日陰のみ。肉球のやけどを最優先に考えてあげてください。`,
      `アスファルトは手で触れないほど熱いことがあります。きょうは外の予定をいったん白紙に。`,
    ])
  }

  if (level.key === 'danger') {
    return pickBySeed(seed + ':act-danger', [
      `日中の散歩は避けて、いちばん涼しい早朝に排泄中心の短時間が安心です。`,
      `距離より「涼しいか・短いか」。${subject}の舌が長く出ていたら、その場で切り上げてください。`,
    ])
  }

  if (hour && (level.key === 'comfortable' || level.key === 'chilly' || level.key === 'caution')) {
    const timingCare =
      level.key === 'caution' || level.key === 'comfortable'
        ? '出発前にアスファルトを手の甲で5秒さわって、熱ければ時間をずらして。'
        : `${subject}の様子を見ながら短めに調整を。`
    return pickBySeed(seed + ':act-hour', [
      `${hour.hour}時ごろ（${hour.tempC}℃・降水${hour.precipProb}%）が比較的歩きやすい目安です。${timingCare}`,
      `目安は${hour.hour}時前後（${hour.tempC}℃）。${timingCare}`,
    ])
  }

  if (level.key === 'sting' || level.key === 'numb') {
    return pickBySeed(seed + ':act-cold', [
      `防寒と短時間をセットで。帰宅後は${subject}の体を乾かして温めてあげてください。`,
      `長居しないつもりで玄関を出ると、${subject}にも飼い主さんにも楽です。`,
    ])
  }

  return null
}

function pickCareCloser(
  env: WalkEnvironment,
  level: WalkAlertLevel,
  subject: string,
  dogSize: DogSize | null | undefined,
  seed: string,
  wetOrStormy: boolean
): string | null {
  if (wetOrStormy) {
    return pickBySeed(seed + ':care-wet', [
      `雨の時間帯は無理せず。帰宅後は${subject}の足先とお腹をしっかり拭いてあげてください。`,
      `濡れたまま放置しないこと。${subject}の肉球まわりを乾かしてあげると安心です。`,
    ])
  }

  if (level.key === 'danger' || level.key === 'stop') {
    return pickBySeed(seed + ':care-hot', [
      `気温${env.current.tempC}℃のとき、日なたのアスファルトは50℃を超えることがあります。肉球を守ってあげてください。`,
      `給水は「欲しがってから」では遅いことも。${subject}のそばに水を置きつつ、無理な外出は避けて。`,
    ])
  }

  if (env.today.uvMax != null && env.today.uvMax >= 6 && level.key !== 'numb' && level.key !== 'sting') {
    return pickBySeed(seed + ':care-uv', [
      `日差しが強い時間は日陰ルートで、のんびり歩くのがおすすめです。`,
      `紫外線が強め。${subject}と影の多い道を選んであげてください。`,
    ])
  }

  if (env.current.humidityPct != null && env.current.humidityPct >= 70) {
    return pickBySeed(seed + ':care-humid', [
      `湿度が高めなので、${subject}の息づかいを見ながら、こまめに水分補給を。`,
      `蒸し暑さは体感を一気に上げます。${subject}がハーハーしたら休憩を長く取ってあげてください。`,
    ])
  }

  if (level.key === 'comfortable' || level.key === 'chilly') {
    return pickBySeed(seed + ':care-good', [
      `におい嗅ぎの時間を少し多めにすると、${subject}の満足感を作りやすいです。`,
      `${subject}のペースに合わせて、立ち止まる回数を増やしてあげてください。`,
      dogCarePoint(dogSize),
    ])
  }

  return dogCarePoint(dogSize)
}

/** 飼い主が状況を想像できるトーンで、本文のみ（日付・場所はUIヘッダー） */
export function composeWalkAdviceLocal(
  env: WalkEnvironment,
  level: WalkAlertLevel,
  dogName: string | null | undefined,
  dogSize: DogSize | null | undefined
): string {
  const subject = dogSubject(dogName)
  const hour = bestWalkHour(env)
  const wetOrStormy = isWetOrStormy(env)
  const windy = isWindy(env)
  const season = seasonFromDateKey(env.dateKey)
  // 日付＋レベル＋季節で候補を固定。同じ日は同じ文、翌日は別パターン
  const seed = `${env.dateKey}:${level.key}:${season}:${env.today.condition}`

  const lines: string[] = []
  lines.push(pickOpener(env, level, subject, season, seed, wetOrStormy, windy))

  const compare = yesterdayCompareLine(env, subject, seed)
  if (compare) lines.push(compare)

  const action = pickActionLine(env, level, subject, seed, hour)
  if (action) lines.push(action)

  const closer = pickCareCloser(env, level, subject, dogSize, seed, wetOrStormy)
  if (closer) lines.push(closer)

  // 3〜4文程度に収める（読み飛ばされにくさ優先）
  return lines.slice(0, 4).join('\n')
}

async function fetchWalkAdviceFromApi(
  env: WalkEnvironment,
  level: WalkAlertLevel,
  dogName: string | null | undefined,
  dogSize: DogSize | null | undefined
): Promise<string | null> {
  try {
    const json = await wanspotFetchJson<{ advice?: string; summary?: string }>('/api/walk-advice', {
      method: 'POST',
      json: {
        lat: env.lat,
        lng: env.lng,
        dogName: dogName?.trim() || null,
        dogSize: dogSize ?? null,
        dateKey: env.dateKey,
        dateLabel: env.dateLabel,
        areaLabel: env.areaLabel,
        walkLevel: { key: level.key, label: level.label, tempC: env.current.tempC },
        environment: env,
        summaryLines: env.summaryLines,
        instructions: [
          '日本語で3〜4文。常に飼い主目線で、その子の体調を見ながら判断できる文章にすること。',
          '単なる天気説明ではなく「飼い主さんが何を見て、どう調整するか」を具体的に書くこと。',
          '毎日同じ定型文にならないよう、季節感・前日との気温差・今日の天気の変化を織り込むこと。',
          '「〇〇ちゃんには〜の日です」のような機械的な書き出しは避け、状況が目に浮かぶ言い回しにすること。',
          '日付・場所・見出しは書かない（UIに別表示）。',
          dogName?.trim()
            ? `犬の名前「${dogName.trim()}ちゃん」を文中に必ず1回以上入れること。`
            : '犬名未設定の場合は「ワンちゃん」で呼びかけること。',
          dogSize ? `犬のサイズは ${dogSize}。サイズに応じた注意点を自然に1つ入れること。` : '犬サイズ未設定の場合は一般的な注意にすること。',
          '気温・降水・時間帯など環境データを自然に織り込むこと。',
          '雨・雷雨・雪・降水確率50%以上・強風・暑さ注意以上の場合は「お散歩日和」「快適」「たっぷり楽しめる」と書かないこと。',
          '悪天候時は、短時間・雨の合間・足先やお腹を拭く・室内遊びなど安全寄りの提案にすること。',
        ],
      },
    })
    const text = (json.advice ?? json.summary)?.trim()
    return text && text.length > 20 ? text : null
  } catch {
    return null
  }
}

async function fetchWalkAdviceViaAiSummary(
  env: WalkEnvironment,
  level: WalkAlertLevel,
  dogName: string | null | undefined,
  dogSize: DogSize | null | undefined
): Promise<string | null> {
  try {
    const res = await wanspotFetch('/api/ai-summary', {
      method: 'POST',
      json: {
        place_id: `walk-advice-${env.dateKey}`,
        name: '今日のお散歩アドバイス',
        category: '天気・環境',
        address: env.areaLabel,
        rating: env.current.tempC,
        reviews: env.summaryLines,
        userContext: {
          lat: env.lat,
          lng: env.lng,
          walkAreaTags: [],
          mode: 'walk_daily_advice',
          dogName: dogName?.trim() || null,
          dogSize: dogSize ?? null,
          areaLabel: env.areaLabel,
          walkLevelLabel: level.label,
          walkLevelAdvice: level.advice,
          noDateInBody: true,
        },
      },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { summary?: string }
    const text = json.summary?.trim()
    return text && text.length > 20 ? text : null
  } catch {
    return null
  }
}

/** 日付・場所の重複行を除去し、犬名だけ補完 */
function polishAdviceBody(text: string, env: WalkEnvironment, dogName: string | null | undefined): string {
  let out = text.trim()

  const stripPatterns = [
    new RegExp(`^${env.dateLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*\\n?`, 'gm'),
    /^[^\n]*のお散歩アドバイス[^\n]*\n?/gm,
    /^\([^)]+\)\s*\n/gm,
    /^[^\n]*お住まいのエリア[^\n]*\n?/gm,
  ]
  for (const re of stripPatterns) {
    out = out.replace(re, '')
  }
  out = out.replace(/\n{3,}/g, '\n\n').trim()

  const name = dogName?.trim()
  if (name && !out.includes(name)) {
    out = `${name}ちゃん、${out}`
  }
  return out
}

/** 1日1回キャッシュ。環境取得 → AI/API → ローカルフォールバック */
export async function fetchWalkDailyAdvice(
  lat: number,
  lng: number,
  tempC: number | null,
  dogName: string | null | undefined,
  opts?: { force?: boolean; weatherCondition?: WeatherCondition | null; dogSize?: DogSize | null }
): Promise<WalkDailyAdvice> {
  const dogSize = opts?.dogSize ?? null
  const cacheKey = adviceCacheKey(lat, lng, dogName, dogSize, tempC, opts?.weatherCondition)
  if (!opts?.force && isCacheFresh(cacheKey, ADVICE_TTL_MS)) {
    const cached = readCache<WalkDailyAdvice>(cacheKey)
    if (cached) return { ...cached, source: cached.source }
  }

  const env = await fetchWalkEnvironment(lat, lng)
  const t = tempC ?? env?.current.tempC ?? 20
  // 取得済みの湿度・体感温度も使い、蒸し暑い日は安全側の段階で文言を組む
  const level = walkAlertFromTemp(t, {
    humidityPct: env?.current.humidityPct ?? null,
    feelsLikeC: env?.current.feelsLikeC ?? null,
  })

  if (!env) {
    const dateLabel = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(new Date())
    const fallback: WalkDailyAdvice = {
      text: `${dogSubject(dogName)}は今の気温では「${level.label}」です。飼い主さんが天気や路面、息づかいを見ながら無理のない距離に調整してあげてください。${dogCarePoint(dogSize)}`,
      dateLabel,
      areaLabel: 'お住まいのエリア',
      dateKey: walkAdviceDateKey(),
      source: 'local',
      levelKey: level.key,
    }
    writeCache(cacheKey, fallback)
    return fallback
  }

  // AI/API経路はサーバー側が未実装・常時エラーで機能していないため、当面ローカル安全文言に一本化する
  const shouldUseLocalSafetyCopy = true as boolean
  const fromApi = shouldUseLocalSafetyCopy ? null : await fetchWalkAdviceFromApi(env, level, dogName, dogSize)
  const fromAi = fromApi || shouldUseLocalSafetyCopy ? null : await fetchWalkAdviceViaAiSummary(env, level, dogName, dogSize)
  const raw = shouldUseLocalSafetyCopy ? null : fromApi ?? fromAi
  const text = raw ? polishAdviceBody(raw, env, dogName) : composeWalkAdviceLocal(env, level, dogName, dogSize)

  const result: WalkDailyAdvice = {
    text,
    dateLabel: env.dateLabel,
    areaLabel: env.areaLabel,
    dateKey: env.dateKey,
    source: raw && fromApi ? 'api' : raw && fromAi ? 'ai' : 'local',
    levelKey: level.key,
  }
  writeCache(cacheKey, result)
  return result
}
