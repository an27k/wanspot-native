import * as Location from 'expo-location'
import { conditionFromWmo, type WeatherCondition } from '@/lib/weather/fetch-weather'

export type WalkHourlySlot = {
  hour: number
  tempC: number
  precipProb: number
  condition: WeatherCondition
}

export type WalkEnvironment = {
  dateKey: string
  dateLabel: string
  /** モーダルヘッダー用（例: 港区 · 東京都） */
  areaLabel: string
  lat: number
  lng: number
  prefecture: string | null
  municipality: string | null
  current: {
    tempC: number
    feelsLikeC: number | null
    humidityPct: number | null
    windKmh: number | null
    precipMm: number | null
    condition: WeatherCondition
  }
  today: {
    tempMaxC: number | null
    tempMinC: number | null
    precipProbMax: number | null
    uvMax: number | null
    windMaxKmh: number | null
    condition: WeatherCondition
  }
  hourly: WalkHourlySlot[]
  /** AI・表示用の環境サマリー（気象庁系予報＋Open-Meteo） */
  summaryLines: string[]
}

/** 端末ローカル日（Asia/Tokyo）YYYY-MM-DD */
export function walkAdviceDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(d)
}

export function walkAdviceDateLabel(dateKey = walkAdviceDateKey()): string {
  const d = new Date(`${dateKey}T12:00:00+09:00`)
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(d)
}

const CONDITION_JA: Record<WeatherCondition, string> = {
  clear: '晴れ',
  partly: '晴れ時々くもり',
  cloudy: 'くもり',
  rain: '雨',
  snow: '雪',
  thunder: '雷雨',
  fog: '霧・もや',
  wind: '風が強い',
}

export function weatherConditionJa(c: WeatherCondition): string {
  return CONDITION_JA[c] ?? 'くもり'
}

/** 逆ジオコード結果をヘッダー表示用に整形 */
export function formatWalkAreaLabel(prefecture: string | null, municipality: string | null): string {
  const pref = prefecture?.trim() || ''
  const mun = municipality?.trim() || ''
  if (mun && pref && mun !== pref) return `${mun} · ${pref}`
  return mun || pref || 'お住まいのエリア'
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    const r0 = rows[0]
    return {
      prefecture: r0?.region ?? r0?.subregion ?? null,
      municipality: r0?.city ?? r0?.district ?? r0?.subregion ?? null,
    }
  } catch {
    return { prefecture: null, municipality: null }
  }
}

function pickHourlySlots(
  times: string[],
  temps: number[],
  precip: number[],
  codes: number[],
  nowHour: number,
  dateKey: string,
  maxSlots = 8
): WalkHourlySlot[] {
  const slots: WalkHourlySlot[] = []
  for (let i = 0; i < times.length && slots.length < maxSlots; i++) {
    const t = times[i]
    // 翌日分の予報が「今日の候補」として混ざらないよう、日付部分で今日に限定する
    if (t.slice(0, 10) !== dateKey) continue
    const hour = Number(t.slice(11, 13))
    if (Number.isNaN(hour) || hour < nowHour) continue
    const temp = temps[i]
    if (typeof temp !== 'number') continue
    slots.push({
      hour,
      tempC: Math.round(temp),
      precipProb: Math.round(precip[i] ?? 0),
      condition: conditionFromWmo(codes[i] ?? 0),
    })
  }
  return slots
}

/**
 * 指定日（JST日付キー）の時間帯別スロットだけを軽量取得する。
 * 朝の通知本文の事前計算用 — 翌朝ぶんの予報（forecast_days=2 の範囲）にも使える。
 */
export async function fetchWalkHourlySlotsForDate(
  lat: number,
  lng: number,
  dateKey: string,
  minHour = 0
): Promise<WalkHourlySlot[]> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      timezone: 'Asia/Tokyo',
      forecast_days: '2',
      hourly: ['temperature_2m', 'precipitation_probability', 'weather_code'].join(','),
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    if (!res.ok) return []
    const json = (await res.json()) as {
      hourly?: { time?: string[]; temperature_2m?: number[]; precipitation_probability?: number[]; weather_code?: number[] }
    }
    return pickHourlySlots(
      json.hourly?.time ?? [],
      json.hourly?.temperature_2m ?? [],
      json.hourly?.precipitation_probability ?? [],
      json.hourly?.weather_code ?? [],
      minHour,
      dateKey,
      24
    )
  } catch {
    return []
  }
}

