/**
 * 自動VLOG生成エンジン（SetLog × みてね型）のエントリポイント。
 * fetchVisitPlates の結果と現在時刻を渡すと、
 *  - captureDay: きょうの撮影スロット表（1時間1スロット。アルバム先頭UI・カメラ導線の状態源）
 *  - captureNudge: いま出すべき撮影ナッジ（日中のリズム）
 *  - offers: 完成報酬の提案（毎夕のDaily / 日曜夕方のWeeklyスペシャル等）
 *  - milestones: きょうの節目（誕生日・記録日数）
 * を返す。ここまで純ロジック。通知発火・生成実行（build-payload → render-client）・
 * 状態の永続化は導入時に配線する。設計と戦略背景は docs/auto-vlog-engine.md 参照。
 */
import type { DogProfile } from '@/lib/dog-display'
import type { VisitPlate } from '@/lib/visits-memories'
import {
  buildCaptureDay,
  planCaptureNudge,
  type CaptureDay,
  type CaptureNudge,
  type CaptureNudgeState,
} from '@/lib/vlog-auto/capture-rhythm'
import { buildEpisodes, type EventSpotResolver, type VlogEpisode } from '@/lib/vlog-auto/episode'
import { detectMilestones, type CircleMilestone } from '@/lib/vlog-auto/family-circle'
import {
  planOffers,
  type AutoVlogSchedulerState,
  type VlogOffer,
} from '@/lib/vlog-auto/scheduler'

export {
  applyCaptureNudge,
  buildCaptureDay,
  calcStreakDays,
  EMPTY_CAPTURE_NUDGE_STATE,
  planCaptureNudge,
  suggestContextForHour,
  type CaptureDay,
  type CaptureNudge,
  type CaptureNudgeState,
  type CaptureSlot,
  type CaptureSlotStatus,
} from '@/lib/vlog-auto/capture-rhythm'
export {
  buildEpisodes,
  type EventSpotInfo,
  type EventSpotResolver,
  type VlogEpisode,
  type VlogEpisodeKind,
  type WeeklyStats,
} from '@/lib/vlog-auto/episode'
export {
  detectMilestones,
  EMPTY_CIRCLE_NOTIFY_STATE,
  planCircleNotifications,
  type CircleActivity,
  type CircleActivityKind,
  type CircleMember,
  type CircleMilestone,
  type CircleNotification,
  type CircleNotifyState,
  type CircleRole,
} from '@/lib/vlog-auto/family-circle'
export { assessEpisodeReadiness, type VlogReadiness, type VlogReadinessGrade } from '@/lib/vlog-auto/readiness'
export {
  applyOfferOutcome,
  EMPTY_SCHEDULER_STATE,
  hasPendingRewardToday,
  planOffers,
  type AutoVlogSchedulerState,
  type VlogOffer,
  type VlogOfferOutcome,
} from '@/lib/vlog-auto/scheduler'
export { buildVlogShareKit, pickSpotNames, type VlogShareKit } from '@/lib/vlog-auto/share-kit'

export type AutoVlogPlan = {
  /** きょうの撮影スロット表（撮影リズムUIの状態源） */
  captureDay: CaptureDay
  /** いま出すべき撮影ナッジ（null なら出さない） */
  captureNudge: CaptureNudge | null
  /** 完成報酬の提案。優先度順、[0] が「いま出すべき1件」 */
  offers: VlogOffer[]
  /** きょうの節目（誕生日・記録日数マイルストーン） */
  milestones: CircleMilestone[]
  /** 判定対象になった全エピソード（デバッグ・テレメトリ用） */
  episodes: VlogEpisode[]
}

export function planAutoVlogs(input: {
  plates: VisitPlate[]
  schedulerState: AutoVlogSchedulerState
  captureNudgeState: CaptureNudgeState
  dog: Pick<DogProfile, 'name' | 'birthday'> | null
  now?: Date
  resolveEventSpot?: EventSpotResolver | null
}): AutoVlogPlan {
  const now = input.now ?? new Date()
  const dogName = input.dog?.name?.trim() || null

  const captureDay = buildCaptureDay(input.plates, now)
  const captureNudge = planCaptureNudge(captureDay, input.captureNudgeState, now, dogName)

  const episodes = buildEpisodes({
    plates: input.plates,
    now,
    dogName,
    resolveEventSpot: input.resolveEventSpot ?? null,
  })
  const offers = planOffers(episodes, input.schedulerState, now)

  const milestones = input.dog
    ? detectMilestones({ plates: input.plates, dog: input.dog, now })
    : []

  return { captureDay, captureNudge, offers, milestones, episodes }
}
