/**
 * 2 点間の徒歩時間（分）の近似（クライアント表示の再計算用途）。
 */

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function estimateWalkingMinutes(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = R * c
  const adjustedKm = distanceKm * 1.3
  const walkingMinutes = (adjustedKm * 1000) / 80
  return Math.max(0, Math.ceil(walkingMinutes))
}
