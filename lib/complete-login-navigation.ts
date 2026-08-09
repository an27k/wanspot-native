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
  const { data: dog, error: dogError } = await supabase
    .from('dogs')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  track('login_completed')
  // 通信・権限エラーを「未登録」と扱うと、既存ユーザーをオンボーディングへ戻し、
  // 愛犬プロフィールを入力内容で上書きし得る。判定不能時は既存データを守る側へ倒す。
  if (dogError) {
    console.warn('[completeLoginNavigation] dog lookup failed', dogError.message)
    router.replace('/(tabs)')
    return
  }
  if (!dog) {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY)
    router.replace('/onboarding/dog')
  } else {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, '1')
    router.replace('/(tabs)')
  }
}
