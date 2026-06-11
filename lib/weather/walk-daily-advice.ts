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
} from '@/lib/weather/walk-environment'
import { walkAlertFromTemp, type WalkAlertKey, type WalkAlertLevel } from '@/lib/weather/walk-alert'

const ADVICE_TTL_MS = 24 * 60 * 60_000

export type WalkDailyAdvice = {
  text: string
  dateLabel: string
  areaLabel: string
  dateKey: string
  source: 'ai' | 'api' | 'local'
}

function adviceCacheKey(lat: number, lng: number, dogName: string | null | undefined): string {
  const dog = dogName?.trim() ? dogName.trim() : '_'
  return `walk-advice:v2:${walkAdviceDateKey()}:${geoBucket(lat, lng)}:${dog}`
}

function dogSubject(dogName: string | null | undefined): string {
  const n = dogName?.trim()
  return n ? `${n}ちゃん` : 'ワンちゃん'
}

function bestWalkHour(env: WalkEnvironment) {
  return env.hourly.reduce<typeof env.hourly[0] | null>((best, slot) => {
    if (slot.precipProb >= 50) return best
    if (!best) return slot
    if (slot.tempC >= 12 && slot.tempC <= 28 && slot.precipProb < best.precipProb) return slot
    return best
  }, null)
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
  dogName: string | null | undefined
): string {
  const subject = dogSubject(dogName)
  const hour = bestWalkHour(env)
  const timing = hour
    ? `${hour.hour}時ごろ（${hour.tempC}℃・降水${hour.precipProb}%）なら特に歩きやすそうです。`
    : ''

  const lines: string[] = []

  const openers: Record<WalkAlertKey, string> = {
    comfortable: `${subject}、今日はお散歩日和です！今${env.current.tempC}℃で${forecastLine(env)}`,
    chilly: `${subject}、ひんやり爽やかな一日。${forecastLine(env)}防寒があれば気持ちよく歩けます。`,
    sting: `${subject}、冷え込みますが、短めの散歩で体を温めれば十分楽しめます。`,
    numb: `${subject}、外は冷たいので短時間のお散歩に。帰ったらぽかぽかでリフレッシュ。`,
    caution: `${subject}、暑さに気をつけつつ、早朝や夕方なら楽しい散歩になります。`,
    danger: `${subject}、真昼は避けて、涼しい時間帯に短めの散歩がおすすめです。`,
    stop: `${subject}、今日は室内でたっぷり遊ぶ日。クールダウンしながらゆっくり過ごしましょう。`,
  }

  lines.push(openers[level.key])

  if (timing && level.key !== 'stop') lines.push(timing)

  if (env.today.precipProbMax != null && env.today.precipProbMax >= 40) {
    lines.push(`傘やタオルがあると安心。雨の匂いも${subject}にとっては新鮮な楽しみです。`)
  } else if (level.key === 'comfortable' || level.key === 'chilly') {
    lines.push(`新しい匂いをたくさん嗅いで、${subject}のしっぽが振れる時間を楽しんでください。`)
  }

  if (env.today.uvMax != null && env.today.uvMax >= 6) {
    lines.push('日差しが強い時間は日陰ルートで、のんびり歩くのがおすすめです。')
  }

  if (env.current.humidityPct != null && env.current.humidityPct >= 70) {
    lines.push('湿度が高めなので、こまめに水分補給しながら、無理のないペースで。')
  } else if (level.key !== 'stop') {
    lines.push('お水を持って、のびのび行きましょう。')
  }

  return lines.join('\n')
}

async function fetchWalkAdviceFromApi(
  env: WalkEnvironment,
  level: WalkAlertLevel,
  dogName: string | null | undefined
): Promise<string | null> {
  try {
    const json = await wanspotFetchJson<{ advice?: string; summary?: string }>('/api/walk-advice', {
      method: 'POST',
      json: {
        lat: env.lat,
        lng: env.lng,
        dogName: dogName?.trim() || null,
        dateKey: env.dateKey,
        dateLabel: env.dateLabel,
        areaLabel: env.areaLabel,
        walkLevel: { key: level.key, label: level.label, tempC: env.current.tempC },
        environment: env,
        summaryLines: env.summaryLines,
        instructions: [
          '日本語で3〜4文。飼い主が嬉しくなる、前向きで温かいトーンで書くこと。',
          '日付・場所・見出しは書かない（UIに別表示）。',
          dogName?.trim()
            ? `犬の名前「${dogName.trim()}ちゃん」を文中に必ず1回以上入れること。`
            : '犬名未設定の場合は「ワンちゃん」で呼びかけること。',
          '気温・降水・時間帯など環境データを自然に織り込むこと。',
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
  dogName: string | null | undefined
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
  opts?: { force?: boolean }
): Promise<WalkDailyAdvice> {
  const cacheKey = adviceCacheKey(lat, lng, dogName)
  if (!opts?.force && isCacheFresh(cacheKey, ADVICE_TTL_MS)) {
    const cached = readCache<WalkDailyAdvice>(cacheKey)
    if (cached) return { ...cached, source: cached.source }
  }

  const env = await fetchWalkEnvironment(lat, lng)
  const t = tempC ?? env?.current.tempC ?? 20
  const level = walkAlertFromTemp(t)

  if (!env) {
    const dateLabel = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(new Date())
    const fallback: WalkDailyAdvice = {
      text: `${dogSubject(dogName)}、今日もいい散歩日和かも。${level.advice}`,
      dateLabel,
      areaLabel: 'お住まいのエリア',
      dateKey: walkAdviceDateKey(),
      source: 'local',
    }
    writeCache(cacheKey, fallback)
    return fallback
  }

  const fromApi = await fetchWalkAdviceFromApi(env, level, dogName)
  const fromAi = fromApi ? null : await fetchWalkAdviceViaAiSummary(env, level, dogName)
  const raw = fromApi ?? fromAi
  const text = raw
    ? polishAdviceBody(raw, env, dogName)
    : composeWalkAdviceLocal(env, level, dogName)

  const result: WalkDailyAdvice = {
    text,
    dateLabel: env.dateLabel,
    areaLabel: env.areaLabel,
    dateKey: env.dateKey,
    source: fromApi ? 'api' : fromAi ? 'ai' : 'local',
  }
  writeCache(cacheKey, result)
  return result
}
