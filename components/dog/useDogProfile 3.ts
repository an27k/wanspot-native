import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import type { DogProfile } from '@/lib/dog-display'
import { CACHE_TTL, fetchWithCache } from '@/lib/client-cache'
import { setAnalyticsDogProfile } from '@/lib/analytics-context'
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
    // getUser() は毎回 Supabase Auth サーバーへの検証リクエストが走り、
    // 画面フォーカス毎に呼ばれるこの hook では店舗詳細の AI レビュー表示を無駄に遅らせる。
    // 犬プロフィール読み込みはセキュリティ境界ではないため、ローカル保存のセッションで十分。
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user ?? null
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
    // 分析文脈へ供給（イベント時点の犬種・サイズ・月齢のスナップショットになる）。
    // 誕生日そのものは送らず、月齢に変換してから記録する
    setAnalyticsDogProfile(
      cachedDog?.breed ?? null,
      cachedDog?.size ?? null,
      cachedDog?.id ?? null,
      cachedDog?.birthday ?? null
    )
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
