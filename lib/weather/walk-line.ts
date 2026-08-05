import { CACHE_TTL, geoBucket, readCache, writeCache } from '@/lib/client-cache'
import { wanspotFetch } from '@/lib/wanspot-api'
import { walkAdviceDateKey } from '@/lib/weather/walk-environment'
import type { WalkAlertKey } from '@/lib/weather/walk-alert'

/**
 * 「今日、うちの子との散歩で何を変えるか」の一言。
 *
 * サーバが気象庁の実測から判定して返す。地域と日付だけで決まるので、
 * 同じ地域の全員が同じ文を読む（犬の情報は一切送らない）。
 *
 * 出ない日が通常。頻度は日によって振れ、全国実測では日ごとに4〜16%の範囲だった
 * （蓄積10日ぶんの観測。冬は未観測なので通年の平均はまだ言えない）。
 * 無い日はカードの見た目が何も変わらないので、ユーザーが「今日は無い」と
 * 気づく瞬間自体が無い。
 */
export type WalkLine = {
  text: string
  conditionId: string
  /** このレベル以上のときは表示しない。既存の安全寄りの文言と衝突させないため */
  hideWhenLevelAtOrAbove: WalkAlertKey | null
}

type WalkLineResponse = {
  line: string | null
  conditionId?: string
  hideWhenLevelAtOrAbove?: string | null
}

/** 暑さ側が大きいほうへ並べる。表示可否の比較に使う */
const LEVEL_ORDER: WalkAlertKey[] = ['numb', 'sting', 'chilly', 'comfortable', 'caution', 'danger', 'stop']

function isWalkAlertKey(v: unknown): v is WalkAlertKey {
  return typeof v === 'string' && (LEVEL_ORDER as string[]).includes(v)
}

/**
 * 猛暑で「散歩を休む日、で正解です」が出ている日に、
 * 「舗装の短い側を選ぶほうが楽です」を重ねない。
 * その日は既存の文言だけが正しい助言になる。
 */
export function shouldShowWalkLine(line: WalkLine, currentLevel: WalkAlertKey | null | undefined): boolean {
  if (!line.hideWhenLevelAtOrAbove || !currentLevel) return true
  const limit = LEVEL_ORDER.indexOf(line.hideWhenLevelAtOrAbove)
  const now = LEVEL_ORDER.indexOf(currentLevel)
  if (limit < 0 || now < 0) return true
  return now < limit
}

/**
 * 取得する。地域×日付で結果が変わらないので、端末側も同じ粒度で持つ。
 * 約11km格子にしているのは、これより細かくしても中身が同じで無駄になるため。
 */
export async function fetchWalkLine(lat: number, lng: number): Promise<WalkLine | null> {
  const key = `walk-line:v1:${walkAdviceDateKey()}:${geoBucket(lat, lng, 1)}`
  const cached = readCache<WalkLine | null>(key)
  if (cached !== undefined) return cached

  try {
    const res = await wanspotFetch(`/api/walk-line?lat=${lat}&lng=${lng}`)
    if (!res.ok) return null
    const json = (await res.json()) as WalkLineResponse
    const text = typeof json.line === 'string' ? json.line.trim() : ''
    const value: WalkLine | null = text
      ? {
          text,
          conditionId: typeof json.conditionId === 'string' ? json.conditionId : '',
          hideWhenLevelAtOrAbove: isWalkAlertKey(json.hideWhenLevelAtOrAbove)
            ? json.hideWhenLevelAtOrAbove
            : null,
        }
      : null
    // 出ない日も「出ない」を覚える。毎回問い合わせても答えは変わらない
    writeCache(key, value)
    return value
  } catch {
    // 一言が無くてもカードは成立する。取れなければ黙る
    return null
  }
}

export { CACHE_TTL }
