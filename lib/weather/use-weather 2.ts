import { useCallback, useEffect, useState } from 'react'
import { CACHE_TTL, geoBucket, isCacheFresh, readCache, writeCache } from '@/lib/client-cache'
import { fetchCurrentWeather, type CurrentWeather } from '@/lib/weather/fetch-weather'

export type WeatherState = {
  data: CurrentWeather | null
  loading: boolean
  /** 位置が取れず天気APIを呼べていない */
  needsLocation: boolean
  refetch: () => void
}

/** 現在地の天気を取得して10分ごとに更新する共通フック */
export function useWeather(location: { lat: number; lng: number } | null): WeatherState {
  const [data, setData] = useState<CurrentWeather | null>(null)
  const [loading, setLoading] = useState(false)

  const weatherKey =
    location != null ? `weather:${geoBucket(location.lat, location.lng)}` : null

  const refetch = useCallback(() => {
    if (!location || !weatherKey) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchCurrentWeather(location.lat, location.lng)
      .then((w) => {
        writeCache(weatherKey, w)
        setData(w)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [location?.lat, location?.lng, weatherKey])

  useEffect(() => {
    if (!location || !weatherKey) {
      setData(null)
      setLoading(false)
      return
    }

    const cached = readCache<CurrentWeather | null>(weatherKey)
    if (cached !== undefined) {
      setData(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }

    let cancelled = false

    const refresh = async (withLoading: boolean) => {
      if (withLoading && !cancelled) setLoading(true)
      try {
        const w = await fetchCurrentWeather(location.lat, location.lng)
        if (!cancelled) {
          writeCache(weatherKey, w)
          setData(w)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    if (!isCacheFresh(weatherKey, CACHE_TTL.WEATHER_MS)) {
      void refresh(cached === undefined)
    }

    const id = setInterval(() => {
      void refresh(false)
    }, CACHE_TTL.WEATHER_MS)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [location?.lat, location?.lng, weatherKey])

  return { data, loading, needsLocation: !location, refetch }
}
