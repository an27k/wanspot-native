import { loadNotificationsModule } from '@/lib/notifications/notifications-module'
import { dogAgeMonths } from '@/lib/analytics-context'
import { breedHeatSensitivity } from '@/lib/dog-breeds'
import { walkAlertFromTemp, ageHeatSensitivity } from '@/lib/weather/walk-alert'
import {
  fetchWalkHourlySlotsForDate,
  type WalkHourlySlot,
} from '@/lib/weather/walk-environment'

export const WALK_ADVICE_MORNING_TYPE = 'walk_advice_morning'

/** 散歩時間 未設定時のデフォルト通知時刻（朝5:00・JST） */
export const WALK_ADVICE_DEFAULT_NOTIFY_HOUR = 5
/** カスタム散歩時間がある場合、その何時間前に通知するか */
export const WALK_ADVICE_NOTIFY_LEAD_HOURS = 2

/** 同一条件での重複予約を避ける（犬名・散歩時間・日付が変わったら貼り直す） */
let syncedKey: string | null = null

/** JST の今の {dateKey, hour} */
function nowJst(): { dateKey: string; hour: number; epochMs: number } {
  const now = new Date()
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(now)
  )
  return { dateKey, hour, epochMs: now.getTime() }
}

/** JST日付キー + 時 → 絶対時刻（Date）。JST = UTC+9 固定 */
function jstDate(dateKey: string, hour: number): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour - 9, 0, 0))
}

function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days, 3)) // 正午前の安全時刻
  return dt.toISOString().slice(0, 10)
}

/**
 * 歩きやすいスロットか（降水50%未満・雨系でない・気温が上限以下）。
 *
 * 気温の上限を25℃固定にしていたため、犬種と年齢の補正がここだけ通っていなかった。
 * 同じファイル内の walkAlertFromTemp は短頭種を21℃で「暑さ注意」にしているのに、
 * こちらは25℃まで「歩きやすい」と判定する二重基準になっていた。
 */
function isWalkableSlot(s: WalkHourlySlot, heat = 0): boolean {
  const maxTemp = 25 - Math.max(0, Math.min(2, heat)) * 2
  return s.tempC <= maxTemp && s.precipProb < 50 && s.condition !== 'rain' && s.condition !== 'thunder' && s.condition !== 'snow'
}

/** 条件を満たすスロットが無い日に、せめて時刻と気温を返すための最低気温スロット */
function coolestSlot(slots: WalkHourlySlot[], fromHour?: number): WalkHourlySlot | null {
  let out: WalkHourlySlot | null = null
  for (const s of slots) {
    if (fromHour != null && s.hour < fromHour) continue
    if (!out || s.tempC < out.tempC) out = s
  }
  return out
}

/** 快適域(12〜24℃)からの距離 */
function comfortDistance(tempC: number): number {
  if (tempC < 12) return 12 - tempC
  if (tempC > 24) return tempC - 24
  return 0
}

/**
 * 歩きやすい時間を選ぶ。
 *
 * fromHour を渡すと、その時刻以降のスロットだけを候補にする。
 * 通知は「これからどうするか」を伝えるものなので、既に過ぎた時間を薦めても
 * 飼い主にはどうしようもない。実際、20時の散歩の2時間前（18時）に届いた通知が
 * 「きょうは9時ごろが歩きやすそうです」と言っており、意味をなしていなかった。
 */
function pickBestSlot(slots: WalkHourlySlot[], fromHour?: number, heat = 0): WalkHourlySlot | null {
  let best: WalkHourlySlot | null = null
  for (const s of slots) {
    if (fromHour != null && s.hour < fromHour) continue
    if (!isWalkableSlot(s, heat)) continue
    if (
      !best ||
      comfortDistance(s.tempC) < comfortDistance(best.tempC) ||
      (comfortDistance(s.tempC) === comfortDistance(best.tempC) && s.precipProb < best.precipProb)
    ) {
      best = s
    }
  }
  return best
}

/** デフォルト（散歩時間 未設定）: きょうのおすすめ時間の提言 */
function buildDefaultBody(slots: WalkHourlySlot[], name: string, fromHour?: number, heat = 0): string {
  const best = pickBestSlot(slots, fromHour, heat)
  if (best) {
    return `きょうは${best.hour}時ごろ（${best.tempC}℃・降水${best.precipProb}%）が歩きやすそうです。${name}とのお散歩の目安にどうぞ。`
  }
  /*
    基準を満たす時間が1つも無い日でも、時刻と気温は必ず出す。
    「いちばん涼しい時間に短めのお散歩が安心です」だけでは、何時なのかが分からず
    受け取った側は結局自分で調べ直すことになる。真夏はこの分岐に入り続ける。
  */
  const cool = coolestSlot(slots, fromHour)
  if (cool) {
    return `きょうは終日きびしい予報です。いちばん涼しいのは${cool.hour}時ごろ（${cool.tempC}℃）。${name}とのお散歩は短めにしましょう。`
  }
  return `きょうは暑さや天気が厳しめの予報です。いちばん涼しい時間に短めのお散歩が安心です。`
}

/**
 * カスタム散歩時間あり: 予定時刻の環境予測 + より良い時間があれば変更の助言。
 *
 * notifyHour（この通知が届く時刻）以降の時間だけを代案にする。
 * 朝5時の通知なら1日全体が候補になり、散歩2時間前の通知なら
 * 「これから」の時間だけが候補になる。過ぎた時間を薦めない。
 */
