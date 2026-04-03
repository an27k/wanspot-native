import { supabase } from '@/lib/supabase'
import { track } from '@/lib/analytics'

type ReplaceRouter = { replace: (href: string) => void }

/** メール / OAuth 共通: ログイン後の遷移（プロフィール有無で分岐） */
export async function completeLoginNavigation(router: ReplaceRouter): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle()
  track('login_completed')
  if (!profile) router.replace('/onboarding/location')
  else router.replace('/(tabs)')
}
