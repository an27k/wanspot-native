import * as ImageManipulator from 'expo-image-manipulator'

/** リモート/ローカル画像を静的 JPEG に再エンコード（indexed PNG・APNG 回避） */
export async function sanitizeImageForDisplay(uri: string): Promise<string | null> {
  try {
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    })
    return result.uri
  } catch (e) {
    console.warn('[sanitizeImageForDisplay]', e)
    return null
  }
}
