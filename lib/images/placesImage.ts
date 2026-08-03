/**
 * Google Places 画像（および wanspot プロキシ `/api/spots/photo`、Supabase Storage）を
 * 用途別の解像度に揃える。
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
 * Supabase Storage の公開URLを画像変換エンドポイントに差し替える。
 * 記事・イベントのサムネイルは約2MBのPNG原寸で保存されており、そのまま読むと
 * 一覧表示で数十MBの転送になる。render/image はリサイズ + WebP変換（Acceptヘッダ
 * 依存）+ CDNキャッシュが効き、実測で 2MB → 数十KB になる。
 * 変換パラメータ付きURLもキャッシュキーとして安定するよう width と quality のみ使う。
 */
function resizeSupabasePublicUrl(originalUrl: string, maxwidth: number): string | null {
  // 前後空白が残った DB 値でも壊れた render URL（パス末尾空白 → 400）を作らない
  const url = originalUrl.trim()
  if (!/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(url)) {
    return null
  }
  const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}width=${maxwidth}&quality=75`
}

/**
 * 既存の画像URL（place/photo・wanspot プロキシ・Supabase Storage）の幅指定を入れ替え
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
  return resizeSupabasePublicUrl(originalUrl, maxwidth) ?? originalUrl
}
