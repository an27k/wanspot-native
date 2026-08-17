import { getAnalyticsContext } from '@/lib/analytics-context'
import { getAnonymousId } from '@/lib/anonymous-id'
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
  | 'ai_plan_adopted'
  | 'vlog_generate'
  | 'share'
  /** アプリ起動（セッションの起点。位置・犬属性のカバレッジを確保する） */
  | 'app_open'
  /** 地図の表示（現在地周辺のブラウズ行動） */
  | 'map_view'
  /** 地図検索での地点確定（どのエリアに関心があるか） */
  | 'area_search'
  /** イベント詳細の閲覧 */
  | 'event_view'
  /** ログイン誘導を出した（どの機能で止めたか） */
  | 'login_prompt'

type LogUserEventParams = {
  eventType: UserEventType
  spotId?: string | null
  props?: Record<string, unknown>
  userId?: string | null
}

/**
 * 分析用イベントログ — fire-and-forget（UI をブロックしない）。
 * 未ログインでも anonymous_id で蓄積し、ログイン後は user_id と両方残す。
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
      const anonymousId = await getAnonymousId()

      const ctx = getAnalyticsContext()
      const row: Record<string, unknown> = {
        event_type: params.eventType,
        anonymous_id: anonymousId,
        props: {
          ...(params.props ?? {}),
          anonymous_id: anonymousId,
          is_guest: !userId,
        },
        lat: ctx.lat,
        lng: ctx.lng,
        dog_breed: ctx.dog_breed,
        dog_size: ctx.dog_size,
        dog_id: ctx.dog_id,
        dog_age_months: ctx.dog_age_months,
        platform: ctx.platform,
        app_version: ctx.app_version,
        session_id: ctx.session_id,
      }
      if (userId) row.user_id = userId
      if (params.spotId) row.spot_id = params.spotId

      const { error } = await supabase.from('user_events').insert(row)
      if (error) console.warn('[user_events]', error.code, error.message)
    } catch (e) {
      console.warn('[user_events]', e instanceof Error ? e.message : String(e))
    }
  })()
}