function buildCustomBody(
  slots: WalkHourlySlot[],
  walkHour: number,
  name: string,
  heat: number,
  notifyHour: number
): string {
  const planned = slots.find((s) => s.hour === walkHour) ?? null
  const best = pickBestSlot(slots, notifyHour, heat)

  if (planned && isWalkableSlot(planned, heat)) {
    const level = walkAlertFromTemp(planned.tempC, { heatSensitivity: heat })
    // 予定時刻が歩きやすく、明確により良い時間もなければそのまま背中を押す
    if (!best || best.hour === planned.hour || comfortDistance(best.tempC) >= comfortDistance(planned.tempC)) {
      return `${walkHour}時の予定時間は${planned.tempC}℃・降水${planned.precipProb}%（${level.label}）。予定どおりで良さそうです。`
    }
    return `${walkHour}時は${planned.tempC}℃・降水${planned.precipProb}%の見込み。${best.hour}時ごろ（${best.tempC}℃）のほうがさらに歩きやすそうです。`
  }

  if (planned && best) {
    return `${walkHour}時は${planned.tempC}℃・降水${planned.precipProb}%と少し条件が厳しめ。${best.hour}時ごろ（${best.tempC}℃・降水${best.precipProb}%）のほうが歩きやすそうです。`
  }
  if (planned) {
    // 代案が無い＝これ以降に歩きやすい時間が無い。予定を変える提案はせず、歩き方の助言にする
    return `${walkHour}時は${planned.tempC}℃・降水${planned.precipProb}%の見込みです。${name}の様子を見ながら、短めの調整が安心です。`
  }
  return buildDefaultBody(slots, name, notifyHour, heat)
}

/**
 * 朝のお散歩予報通知を予約する（冪等・ベストエフォート）。
 * アプリ起動を「更新タイミング」として、予報から本文を計算した通知を直近2日ぶんワンショット予約する。
 * - 散歩時間 未設定: 朝5:00に「きょうのおすすめ時間」
 * - カスタム散歩時間: その2時間前に「予定時刻の環境予測＋より良い時間の助言」
 * 位置情報が無い場合は本文を汎用文言にして同時刻に予約する。
 */
export async function syncWalkAdviceMorningNotification(
  dogName?: string | null,
  opts?: {
    location?: { lat: number; lng: number } | null
    walkHour?: number | null
    /** 短頭種など暑さに弱い犬種は通知の判定も厳しくする */
    dogBreed?: string | null
    /** 子犬とシニアも同じく厳しくする。犬種と合算して2段まで */
    dogBirthday?: string | null
  }
): Promise<void> {
  const nameKey = dogName?.trim() || null
  const walkHour = opts?.walkHour ?? null
  const heat = breedHeatSensitivity(opts?.dogBreed) + ageHeatSensitivity(dogAgeMonths(opts?.dogBirthday ?? null))
  const now = nowJst()
  const dedupe = `${nameKey}:${walkHour}:${now.dateKey}:${opts?.location ? 'loc' : 'noloc'}:h${heat}`
  if (syncedKey === dedupe) return
  syncedKey = dedupe

  try {
    // ネイティブモジュール未搭載のバイナリでは何もしない（起動クラッシュ防止）
    const notifications = loadNotificationsModule()
    if (!notifications) return

    let permission = await notifications.getPermissionsAsync()
    if (!permission.granted && permission.canAskAgain) {
      permission = await notifications.requestPermissionsAsync()
    }
    if (!permission.granted) return

    // 既存の予約を貼り直す（予報・設定変更が反映されるように）
    const scheduled = await notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.type === WALK_ADVICE_MORNING_TYPE)
        .map((n) => notifications.cancelScheduledNotificationAsync(n.identifier))
    )

    const name = nameKey ?? 'うちの子'
    const title = `☀️ きょうの${name}のお散歩予報`

    /**
     * 通知する時刻。
     *
     * 朝の1本は「きょうをどう組み立てるか」、散歩直前の1本は「予定どおりでいいか」を
     * 伝えるもので、役割が違う。以前は散歩時間を設定すると朝の通知が消えて直前だけになり、
     * その1本が1日全体から代案を選んでいたため「18時に届いて9時を薦める」が起きていた。
     * 2本に分け、それぞれ自分が届く時刻以降だけを見るようにする。
     */
    const notifyHours: number[] = [WALK_ADVICE_DEFAULT_NOTIFY_HOUR]
    if (walkHour != null) {
      const lead = walkHour - WALK_ADVICE_NOTIFY_LEAD_HOURS
      // 朝の通知と近すぎる（＝実質同じ話になる）場合は増やさない
      if (lead > WALK_ADVICE_DEFAULT_NOTIFY_HOUR + 1) notifyHours.push(lead)
    }

    // 直近2日ぶん（Open-Meteo の forecast_days=2 の範囲内）
    for (const dayOffset of [0, 1]) {
      const dateKey = addDaysToKey(now.dateKey, dayOffset)
      const slots = opts?.location
        ? await fetchWalkHourlySlotsForDate(opts.location.lat, opts.location.lng, dateKey)
        : []

      for (const notifyHour of notifyHours) {
        const fireAt = jstDate(dateKey, notifyHour)
        if (fireAt.getTime() <= now.epochMs + 5 * 60_000) continue // 過ぎた回・直近すぎる回はスキップ

        let body = '歩きやすい時間の目安ができています。おでかけ前にチェックしてあげてください。'
        if (slots.length > 0) {
          body =
            walkHour != null
              ? buildCustomBody(slots, walkHour, name, heat, notifyHour)
              : buildDefaultBody(slots, name, notifyHour)
        }

        await notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { type: WALK_ADVICE_MORNING_TYPE, url: '/(tabs)/mypage' },
          },
          trigger: {
            type: notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
          },
        })
      }
    }
  } catch (e) {
    // 通知はベストエフォート。失敗しても体験を壊さない
    console.warn('[walk-advice-morning]', e instanceof Error ? e.message : String(e))
  }
}
