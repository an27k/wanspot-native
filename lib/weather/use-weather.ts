import { useEffect, useState } from 'react'
import { fetchCurrentWeather, type CurrentWeather } from '@/lib/weather/fetch-weather'

/** 現在地の天気を取得して10分ごとに更新する共通フック */
export function useWeather(location: { lat: number; lng: number } | null): CurrentWeather | null {
  const [weather, setWeather] = useState<CurrentWeather | null>(null)
  useEffect(() => {
    if (!location) return
    let cancelled = false
    const load = () =>
      void fetchCurrentWeather(location.lat, location.lng).then((w) => {
        if (!cancelled && w) setWeather(w)
      })
    load()
    const id = setInterval(load, 600_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [location?.lat, location?.lng])
  return weather
}
