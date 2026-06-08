import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import type { DogProfile } from '@/lib/dog-display'
import { CACHE_TTL, fetchWithCache } from '@/lib/client-cache'
import { supabase } from '@/lib/supabase'

function toDogProfile(dogData: Record<string, unknown>): DogProfile {
  return {
    ...(dogData as DogProfile),
    gender: (dogData as { gender?: 'male' | 'female' | null }).gender ?? null,
  }
}

export function useDogProfile() {
  const [dog, setDog] = useState<DogProfile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (force = false) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUserId(null)
      setDog(null)
      setLoading(false)
      return null
    }
    setUserId(user.id)

    const cacheKey = `profile:dog:${user.id}`
    const { data: cachedDog } = await fetchWithCache(
      cacheKey,
      CACHE_TTL.DOG_PROFILE_MS,
      async () => {
        const { data: dogData } = await supabase.from('dogs').select('*').eq('user_id', user.id).maybeSingle()
        if (!dogData) return null
        return toDogProfile(dogData as Record<string, unknown>)
      },
      { force }
    )

    setDog(cachedDog)
    setLoading(false)
    return cachedDog
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  return { dog, setDog, userId, loading, reload: () => load(true) }
}
