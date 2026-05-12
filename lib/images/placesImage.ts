/**
 * Google Places 画像（および wanspot プロキシ `/api/spots/photo`）を用途別の解像度に揃える。
 * DB の image_url や photo_ref 自体は変更せず、表示時にリサイズパラメータのみ調整する。
 */

export type ImageSize = 'thumbnail' | 'card' | 'hero' | 'full'

const SIZE_MAP: Record<ImageSize, { maxwidth: number; maxheight?: number }> = {
  thumbnail: { maxwidth: 240 },
  card: { maxwidth: 800 },
  hero: { maxwidth: 1600 },
  full: { maxwidth: 2400 },
}

export function widthForImageSize(size: ImageSize): number {
  return SIZE_MAP[size].maxwidth
}

/**
 * photo_reference から Google Place Photo API の URL を生成（直接 Places を叩く箇所用）
 */
export function getPlacesImageUrl(photoReference: string, size: ImageSize, apiKey: string): string {
  const { maxwidth } = SIZE_MAP[size]
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${encodeURIComponent(apiKey)}`
}

/**
 * 既存の画像URL（place/photo や wanspot プロキシ等）の幅指定を入れ替え
 */
export function resizePlacesImageUrl(originalUrl: string, size: ImageSize): string {
  if (!originalUrl) return originalUrl
  const { maxwidth } = SIZE_MAP[size]
  if (originalUrl.includes('maps.googleapis.com/maps/api/place/photo')) {
    if (/[?&]maxwidth=\d+/i.test(originalUrl)) {
      return originalUrl.replace(/maxwidth=\d+/i, `maxwidth=${maxwidth}`)
    }
  }
  if (originalUrl.includes('/api/spots/photo') && /[?&]w=\d+/.test(originalUrl)) {
    return originalUrl.replace(/([?&])w=\d+/, `$1w=${maxwidth}`)
  }
  return originalUrl
}
