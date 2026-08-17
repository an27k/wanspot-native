import { calcDistanceMeters } from '@/lib/nearby/geo'
import { isDogRunCategory } from '@/lib/nearby/constants'
import type { PlaceResult } from '@/types/places'
import type { WalkAlertKey } from '@/lib/weather/walk-alert'

const PRIOR_MEAN = 4.0
const PRIOR_WEIGHT = 10

/**
 * ベイズ風の加重スコア。レビュー件数が API に無い場合は 0 件扱いで保守的に下げる。
 * user_ratings_total が将来 nearby に載れば自動的に効く。
 */
export function placeQualityScore(spot: PlaceResult): number {
  const rating = spot.rating
  if (rating == null || rating <= 0 || !Number.isFinite(rating)) return -1

  const rawCount = spot.user_ratings_total
  const n =
    typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount > 0
      ? rawCount
      : 0

  /*
    件数が無いと n=0 で事前分布に丸まり、全スポットが定数 PRIOR_MEAN になる。
    その結果 ★4.7 と ★3.5 が完全に同点になり、品質が順位に一切効いていなかった。
    nearby は user_ratings_total を返していないので、実質すべてのスポットが該当する。

    件数が無いときは評価そのものを薄く効かせる。件数が載れば従来どおり
    ベイズ加重に戻り、この分岐は使われなくなる。
  */
  if (n === 0) return PRIOR_MEAN + (rating - PRIOR_MEAN) * 0.35

  const v = n
  return (v / (v + PRIOR_WEIGHT)) * rating + (PRIOR_WEIGHT / (v + PRIOR_WEIGHT)) * PRIOR_MEAN
}

/** おでかけの状況。指定がなければ距離のみで減衰させる */
export type WalkSituation = {
  /** 雨・雪。屋内席が無いスポットは実質選べない */
  rainy?: boolean
  /** うちの子のサイズ。L/XL は入店条件が付くことがある */
  dogSize?: string | null
  /**
   * 暑さの段階（walkAlertFromTemp の結果）。犬種の暑さ耐性まで織り込んだ値が入る。
   *
   * 気温は取得していたのに並び順へ一度も渡っていなかった。35℃の日に、日陰の
   * 分からない公園と屋外ドッグランとテラス席のみの店が最上位に並んでいた。
   * 雨で正しく効いている減点が、暑さにだけ無かった。
   */
  heatKey?: WalkAlertKey | null
  /** 移動手段。徒歩なら近さの価値が跳ね上がる */
  travel?: 'walking' | 'driving'
}

/** 距離の効き方。徒歩は 1.2km、車は 6km で約1/3に減衰する */
const DECAY_M = { walking: 1200, driving: 6000 } as const

/**
 * 「連れて行ける確実性」。0〜1。
 *
 * 飼い主の失望はこの順で大きい:
 *   1. 行ったのに入れなかった（確実性の欠如）
 *   2. 期待外れのしょぼい施設（価値の欠如）
 *   3. 遠くて選択肢にならない（距離）
 *
 * 旧実装は 1km の距離バケットが最優先で、この順序と真逆だった。
 * 「未検証で同伴可否も分からない店」が近いというだけで、検証済みの店より
 * 上に出ていた。これが「所詮AI」という失望の主因になる。
 */
export function petCertaintyScore(spot: PlaceResult): number {
  if (spot.pet_friendly_verified !== true) return 0

  /*
    分類より status を先に見る。ドッグランに分類されているのに status が
    矛盾している行が実測で16%（1,000件中157件。leashed_only 144 / not_allowed 13）
    あり、分類だけで最高値を返していたため、同伴できない場所が最上位に出ていた。
  */
  if (spot.pet_friendly_status === 'not_allowed') return 0

  // 囲われたノーリード区画は、犬連れの目的地として最も確実。
  // ただしリード必須の場所は「走らせられる場所」ではないので、この扱いにしない
  if (isDogRunCategory(spot.extended_category) && spot.pet_friendly_status !== 'leashed_only') {
    return 1
  }
  if (spot.pet_indoor_allowed === true) return 1
  /*
    同伴可が確認済み。屋内可否までは分かっていないが、「未検証で何も分からない」
    とは全く違う。分岐が無かったため最下位の 0.2 に落ちており、実測で母集団の
    3割（150件中39件）がここに沈んでいた。動物病院がまとめて沈むのもこれが原因。
  */
  if (spot.pet_friendly_status === 'allowed') return 0.85
  if (spot.pet_terrace_only === true) return 0.7
  if (spot.pet_friendly_status === 'leashed_only') return 0.6
  // 検証はしたが同伴可否を判定できなかった。未検証よりは情報がある
  return 0.2
}

