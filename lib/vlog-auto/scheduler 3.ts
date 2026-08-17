/**
 * 提案スケジューラ — 完成報酬（VLOG）を「いつ・どれを・どんな文言で」届けるか。
 *
 * DAU設計は2ストリーム（docs/auto-vlog-engine.md §3）:
 *  1) 撮影リズム（capture-rhythm.ts）— 1時間1スロットの記録ナッジ。日中のループ
 *  2) 完成報酬（このモジュール）— 記録した日は毎夕 Daily が必ず届く（E2の約束）。
 *     日曜夕方は Daily が「今週のスペシャル」（weekly）に昇格して置き換わる。
 *
 * みてね型の運用前提: 報酬は「制限して出し惜しみ」しない。記録があれば毎日届く。
 * クールダウンは同一エピソードの再提案（dismiss後のしつこさ）防止にのみ使う。
 * 純関数＋状態reducer のみ。通知発火・永続化は呼び出し側の責務。
 */
import {
  OFFER_COOLDOWN_HOURS,
  OFFER_PRIORITY,
  REWARD_OFFER_HOUR,
} from '@/lib/vlog-auto/constants'
import { localDateKey, type VlogEpisode, type VlogEpisodeKind } from '@/lib/vlog-auto/episode'
import { assessEpisodeReadiness, type VlogReadiness } from '@/lib/vlog-auto/readiness'

export type VlogOfferOutcome = 'shown' | 'generated' | 'dismissed'

/** 呼び出し側が永続化する提案履歴（JSONシリアライズ可能） */
export type AutoVlogSchedulerState = {
  /** episode.key → 最終提案時刻(ISO)と結果 */
  offers: Record<string, { offeredAt: string; outcome: VlogOfferOutcome }>
  /** 種別ごとの最終提案時刻(ISO) */
  lastOfferAtByKind: Partial<Record<VlogEpisodeKind, string>>
}

export const EMPTY_SCHEDULER_STATE: AutoVlogSchedulerState = {
  offers: {},
  lastOfferAtByKind: {},
}

export type VlogOffer = {
  episode: VlogEpisode
  readiness: VlogReadiness
  priority: number
  /** 通知・提案カードの見出し */
  headline: string
  /** 通知本文（E2: 「できている」を伝える。命令形にしない） */
  body: string
  /** almost のときの「あと少し」ナッジ文言（ready では null） */
  nudge: string | null
}

function hoursBetween(aIso: string, b: Date): number {
  return (b.getTime() - new Date(aIso).getTime()) / 3_600_000
}

/** 種別ごとの提案タイミング条件。リズム設計（E3）:
 *  夕方=完成報酬の時間、朝=思い出（記念日）の時間、イベント=即時 */
function isTimelyForKind(kind: VlogEpisodeKind, now: Date): boolean {
  switch (kind) {
    case 'daily':
      // その日の記録が出揃う夕方以降（毎日の定期報酬）
      return now.getHours() >= REWARD_OFFER_HOUR
    case 'weekly':
      // 日曜夕方。Daily の枠がスペシャルに昇格する
      return now.getDay() === 0 && now.getHours() >= REWARD_OFFER_HOUR
    case 'monthly': {
      // 月末3日間 or 翌月1日
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      return now.getDate() >= last - 2 || now.getDate() === 1
    }
    case 'anniversary':
      // 朝〜日中（既存 memory-anniversary 通知と同帯）。夕方の報酬枠と競合しない
      return now.getHours() >= 8 && now.getHours() < REWARD_OFFER_HOUR
    case 'event':
      // 即時（会場滞在中〜直後が共有動機のピーク）
      return true
  }
}

function weeklyBody(episode: VlogEpisode, sec: number): string {
  const stats = episode.weeklyStats
  if (!stats) return `今週の思い出を約${sec}秒のスペシャルにまとめました。`
  const parts: string[] = [`記録${stats.recordedDayCount}日分`]
  if (stats.spotCount > 0) parts.push(`おでかけ${stats.spotCount}スポット`)
  if (stats.topRatedSpot) parts.push(`ベストは★${stats.topRatedSpot.rating}の${stats.topRatedSpot.name}`)
  return `${parts.join('・')}。今週のスペシャルVlog（約${sec}秒）ができました。`
}

