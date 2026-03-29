import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

type Gate = 'loading' | 'login' | 'onboard' | 'tabs'

export default function Index() {
  const { session, loading: authLoading } = useAuth()
  const [gate, setGate] = useState<Gate>('loading')

  useEffect(() => {
    if (authLoading) return

    let cancelled = false
    void (async () => {
      // ログアウト直後は Context の session がまだ残っている一方で API は未認証のため、
      // users が取れずオンボーディングへ誤遷移する。getSession() を真実とする。
      const {
        data: { session: live },
      } = await supabase.auth.getSession()
      if (cancelled) return

      if (!live) {
        setGate('login')
        return
      }

      const { data } = await supabase.from('users').select('id').eq('id', live.user.id).maybeSingle()
      if (cancelled) return
      if (!data) setGate('onboard')
      else setGate('tabs')
    })()

    return () => {
      cancelled = true
    }
  }, [session, authLoading])

  if (authLoading || gate === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }
  if (gate === 'login') return <Redirect href="/(auth)/login" />
  if (gate === 'onboard') return <Redirect href="/onboarding/location" />
  return <Redirect href="/(tabs)" />
}
