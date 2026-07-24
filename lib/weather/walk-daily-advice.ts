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
  return `walk-advice:v5:${walkAdviceDateKey()}:h${currentHourInTokyo()}:${geoBucket(lat, lng)}:${dog}:${size}:${tempBucket}:${condition ?? '_'}`
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
  if (min != null && max != null) return `予想は${min}〜${max}℃・${weather}。`
  return `${weather}の一日になりそうです。`
}

/** 飼い主が嬉しくなるトーンで、本文のみ（日付・場所はUIヘッダー） */
export function composeWalkAdviceLocal(
  env: WalkEnvironment,
  level: WalkAlertLevel,
  dogName: string | null | undefined,
  dogSize: DogSize | null | undefined
): string {
  const subject = dogSubject(dogName)
  const carePoint = dogCarePoint(dogSize)
  const hour = bestWalkHour(env)
  // 暑さ寄りの日は路面チェック、それ以外は様子見のひとことを添える
  const timingCare =
    level.key === 'comfortable' || level.key === 'caution'
      ? '出発前にアスファルトを手の甲で5秒さわって、熱ければ時間をずらしてあげてください。'
      : `${subject}の様子を見ながら、短めに調整してあげてください。`
  const timing = hour
    ? `${hour.hour}時ごろ（${hour.tempC}℃・降水${hour.precipProb}%）が比較的歩きやすい目安です。${timingCare}`
    : ''
  const wetOrStormy = isWetOrStormy(env)
  const windy = isWindy(env)

  const lines: string[] = []

  const openers: Record<WalkAlertKey, string> = {
    comfortable: wetOrStormy
      ? `${subject}には気温だけなら歩きやすめですが、今日は雨に注意したい日です。今${env.current.tempC}℃で${forecastLine(env)}`
      : windy
        ? `${subject}には気温だけなら歩きやすめですが、風が強めです。今${env.current.tempC}℃で${forecastLine(env)}`
        : `${subject}の今日のお散歩は、飼い主さんが様子を見ながら気持ちよく歩けるコンディションです。今${env.current.tempC}℃で${forecastLine(env)}`,
    chilly: `${subject}には少しひんやりする一日です。${forecastLine(env)}寒がる様子があれば服や短めコースで調整してあげてください。`,
    sting: `${subject}には冷え込みが強めです。飼い主さんが足先の冷えや震えを見ながら、短めに済ませるのが安心です。`,
    numb: `${subject}にはかなり冷たい外気です。今日は排泄中心の短時間にして、帰ったら体を温めてあげてください。`,
    caution: `${subject}には暑さが気になる気温です。飼い主さんが日なたと路面の熱を避けて、早朝や夕方に短く調整してあげてください。`,
    danger: `${subject}には熱がこもりやすい危険寄りの気温です。今日は距離を伸ばさず、涼しい時間に必要最低限が安心です。`,
    stop: `${subject}には外歩きの負担が大きい日です。今日は室内遊びやノーズワークで満足感を作ってあげましょう。`,
  }

  lines.push(openers[level.key])

  // 「危険」以上では時刻の推奨はせず、定性的な安全側の文言にとどめる
  if (level.key === 'danger') {
    lines.push(
      '日中の散歩は避けて、いちばん涼しい早朝に排泄中心の短時間が安心です。アスファルトの熱にも注意してあげてください。'
    )
  } else if (timing && level.key !== 'stop') {
    lines.push(timing)
  }

  // caution は timing 行に手の甲5秒チェックが入るため、路面注意の重複を避けて danger/stop のみに出す
  if (level.key === 'danger' || level.key === 'stop') {
    lines.push(
      `気温${env.current.tempC}℃のとき、日なたのアスファルトは50℃を超えることがあります。肉球のやけどに気をつけてあげてください。`
    )
  }

  if (wetOrStormy) {
    lines.push(`雨の時間帯は無理せず、行くなら小雨の合間に短く。帰宅後は${subject}の足先とお腹をしっかり拭いてあげてください。`)
  } else if (level.key === 'comfortable' || level.key === 'chilly') {
    lines.push(`におい嗅ぎの時間を少し多めにすると、${subject}の満足感を作りやすいです。`)
  }

  if (env.today.uvMax != null && env.today.uvMax >= 6) {
    lines.push('日差しが強い時間は日陰ルートで、のんびり歩くのがおすすめです。')
  }

  if (env.current.humidityPct != null && env.current.humidityPct >= 70) {
    lines.push(`湿度が高めなので、${subject}の息づかいを見ながら、こまめに水分補給してあげてください。`)
  } else if (level.key !== 'stop') {
    lines.push(carePoint)
  }

  return lines.join('\n')
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