function offerCopy(episode: VlogEpisode, readiness: VlogReadiness): Pick<VlogOffer, 'headline' | 'body' | 'nudge'> {
  const sec = readiness.estimatedDurationSec
  switch (episode.kind) {
    case 'daily':
      return {
        headline: `${episode.title}のVlogができました 🎬`,
        body: `きょうの記録${readiness.usableCutCount}カットを約${sec}秒にまとめました。`,
        nudge: readiness.grade === 'almost' ? 'あと1枚たすと、きょうのVlogがつくれます 🐾' : null,
      }
    case 'weekly':
      return {
        headline: `${episode.title} — 今週のスペシャル 🎬✨`,
        body: weeklyBody(episode, sec),
        nudge: readiness.grade === 'almost' ? '今週あと1回記録すると、スペシャルVlogがつくれます' : null,
      }
    case 'monthly':
      return {
        headline: `${episode.title}のVlogができています 🎬`,
        body: `今月の思い出を約${sec}秒にまとめました。確認して書き出すだけです。`,
        nudge: null,
      }
    case 'anniversary':
      return {
        headline: `${episode.title} 🐾`,
        body: `${episode.title}の思い出をVlogでふりかえりませんか？`,
        nudge: null,
      }
    case 'event':
      return {
        headline: `${episode.title}のVlogができました 🎬`,
        body: `イベントの思い出を約${sec}秒にまとめました。ハッシュタグ付きでそのままシェアできます。`,
        nudge: readiness.grade === 'almost' ? '会場でもう1枚撮ると、イベントVlogがつくれます' : null,
      }
  }
}

/**
 * 提案候補を決定する。返り値は優先度順で、先頭が「いま出すべき1件」。
 * - generated / dismissed 済み・時間帯外・insufficient は除外
 * - 同一種別のクールダウンは「同じ枠を1日に何度も鳴らさない」ためだけに使う
 * - weekly が成立する日曜夕方は daily を落とす（Daily→スペシャルへの昇格）
 * - almost はナッジとして返す（通知は ready のみ、が推奨運用）
 */
export function planOffers(
  episodes: VlogEpisode[],
  state: AutoVlogSchedulerState,
  now: Date
): VlogOffer[] {
  const offers: VlogOffer[] = []
  for (const episode of episodes) {
    const history = state.offers[episode.key]
    if (history?.outcome === 'generated') continue
    if (history?.outcome === 'dismissed') continue
    if (!isTimelyForKind(episode.kind, now)) continue

    // 同一枠の連打防止（同じ日にもう出した種別は出さない）
    const lastOfferAt = state.lastOfferAtByKind[episode.kind]
    if (lastOfferAt && hoursBetween(lastOfferAt, now) < OFFER_COOLDOWN_HOURS[episode.kind]) continue

    const readiness = assessEpisodeReadiness(episode)
    if (readiness.grade === 'insufficient') continue

    offers.push({
      episode,
      readiness,
      priority: OFFER_PRIORITY[episode.kind],
      ...offerCopy(episode, readiness),
    })
  }

  // Daily → Weekly スペシャルへの昇格: weekly が ready で出せるなら daily は出さない
  const hasReadyWeekly = offers.some((o) => o.episode.kind === 'weekly' && o.readiness.grade === 'ready')
  const filtered = hasReadyWeekly ? offers.filter((o) => o.episode.kind !== 'daily') : offers

  return filtered.sort(
    (a, b) => b.priority - a.priority || b.readiness.score - a.readiness.score
  )
}

/** きょう完成報酬（daily/weekly）をまだ出していないか（通知配線側の補助） */
export function hasPendingRewardToday(state: AutoVlogSchedulerState, now: Date): boolean {
  const todayKey = localDateKey(now.toISOString())
  return !Object.entries(state.offers).some(
    ([key, o]) =>
      (key.startsWith('daily:') || key.startsWith('weekly:')) &&
      localDateKey(o.offeredAt) === todayKey
  )
}

/** 提案の結果を状態に反映する reducer（呼び出し側で永続化） */
export function applyOfferOutcome(
  state: AutoVlogSchedulerState,
  episodeKey: string,
  kind: VlogEpisodeKind,
  outcome: VlogOfferOutcome,
  now: Date
): AutoVlogSchedulerState {
  return {
    offers: {
      ...state.offers,
      [episodeKey]: { offeredAt: now.toISOString(), outcome },
    },
    lastOfferAtByKind: {
      ...state.lastOfferAtByKind,
      [kind]: now.toISOString(),
    },
  }
}
