import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import type { DogProfile } from '@/lib/dog-display'
import { supabase } from '@/lib/supabase'

export function useDogProfile() {
  const [dog, setDog] = useState<DogProfile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
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
    const { data: dogData } = await supabase.from('dogs').select('*').eq('user_id', user.id).maybeSingle()
    if (dogData) {
      const next = {
        ...(dogData as DogProfile),
        gender: (dogData as { gender?: 'male' | 'female' | null }).gender ?? null,
      }
      setDog(next)
      setLoading(false)
      return next
    }
    setDog(null)
    setLoading(false)
    return null
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  return { dog, setDog, userId, loading, reload: load }
}
