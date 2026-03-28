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
    if (!session) {
      setGate('login')
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('users').select('id').eq('id', session.user.id).maybeSingle()
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
  if (gate === 'onboard') return <Redirect href="/onboarding/dog" />
  return <Redirect href="/(tabs)" />
}
