import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { LoadingDogSvg } from '@/components/common/LoadingDog'
import { useAuth } from '@/context/AuthContext'
import { useAppTheme } from '@/context/ThemeContext'
import { ONBOARDING_COMPLETE_KEY } from '@/lib/onboarding-constants'
import { supabase } from '@/lib/supabase'
import { hasChosenGuest } from '@/lib/continue-as-guest'

type Gate = 'loading' | 'entry' | 'onboard' | 'tabs'

export default function Index() {
  const { session, loading: authLoading } = useAuth()
  const { colors } = useAppTheme()
  const [gate, setGate] = useState<Gate>('loading')

  useEffect(() => {
    if (authLoading) return

    let cancelled = false
    void (async () => {
      /*
        入口を1枚置く。ほとんどの人はここで初めてアプリに触るので、主役は新規登録。
        セッションは端末に残るため、この画面を見るのは新規か再インストールした人だけ。

        ただし「登録しないで使う」を一度選んだ端末はそのままタブへ送る。地図・
        イベント一覧はアカウント不要の機能なので、そこをログイン壁の奥に置き続けると
        Apple 5.1.1(v) に触れる（2026-08-16・ビルド246で却下）。
      */
      if (!session) {
        const guest = await hasChosenGuest()
        if (cancelled) return
        setGate(guest ? 'tabs' : 'entry')
        return
      }

      const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      if (cancelled) return
      if (completed === '1') {
        setGate('tabs')
        return
      }

      const { data, error } = await supabase
        .from('dogs')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      // 通信失敗は「犬が未登録」と区別する。取り違えるとオンボーディングに戻され、
      // 既存の愛犬情報（写真含む）が入力し直しで上書きされてしまう
      if (error) {
        setGate('tabs')
        return
      }
      if (!data) {
        await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY)
        if (!cancelled) setGate('onboard')
      } else {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, '1')
        if (!cancelled) setGate('tabs')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session, authLoading])

  if (authLoading || gate === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.paper,
        }}
      >
        <LoadingDogSvg size={72} />
      </View>
    )
  }
  if (gate === 'entry') return <Redirect href="/(auth)/signup" />
  if (gate === 'onboard') return <Redirect href="/onboarding/dog" />
  return <Redirect href="/(tabs)" />
}
