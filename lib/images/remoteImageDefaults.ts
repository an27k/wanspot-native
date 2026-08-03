/**
 * リモート `uri` 向け `expo-image` のデフォルト（ローカル require には不適用）
 * 薄いグレー単色の BlurHash（青いアイコン PNG プレースホルダーは使わない）
 */
export const PLACEHOLDER_BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4'

/** 一覧・ピン用の写真背景（モザイク風 BlurHash を使わない） */
export const LIST_IMAGE_BG = '#e8e4de'

export const remoteImageExpoProps = {
  cachePolicy: 'memory-disk' as const,
  transition: 200,
  placeholder: { blurhash: PLACEHOLDER_BLURHASH, width: 32, height: 32 },
  placeholderContentFit: 'cover' as const,
}

/** カード・ピン：低解像度 BlurHash をやめ単色＋短いフェードでモザイク表示を抑える */
export const listImageExpoProps = {
  cachePolicy: 'memory-disk' as const,
  transition: 80,
  backgroundColor: LIST_IMAGE_BG,
}

/**
 * リモート画像の source.headers 用。
 * Supabase の画像変換（render/image）は Accept に image/webp が明示されていないと
 * リサイズ済みPNGを返す（実測: 240px で 339KB vs WebP 29KB）。expo-image の
 * ネットワーク層（SDWebImage / Glide）は既定で image/webp を送らないため明示する。
 * Google Places 等の他ホストはこのヘッダを無視するだけなので常時付けてよい。
 */
export const remoteImageAcceptHeaders = { Accept: 'image/webp,image/*;q=0.8' } as const