/** Open-Meteo（気象庁系グリッド予報）＋逆ジオコードで散歩向け環境データを取得 */
export async function fetchWalkEnvironment(lat: number, lng: number): Promise<WalkEnvironment | null> {
  const dateKey = walkAdviceDateKey()
  const dateLabel = walkAdviceDateLabel(dateKey)

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      timezone: 'Asia/Tokyo',
      forecast_days: '2',
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'weather_code',
        'wind_speed_10m',
        'precipitation',
      ].join(','),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'uv_index_max',
        'wind_speed_10m_max',
        'weather_code',
      ].join(','),
      hourly: ['temperature_2m', 'precipitation_probability', 'weather_code'].join(','),
    })

    const [geo, res] = await Promise.all([
      reverseGeocode(lat, lng),
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
    ])
    if (!res.ok) return null

    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number
        relative_humidity_2m?: number
        apparent_temperature?: number
        weather_code?: number
        wind_speed_10m?: number
        precipitation?: number
      }
      daily?: {
        time?: string[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_probability_max?: number[]
        uv_index_max?: number[]
        wind_speed_10m_max?: number[]
        weather_code?: number[]
      }
      hourly?: {
        time?: string[]
        temperature_2m?: number[]
        precipitation_probability?: number[]
        weather_code?: number[]
      }
    }

    const cur = json.current
    const tempC = typeof cur?.temperature_2m === 'number' ? Math.round(cur.temperature_2m) : null
    if (tempC == null) return null

    const dailyIdx = json.daily?.time?.findIndex((t) => t === dateKey) ?? 0
    const idx = dailyIdx >= 0 ? dailyIdx : 0

    const todayCode = json.daily?.weather_code?.[idx] ?? cur?.weather_code ?? 0
    const todayCondition = conditionFromWmo(todayCode)
    const currentCondition = conditionFromWmo(cur?.weather_code ?? 0)

    const nowHour = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(
        new Date()
      )
    )

    const hourly = pickHourlySlots(
      json.hourly?.time ?? [],
      json.hourly?.temperature_2m ?? [],
      json.hourly?.precipitation_probability ?? [],
      json.hourly?.weather_code ?? [],
      nowHour,
      dateKey
    )

    const tempMax = json.daily?.temperature_2m_max?.[idx]
    const tempMin = json.daily?.temperature_2m_min?.[idx]
    const precipProb = json.daily?.precipitation_probability_max?.[idx]
    const uv = json.daily?.uv_index_max?.[idx]
    const windMax = json.daily?.wind_speed_10m_max?.[idx]

    const areaLabel = formatWalkAreaLabel(geo.prefecture, geo.municipality)

    const summaryLines = [
      `${dateLabel}・${areaLabel}の気象予報（Open-Meteo / 気象庁系グリッド）`,
      `現在 ${tempC}℃（体感 ${typeof cur?.apparent_temperature === 'number' ? Math.round(cur.apparent_temperature) : '—'}℃）・${weatherConditionJa(currentCondition)}`,
      `今日の予想 ${typeof tempMin === 'number' ? Math.round(tempMin) : '—'}〜${typeof tempMax === 'number' ? Math.round(tempMax) : '—'}℃・降水確率最大 ${typeof precipProb === 'number' ? Math.round(precipProb) : '—'}%`,
      `湿度 ${typeof cur?.relative_humidity_2m === 'number' ? Math.round(cur.relative_humidity_2m) : '—'}%・風 ${typeof cur?.wind_speed_10m === 'number' ? Math.round(cur.wind_speed_10m) : '—'}km/h・UV最大 ${typeof uv === 'number' ? uv.toFixed(1) : '—'}`,
      hourly.length
        ? `これからの時間帯: ${hourly.map((h) => `${h.hour}時${h.tempC}℃/${weatherConditionJa(h.condition)}/降水${h.precipProb}%`).join('、')}`
        : '',
    ].filter(Boolean)

    return {
      dateKey,
      dateLabel,
      areaLabel,
      lat,
      lng,
      prefecture: geo.prefecture,
      municipality: geo.municipality,
      current: {
        tempC,
        feelsLikeC: typeof cur?.apparent_temperature === 'number' ? Math.round(cur.apparent_temperature) : null,
        humidityPct: typeof cur?.relative_humidity_2m === 'number' ? Math.round(cur.relative_humidity_2m) : null,
        windKmh: typeof cur?.wind_speed_10m === 'number' ? Math.round(cur.wind_speed_10m) : null,
        precipMm: typeof cur?.precipitation === 'number' ? cur.precipitation : null,
        condition: currentCondition,
      },
      today: {
        tempMaxC: typeof tempMax === 'number' ? Math.round(tempMax) : null,
        tempMinC: typeof tempMin === 'number' ? Math.round(tempMin) : null,
        precipProbMax: typeof precipProb === 'number' ? Math.round(precipProb) : null,
        uvMax: typeof uv === 'number' ? uv : null,
        windMaxKmh: typeof windMax === 'number' ? Math.round(windMax) : null,
        condition: todayCondition,
      },
      hourly,
      summaryLines,
    }
  } catch {
    return null
  }
}
