/**
 * 家族サークル — 「みてね」型コミュニティの往復ループ（P8 の中核ロジック）。
 *
 * 戦略前提: 愛犬の扱いは子供に近い。みてねの「親が上げる→祖父母が見る・反応する→
 * 親が通知を受けてまた上げる」の相互強化ループを犬に翻訳する。子供と違い
 * 「子供の時期」が終わらないため LTV は人間の子供より高い（docs/auto-vlog-engine.md §1）。
 *
 * データモデル（visits/memories の共有・RLS再設計）が未着手のため、
 * ここでは スキーマ非依存の純ロジック（型・通知ループ・マイルストーン検出）のみを定義する。
 * activities の取得・通知発火・永続化は導入時に配線する。
 */
import { calcDogAge, type DogProfile } from '@/lib/dog-display'
import type { VisitPlate } from '@/lib/visits-memories'
import { CIRCLE_DIGEST_COOLDOWN_HOURS, RECORD_DAY_MILESTONES } from '@/lib/vlog-auto/constants'
import { localDateKey } from '@/lib/vlog-auto/episode'

/** みてねの「親 / 家族 / 祖父母」を犬に翻訳したロール */
export type CircleRole =
  /** 飼い主本人（アップロードの主体） */
  | 'owner'
  /** 同居家族・パートナー（撮る側にも見る側にもなる） */
  | 'family'
  /** 実家の親・散歩仲間など「見る側」（みてねの祖父母層。反応が owner の継続燃料） */
  | 'extended'

export type CircleMember = {
  memberId: string
  role: CircleRole
  displayName: string
}

export type CircleActivityKind =
  | 'capture_added'
  | 'daily_vlog_generated'
  | 'weekly_special_generated'
  | 'reaction'
  | 'comment'

export type CircleActivity = {
  id: string
  actorId: string
  kind: CircleActivityKind
  /** ISO時刻 */
  at: string
  /** 対象（episode.key / memory id など） */
  targetKey: string | null
}

export type CircleNotification = {
  /** 通知の宛先メンバー */
  recipientId: string
  headline: string
  body: string
  /** タップ時の遷移先種別（配線側でルートに解決） */
  target: 'album' | 'vlog' | null
}

/** 呼び出し側が永続化するダイジェスト履歴 */
export type CircleNotifyState = {
  /** recipientId → 最終ダイジェスト送信時刻(ISO) */
  lastDigestAt: Record<string, string>
}

export const EMPTY_CIRCLE_NOTIFY_STATE: CircleNotifyState = { lastDigestAt: {} }

function hoursBetween(aIso: string, b: Date): number {
  return (b.getTime() - new Date(aIso).getTime()) / 3_600_000
}

/**
 * みてね型の通知ループを組み立てる。
 * - 見る側（family/extended）へ: 新着をまとめたダイジェスト（連打しない。みてね同様バッチ）
 * - 上げた側（owner等）へ: リアクション・コメントは即時（継続の燃料なので間引かない）
 * - weekly スペシャル完成はサークル全員へ（週1の「家族で見る」儀式に育てる）
 */
