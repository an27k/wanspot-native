import { File, Paths } from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'

export type VlogShareResult = { ok: true } | { ok: false; message: string }

let cachedDownload: { remoteUri: string; localUri: string } | null = null

/**
 * 署名付きURLのVlogをローカルにダウンロードし、ファイルURIを返す。
 * 共有→保存と連続で使うケースが多いため、同一URLは1回だけ落とす。
 */
export async function downloadVlogToCache(remoteUri: string): Promise<string> {
  if (cachedDownload?.remoteUri === remoteUri) {
    const existing = new File(cachedDownload.localUri)
    if (existing.exists) return cachedDownload.localUri
  }

  const dest = new File(Paths.cache, `wanspot-vlog-${Date.now()}.mp4`)
  if (dest.exists) dest.delete()
  const file = await File.downloadFileAsync(remoteUri, dest)
  cachedDownload = { remoteUri, localUri: file.uri }
  return file.uri
}

/** Vlogを動画ファイルとしてOS共有シートへ（Instagram/TikTok等にそのまま投稿できる） */
export async function shareVlogFile(remoteUri: string): Promise<VlogShareResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'この端末では共有シートを利用できません。' }
    }
    const localUri = await downloadVlogToCache(remoteUri)
    await Sharing.shareAsync(localUri, {
      mimeType: 'video/mp4',
      UTI: 'public.mpeg-4',
      dialogTitle: 'Vlogを共有',
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `動画の共有に失敗しました: ${message}` }
  }
}

/** Vlogをカメラロールへ保存（権限リクエスト込み） */
export async function saveVlogToCameraRoll(remoteUri: string): Promise<VlogShareResult> {
  try {
    const { granted, canAskAgain } = await MediaLibrary.requestPermissionsAsync(true)
    if (!granted) {
      return {
        ok: false,
        message: canAskAgain
          ? '写真への保存が許可されていません。'
          : '写真への保存が許可されていません。設定アプリから写真へのアクセスを許可してください。',
      }
    }
    const localUri = await downloadVlogToCache(remoteUri)
    await MediaLibrary.saveToLibraryAsync(localUri)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `カメラロールへの保存に失敗しました: ${message}` }
  }
}