/**
 * 状況による減点。0〜1 の倍率で確実性に掛ける。
 *
 * 「雨の日に屋外を勧める」「大型犬なのにサイズ制限のある店を勧める」は、
 * 情報が揃っていても出し方で失望させる典型なので、スコア側で吸収する。
 */
function situationFactor(spot: PlaceResult, situation: WalkSituation | null): number {
  if (!situation) return 1
  let factor = 1

  if (situation.rainy) {
    if (spot.pet_indoor_allowed === true) {
      factor *= 1
    } else if (spot.pet_terrace_only === true || spot.pet_friendly_status === 'outdoor_only') {
      // テラスのみ・屋外のみは雨の日には選べない
      factor *= 0.15
    } else {
      factor *= 0.6 // 屋内か不明。可能性は残すが優先はしない
    }
  }

  /*
    暑い日は「屋内に逃げられるか」が可否と同じ重さになる。短頭種やシニアでは
    段階が2つ手前で上がるので、ここは犬ごとに違う結果になる。

    屋内可なら減点しない。テラスのみ・屋外のみは、雨のときと同じく実質選べない。
    屋外ドッグランは走らせる前提の場所なので、暑い日は雨より重く見る。
    屋内ドッグランは逃げ場があるので据え置く。
  */
  const heat = situation.heatKey
  if (heat === 'danger' || heat === 'stop') {
    const severe = heat === 'stop'
    if (spot.pet_indoor_allowed === true || spot.extended_category === 'dog_run_indoor') {
      factor *= 1
    } else if (isDogRunCategory(spot.extended_category)) {
      factor *= severe ? 0.2 : 0.4
    } else if (spot.pet_terrace_only === true || spot.pet_friendly_status === 'outdoor_only') {
      factor *= severe ? 0.15 : 0.3
    } else {
      factor *= 0.6 // 屋内か不明。可能性は残すが優先はしない
    }
  } else if (heat === 'caution') {
    if (spot.pet_indoor_allowed === true || spot.extended_category === 'dog_run_indoor') {
      factor *= 1
    } else if (spot.pet_terrace_only === true || spot.pet_friendly_status === 'outdoor_only') {
      factor *= 0.7
    } else if (isDogRunCategory(spot.extended_category)) {
      factor *= 0.8
    }
  }

  const size = situation.dogSize?.toUpperCase()
  if ((size === 'L' || size === 'XL') && spot.pet_size_limit) {
    // 「大型犬不可」等の制限があるものは、大型犬の飼い主には価値が無い
    if (/大型|中型|小型|kg|体重|サイズ/.test(spot.pet_size_limit)) factor *= 0.3
  }

  return factor
}

const W_CERTAINTY = 3.0
const W_DISTANCE = 2.0

/**
 * 総合スコア。確実性 > 品質 > 距離 の重みづけで連続値にする。
 *
 * 辞書式（距離バケット→品質）だとバケット境界で品質が完全にリセットされ、
 * 0.9km の ★3.2 が 1.1km の ★4.9 に勝ってしまっていた。
 */
export function placeOverallScore(
  spot: PlaceResult,
  origin: { lat: number; lng: number } | null,
  situation: WalkSituation | null = null
): number {
  const certainty = petCertaintyScore(spot) * situationFactor(spot, situation)
  const quality = placeQualityScore(spot)

  let distanceTerm = 0
  if (origin) {
    const d = calcDistanceMeters(origin.lat, origin.lng, spot.lat, spot.lng)
    distanceTerm = Math.exp(-d / DECAY_M[situation?.travel ?? 'walking'])
  }

  return W_CERTAINTY * certainty + quality + W_DISTANCE * distanceTerm
}

/**
 * 候補から除外すべきスポット。
 * スコアを下げるのではなく「出さない」ことでしか防げない失望がある。
 */
export function shouldExcludeForOwner(spot: PlaceResult): boolean {
  // 連れて行けないと分かっている店を、犬アプリが出す理由が無い
  if (spot.pet_friendly_status === 'not_allowed') return true
  // 「店の子に会いに行く店」。自分の子は連れて行けないのでおでかけ候補にならない
  if (spot.dog_interaction === 'meet_dogs') return true
  return false
}

export function sortPlacesByScore(
  spots: PlaceResult[],
  origin: { lat: number; lng: number } | null,
  situation: WalkSituation | null = null
): PlaceResult[] {
  return [...spots]
    .filter((s) => !shouldExcludeForOwner(s))
    .sort((a, b) => {
      const sa = placeOverallScore(a, origin, situation)
      const sb = placeOverallScore(b, origin, situation)
      if (sb !== sa) return sb - sa
      // 同点なら近い順
      if (origin) {
        return (
          calcDistanceMeters(origin.lat, origin.lng, a.lat, a.lng) -
          calcDistanceMeters(origin.lat, origin.lng, b.lat, b.lng)
        )
      }
      return 0
    })
}
