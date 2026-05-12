/**
 * リモート `uri` 向け `expo-image` のデフォルト（ローカル require には不適用）
 * 薄いグレー単色の BlurHash（青いアイコン PNG プレースホルダーは使わない）
 */
export const PLACEHOLDER_BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4'

export const remoteImageExpoProps = {
  cachePolicy: 'memory-disk' as const,
  transition: 200,
  placeholder: { blurhash: PLACEHOLDER_BLURHASH, width: 32, height: 32 },
  placeholderContentFit: 'cover' as const,
}

/** エイリアス（`remoteImageExpoProps` と同じ） */
export const remoteImageDefaults = remoteImageExpoProps
