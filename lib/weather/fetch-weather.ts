import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { getGoogleMapsAndroidApiKey, getGoogleMapsIosApiKey } from '@/lib/google-maps-config'

function getGoogleMapsApiKeyForWeather(): string {
  return Platform.OS === 'android'
    ? getGoogleMapsAndroidApiKey()
    : getGoogleMapsIosApiKey()
}

/** アプリ内で扱う正規化済みの天気区分 */
export type WeatherCondition =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'thunder'
  | 'fog'
  | 'wind'

export type CurrentWeather = { tempC: number; condition: WeatherCondition }

/** Google Weather API の weatherCondition.type を正規化区分へ */
function conditionFromGoogleType(type: string | undefined): WeatherCondition {
  const t = (type ?? '').toUpperCase()
  if (t.includes('THUNDER')) return 'thunder'
  if (
    t.includes('SNOW') ||
    t.includes('FLURR') ||
    t.includes('SLEET') ||
    t.includes('ICE') ||
    t.includes('HAIL') ||
    t.includes('BLIZZARD') ||
    t.includes('WINTRY')
  )
    return 'snow'
  if (t.includes('RAIN') || t.includes('SHOWER') || t.includes('DRIZZLE')) return 'rain'
  if (t.includes('FOG') || t.includes('MIST') || t.includes('HAZE')) return 'fog'
  if (t.includes('WIND')) return 'wind'
  if (t.includes('PARTLY') || t === 'MOSTLY_CLEAR') return 'partly'
  if (t.includes('CLOUD')) return 'cloudy'
  if (t.includes('CLEAR')) return 'clear'
  return 'clear'
}

/** WMO weather_code を正規化区分へ（Open-Meteo フォールバック用） */
export function conditionFromWmo(code: number): WeatherCondition {
  if (code === 0) return 'clear'
  if (code <= 3) return 'partly'
  if (code <= 48) return code <= 45 ? 'cloudy' : 'fog'
  if (code <= 67) return 'rain'
  if (code <= 77) return 'snow'
  if (code <= 82) return 'rain'
  if (code <= 86) return 'snow'
  return 'thunder'
}

/** Google Maps Platform Weather API（要 Weather API 有効化） */
async function fetchFromGoogle(
  lat: number,
  lng: number,
  key: string
): Promise<CurrentWeather | null> {
  try {
    const url =
      `https://weather.googleapis.com/v1/currentConditions:lookup` +
      `?key=${key}&location.latitude=${lat}&location.longitude=${lng}&unitsSystem=METRIC`
    // iOS バンドルID制限のあるキーでも REST が通るようにヘッダーを付与
    const headers: Record<string, string> = {}
    if (Platform.OS === 'ios') {
      const bundleId = Constants.expoConfig?.ios?.bundleIdentifier
      if (bundleId) headers['X-Ios-Bundle-Identifier'] = bundleId
    }
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    const json = (await res.json()) as {
      temperature?: { degrees?: number }
      weatherCondition?: { type?: string }
    }
    const t = json.temperature?.degrees
    if (typeof t !== 'number') return null
    return { tempC: Math.round(t), condition: conditionFromGoogleType(json.weatherCondition?.type) }
  } catch {
    return null
  }
}

/** Open-Meteo（APIキー不要・無料）フォールバック */
async function fetchFromOpenMeteo(lat: number, lng: number): Promise<CurrentWeather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number }
    }
    const t = json.current?.temperature_2m
    if (typeof t !== 'number') return null
    return { tempC: Math.round(t), condition: conditionFromWmo(json.current?.weather_code ?? 0) }
  } catch {
    return null
  }
}

/**
 * 現在地の現在気温・天気区分を取得。
 * 既定で Google Weather API を使用し、未設定/失敗時は Open-Meteo にフォールバック。
 */
export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<CurrentWeather | null> {
  const key = getGoogleMapsApiKeyForWeather()
  if (key) {
    const g = await fetchFromGoogle(lat, lng, key)
    if (g) return g
  }
  return fetchFromOpenMeteo(lat, lng)
}
