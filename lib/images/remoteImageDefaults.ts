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

/** エイリアス（`remoteImageExpoProps` と同じ） */
export const remoteImageDefaults = remoteImageExpoProps
