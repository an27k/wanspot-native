import { supabase } from '@/lib/supabase'

/** user_events.event_type 初期セット */
export type UserEventType =
  | 'visit'
  | 'like'
  | 'unlike'
  | 'review'
  | 'spot_view'
  | 'search'
  | 'ai_plan_generate'
  | 'vlog_generate'
  | 'share'

type LogUserEventParams = {
  eventType: UserEventType
  spotId?: string | null
  props?: Record<string, unknown>
  userId?: string | null
}

/**
 * 分析用イベントログ — fire-and-forget（UI をブロックしない）。
 * visits / spot_likes 等が正。失敗しても機能に影響させない。
 *
 * TODO(プライバシー): 広告・マーケ用途前にプライバシーポリシーと App Store ラベル更新。
 * 外部提供なし。生ログのエクスポート経路は作らない。
 */
export function logUserEvent(params: LogUserEventParams): void {
  void (async () => {
    try {
      let userId = params.userId ?? null
      if (!userId) {
        const { data } = await supabase.auth.getUser()
        userId = data.user?.id ?? null
      }
      if (!userId) return

      const row: Record<string, unknown> = {
        user_id: userId,
        event_type: params.eventType,
        props: params.props ?? {},
      }
      if (params.spotId) row.spot_id = params.spotId

      const { error } = await supabase.from('user_events').insert(row)
      if (error) console.warn('[user_events]', error.code, error.message)
    } catch (e) {
      console.warn('[user_events]', e instanceof Error ? e.message : String(e))
    }
  })()
}
