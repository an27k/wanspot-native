import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import { ONBOARDING_COMPLETE_KEY } from '@/lib/onboarding-constants'

type ReplaceRouter = { replace: (href: string) => void }

/** メール / OAuth 共通: ログイン後の遷移（愛犬プロフィール有無で分岐） */
export async function completeLoginNavigation(router: ReplaceRouter): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  // 犬中心リデザイン: オンボーディング完了の判定は「dogs 行の有無」。
  const { data: dog } = await supabase.from('dogs').select('id').eq('user_id', user.id).maybeSingle()
  track('login_completed')
  if (!dog) {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY)
    router.replace('/onboarding/location')
  } else {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, '1')
    router.replace('/(tabs)')
  }
}
