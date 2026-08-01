/**
 * 自動VLOG生成エンジン（SetLog × みてね型）のチューニングパラメータ。
 * lib/vlog/constants.ts の v9.5 較正と同様、実運用の生成結果で更新する。
 *
 * 戦略前提（docs/auto-vlog-engine.md §1）:
 * - DAUの心臓は「1時間1スロットの撮影リズム」（SetLog）。提案数の制限ではない
 * - Daily VLOG は毎夕必ず受け取れる報酬（E2）。Weekly はその延長線上の特別版
 * - コミュニティは「みてね」型の家族サークル往復ループ
 */

/** 撮影スロットの間隔（時間）— SetLog の「1時間に1回」 */
export const CAPTURE_SLOT_HOURS = 1
/** 1クリップの最短秒数（「2秒だけ」の儀式） */
export const CAPTURE_MIN_CLIP_SEC = 2
/** 撮影リズムが動く時間帯（犬の生活リズム: 朝散歩〜夜） */
export const CAPTURE_ACTIVE_HOUR_START = 7
export const CAPTURE_ACTIVE_HOUR_END = 21

/** 撮影ナッジ: スロットは毎時開くが、プッシュはこの間隔以上あける（強制しない E3） */
export const CAPTURE_NUDGE_COOLDOWN_HOURS = 2
/** 撮影ナッジの1日上限（通知疲れ防止。スロット自体は無制限に開く） */
export const CAPTURE_NUDGE_MAX_PER_DAY = 3

/** 生成可否: これ未満のカット数ではエピソードを提案しない（救済込み） */
export const MIN_CUTS_TO_OFFER = 2
/** readiness 'ready' 判定のカット数（estimateVlogDurationSec で約10秒相当） */
export const READY_CUT_COUNT = 3
/** readiness 'ready' 判定の平均 rankScore 下限 */
export const READY_AVG_RANK = 0.5

/** 完成報酬（Daily/Weekly）を届ける夕方の時刻 */
export const REWARD_OFFER_HOUR = 18

/** 同一エピソードを dismiss 後に再提案しないためのクールダウン（時間） */
export const OFFER_COOLDOWN_HOURS = {
  daily: 20,
  weekly: 6 * 24,
  monthly: 25 * 24,
  anniversary: 20,
  event: 0,
} as const

/** anniversary として拾う経過月数 */
export const ANNIVERSARY_MONTHS = [1, 3, 6, 12] as const

/** エピソード種別の提案優先度（大きいほど先に出す）。
 *  weekly > daily は「日曜はDailyがWeeklyスペシャルに昇格する」の実装 */
export const OFFER_PRIORITY = {
  event: 100,
  weekly: 90,
  anniversary: 80,
  monthly: 60,
  daily: 50,
} as const

/** 記録日数マイルストーン（みてね型: 節目が家族共有とプレミアム転換の山） */
export const RECORD_DAY_MILESTONES = [7, 30, 100, 365] as const

/** 家族サークル: 閲覧側へのダイジェスト通知の最短間隔（時間）— みてね同様まとめて届ける */
export const CIRCLE_DIGEST_COOLDOWN_HOURS = 3