export function planCircleNotifications(input: {
  members: CircleMember[]
  /** 前回処理以降の未通知アクティビティ（時系列昇順） */
  activities: CircleActivity[]
  state: CircleNotifyState
  dogName: string
  now: Date
}): { notifications: CircleNotification[]; nextState: CircleNotifyState } {
  const { members, activities, state, dogName, now } = input
  const notifications: CircleNotification[] = []
  const nextDigestAt = { ...state.lastDigestAt }

  const uploads = activities.filter((a) => a.kind === 'capture_added')
  const weeklySpecials = activities.filter((a) => a.kind === 'weekly_special_generated')
  const reactions = activities.filter((a) => a.kind === 'reaction' || a.kind === 'comment')

  // 1) 新着ダイジェスト → 上げた本人以外の全員へ（クールダウン付き）
  if (uploads.length > 0) {
    const uploaderIds = new Set(uploads.map((u) => u.actorId))
    for (const member of members) {
      if (uploads.every((u) => u.actorId === member.memberId)) continue // 全部自分の投稿
      const last = state.lastDigestAt[member.memberId]
      if (last && hoursBetween(last, now) < CIRCLE_DIGEST_COOLDOWN_HOURS) continue
      const othersCount = uploads.filter((u) => u.actorId !== member.memberId).length
      if (othersCount === 0) continue
      notifications.push({
        recipientId: member.memberId,
        headline: `${dogName}の新しい記録が${othersCount}件 🐾`,
        body: `きょうの${dogName}が増えています。見てみませんか？`,
        target: 'album',
      })
      nextDigestAt[member.memberId] = now.toISOString()
    }
    void uploaderIds
  }

  // 2) リアクション・コメント → 投稿主に即時（誰が反応したかを載せる）
  for (const reaction of reactions) {
    const actor = members.find((m) => m.memberId === reaction.actorId)
    for (const member of members) {
      if (member.memberId === reaction.actorId) continue
      // 反応の対象投稿主が特定できないため、owner/family 全員に届ける最小実装。
      // 対象特定は activities に投稿主IDが入るスキーマが決まり次第置き換える
      if (member.role === 'extended') continue
      notifications.push({
        recipientId: member.memberId,
        headline: `${actor?.displayName ?? 'かぞく'}さんが${reaction.kind === 'comment' ? 'コメント' : 'リアクション'} 💬`,
        body: `${dogName}の記録に${reaction.kind === 'comment' ? 'コメントが付きました' : 'リアクションがありました'}`,
        target: 'album',
      })
    }
  }

  // 3) weekly スペシャル完成 → サークル全員（作った本人以外）
  for (const special of weeklySpecials) {
    for (const member of members) {
      if (member.memberId === special.actorId) continue
      notifications.push({
        recipientId: member.memberId,
        headline: `今週の${dogName} スペシャルVlog 🎬✨`,
        body: `今週の${dogName}のまとめができました。家族で見てみませんか？`,
        target: 'vlog',
      })
    }
  }

  return { notifications, nextState: { lastDigestAt: nextDigestAt } }
}

// ---- マイルストーン（LTVフック: 節目が共有・プレミアム転換の山になる） ----

export type CircleMilestone = {
  key: string
  headline: string
  body: string
}

/** 誕生日・うちの子記念日・記録日数の節目を検出する。
 *  当日のみ返す（通知の重複排除は key ベースで呼び出し側が行う） */
export function detectMilestones(input: {
  plates: VisitPlate[]
  dog: Pick<DogProfile, 'name' | 'birthday'>
  /** 初回記録日（うちの子記念日の代替。プロフィールに迎え日が増えたら差し替え） */
  now: Date
}): CircleMilestone[] {
  const { plates, dog, now } = input
  const dogName = dog.name?.trim() || 'うちの子'
  const todayKey = localDateKey(now.toISOString())
  const milestones: CircleMilestone[] = []

  // 誕生日
  if (dog.birthday?.trim()) {
    const [, bm, bd] = dog.birthday.split('-')
    if (todayKey.slice(5) === `${bm}-${bd}`) {
      const age = calcDogAge(dog.birthday)
      milestones.push({
        key: `birthday:${todayKey}`,
        headline: `${dogName}、お誕生日おめでとう 🎂`,
        body: `きょうで${age}。これまでの思い出をVlogでふりかえりませんか？`,
      })
    }
  }

  // 記録日数の節目（7/30/100/365日）
  const recordedDays = new Set<string>()
  for (const p of plates) {
    if (p.soft_deleted || p.memories.length === 0) continue
    recordedDays.add(localDateKey(p.visited_at))
  }
  const count = recordedDays.size
  if (recordedDays.has(todayKey) && (RECORD_DAY_MILESTONES as readonly number[]).includes(count)) {
    milestones.push({
      key: `record-days:${count}`,
      headline: `記録${count}日目 🎉`,
      body: `${dogName}との記録が${count}日分になりました。ここまでのまとめVlogがつくれます`,
    })
  }

  return milestones
}
