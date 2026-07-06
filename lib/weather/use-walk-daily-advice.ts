import { useCallback, useEffect, useState } from 'react'
import { fetchWalkDailyAdvice, type WalkDailyAdvice } from '@/lib/weather/walk-daily-advice'
import type { WeatherCondition } from '@/lib/weather/fetch-weather'
import type { DogProfile } from '@/lib/dog-display'

export function useWalkDailyAdvice(
  location: { lat: number; lng: number } | null,
  tempC: number | null,
  weatherCondition: WeatherCondition | null | undefined,
  dogSize: DogProfile['size'] | null | undefined,
  dogName: string | null | undefined,
  enabled: boolean
) {
  const [advice, setAdvice] = useState<WalkDailyAdvice | null>(null)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!location) return
    setLoading(true)
    try {
      const next = await fetchWalkDailyAdvice(location.lat, location.lng, tempC, dogName, {
        force: true,
        weatherCondition,
        dogSize,
      })
      setAdvice(next)
    } finally {
      setLoading(false)
    }
  }, [location?.lat, location?.lng, tempC, weatherCondition, dogSize, dogName])

  useEffect(() => {
    if (!enabled || !location) {
      setAdvice(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchWalkDailyAdvice(location.lat, location.lng, tempC, dogName, { weatherCondition, dogSize })
      .then((next) => {
        if (!cancelled) {
          setAdvice(next)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, location?.lat, location?.lng, tempC, weatherCondition, dogSize, dogName])

  return { advice, loading, reload }
}
