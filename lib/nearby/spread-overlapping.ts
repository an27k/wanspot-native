import type { SheetSpot } from '@/lib/nearby/sheet-spot'

/**
 * 同一座標に重なったピンの描画対策。
 *
 * 同じ建物に別業態が入っている場合（例: 動物病院 + 併設のペットホテル）、
 * Google Places 上は別スポットだが座標が完全に一致するため、マーカーが重なって
 * 描画順が入れ替わり続け、ピンがチカチカする。
 * ここでは実座標は変えず「表示用の座標」だけを小さくずらして重なりを解く。
 */

/** 同一地点とみなす丸め精度（小数4桁 ≒ 11m 格子） */
const COORD_PRECISION = 4
/** 重なり解消のためにずらす距離（メートル）。地図上で識別できる最小限に留める */
const SPREAD_RADIUS_M = 9

export type SpreadSpot = SheetSpot & {
  /** 表示用座標（重なりがなければ実座標と同値） */
  displayLat: number
  displayLng: number
}

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(COORD_PRECISION)},${lng.toFixed(COORD_PRECISION)}`
}

/** 名前を正規化（全角空白・記号を落として真の重複判定に使う） */
function normalizeName(name: string): string {
  return name.replace(/[\s　]+/g, '').toLowerCase()
}

/**
 * 同一座標×同一名の重複を1件に畳む（データ上の真の重複）。
 * 地図とカルーセルで件数がずれないよう、表示パイプラインの入口で共通に適用する。
 */
export function dedupeSameSpots(spots: SheetSpot[]): SheetSpot[] {
  const seen = new Set<string>()
  const out: SheetSpot[] = []
  for (const spot of spots) {
    const dupKey = `${coordKey(spot.lat, spot.lng)}|${normalizeName(spot.name)}`
    if (seen.has(dupKey)) continue
    seen.add(dupKey)
    out.push(spot)
  }
  return out
}

/**
 * 同一座標に重なったスポットへ、円形の微小オフセット（表示用座標）を与える。
 * 実座標は保持したままなので、距離表示・カルーセル同期には影響しない。
 */
export function spreadOverlappingSpots(spots: SheetSpot[]): SpreadSpot[] {
  if (spots.length === 0) return []
  const deduped = spots

  // 同一座標グループを集計
  const groups = new Map<string, SheetSpot[]>()
  for (const spot of deduped) {
    const key = coordKey(spot.lat, spot.lng)
    const list = groups.get(key) ?? []
    list.push(spot)
    groups.set(key, list)
  }

  // 重なっているグループだけ円形に配置（順序はキー順で安定させ、再描画で位置が動かないようにする）
  const offsets = new Map<string, { dLat: number; dLng: number }>()
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => a.key.localeCompare(b.key))
    const step = (2 * Math.PI) / sorted.length
    sorted.forEach((spot, i) => {
      const angle = step * i - Math.PI / 2 // 先頭を真上から時計回りに
      const dLat = (SPREAD_RADIUS_M * Math.sin(angle)) / 111_000
      const lngScale = 111_000 * Math.max(Math.cos((spot.lat * Math.PI) / 180), 0.2)
      const dLng = (SPREAD_RADIUS_M * Math.cos(angle)) / lngScale
      offsets.set(spot.key, { dLat, dLng })
    })
  }

  return deduped.map((spot) => {
    const off = offsets.get(spot.key)
    return {
      ...spot,
      displayLat: spot.lat + (off?.dLat ?? 0),
      displayLng: spot.lng + (off?.dLng ?? 0),
    }
  })
}
