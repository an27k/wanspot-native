import { useCallback, useEffect, useState } from 'react'
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

  const refetch = useCallback(() => {
    if (!location) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchCurrentWeather(location.lat, location.lng).then((w) => {
      setData(w)
      setLoading(false)
    })
  }, [location?.lat, location?.lng])

  useEffect(() => {
    if (!location) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchCurrentWeather(location.lat, location.lng).then((w) => {
      if (!cancelled) {
        setData(w)
        setLoading(false)
      }
    })
    const id = setInterval(() => {
      void fetchCurrentWeather(location.lat, location.lng).then((w) => {
        if (!cancelled) setData(w)
      })
    }, 600_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [location?.lat, location?.lng])

  return { data, loading, needsLocation: !location, refetch }
}
